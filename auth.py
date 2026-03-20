"""
Authentication: JWT tokens, bcrypt password hashing, session management,
rate limiting for login attempts.
"""
import hashlib
import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession

import database as db_ops
from config import config
from database import Session, User, get_db

logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Bearer token extractor
security = HTTPBearer(auto_error=False)

# In-memory rate limiter: ip -> [(timestamp, count)]
_rate_limit_store: dict = defaultdict(list)
_WINDOW_SECONDS = 60  # 1 minute window


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    return pwd_context.verify(plain, hashed)


def _token_hash(token: str) -> str:
    """SHA-256 hash of a token for storage."""
    return hashlib.sha256(token.encode()).hexdigest()


def create_access_token(user_id: str, email: str, is_admin: bool) -> str:
    """Create a short-lived JWT access token."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": user_id,
        "email": email,
        "is_admin": is_admin,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, config.SECRET_KEY, algorithm=config.JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    """Create a long-lived JWT refresh token."""
    expire = datetime.now(timezone.utc) + timedelta(
        days=config.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = {
        "sub": user_id,
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, config.SECRET_KEY, algorithm=config.JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT token. Returns payload or None."""
    try:
        payload = jwt.decode(
            token, config.SECRET_KEY, algorithms=[config.JWT_ALGORITHM]
        )
        return payload
    except JWTError as e:
        logger.debug(f"JWT decode error: {e}")
        return None


def check_rate_limit(ip: str, limit: int = None) -> bool:
    """
    Returns True if the request is allowed, False if rate limited.
    Uses sliding window counter.
    """
    limit = limit or config.LOGIN_RATE_LIMIT
    now = time.time()
    window_start = now - _WINDOW_SECONDS

    # Filter old entries
    _rate_limit_store[ip] = [
        ts for ts in _rate_limit_store[ip] if ts > window_start
    ]

    if len(_rate_limit_store[ip]) >= limit:
        return False

    _rate_limit_store[ip].append(now)
    return True


async def authenticate_user(
    db: AsyncSession, email: str, password: str
) -> Optional[User]:
    """Verify email/password and return User if valid."""
    user = await db_ops.get_user_by_email(db, email)
    if not user:
        return None
    if not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


async def login_user(
    db: AsyncSession,
    user: User,
    ip_address: str,
    user_agent: str,
) -> Tuple[str, str]:
    """
    Create access + refresh tokens and store session in DB.
    Returns (access_token, refresh_token).
    """
    access_token = create_access_token(user.id, user.email, user.is_admin)
    refresh_token = create_refresh_token(user.id)

    # Store refresh token hash in DB for validation
    r_hash = _token_hash(refresh_token)
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=config.REFRESH_TOKEN_EXPIRE_DAYS
    )
    await db_ops.create_session(
        db,
        user_id=user.id,
        token_hash=r_hash,
        ip_address=ip_address,
        user_agent=user_agent,
        expires_at=expires_at,
    )
    await db_ops.update_user_login(db, user.id)
    return access_token, refresh_token


async def refresh_access_token(
    db: AsyncSession, refresh_token: str
) -> Optional[str]:
    """Validate refresh token and issue new access token."""
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        return None

    r_hash = _token_hash(refresh_token)
    session = await db_ops.get_session_by_token_hash(db, r_hash)
    if not session:
        return None

    user = session.user
    return create_access_token(user.id, user.email, user.is_admin)


async def logout_user(db: AsyncSession, refresh_token: str) -> bool:
    """Invalidate a refresh token session."""
    r_hash = _token_hash(refresh_token)
    return await db_ops.invalidate_session(db, r_hash)


# ─── FastAPI dependencies ──────────────────────────────────────────────────────

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency: validate JWT and return current user."""
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = None
    if credentials:
        token = credentials.credentials
    else:
        # Try cookie or query param as fallback
        token = request.cookies.get("access_token") or request.query_params.get("token")

    if not token:
        raise exc

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise exc

    user_id = payload.get("sub")
    if not user_id:
        raise exc

    user = await db_ops.get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise exc

    return user


async def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """FastAPI dependency: ensure current user is admin."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required",
        )
    return current_user


def validate_password_strength(password: str) -> Tuple[bool, str]:
    """
    Validate password meets strength requirements.
    Returns (is_valid, error_message).
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"
    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter"
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one digit"
    return True, ""
