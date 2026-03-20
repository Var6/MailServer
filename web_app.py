"""
FastAPI web application with REST API, WebSocket, and static file serving.
"""
import asyncio
import base64
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import bleach
from fastapi import (
    Depends, FastAPI, File, Form, HTTPException, Query, Request,
    Response, UploadFile, WebSocket, WebSocketDisconnect, status
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr, validator
from sqlalchemy.ext.asyncio import AsyncSession

import database as db_ops
from auth import (
    authenticate_user, check_rate_limit, get_current_admin,
    get_current_user, hash_password, login_user, logout_user,
    refresh_access_token, validate_password_strength
)
from config import config
from database import get_db, serialize_email, serialize_user
from smtp_server import send_email_via_smtp

logger = logging.getLogger(__name__)

app = FastAPI(
    title=f"{config.COMPANY_NAME} Mail API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── WebSocket Manager ─────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.connections:
            self.connections[user_id] = []
        self.connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.connections:
            self.connections[user_id] = [
                ws for ws in self.connections[user_id] if ws != websocket
            ]
            if not self.connections[user_id]:
                del self.connections[user_id]

    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.connections:
            dead = []
            for ws in self.connections[user_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.disconnect(ws, user_id)


ws_manager = ConnectionManager()


async def notify_new_email(user_id: str, email_data: dict):
    """Notify connected WebSocket clients of a new email."""
    await ws_manager.send_to_user(user_id, {
        "type": "new_email",
        "data": email_data,
    })


# ─── Pydantic Schemas ──────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class ProfileUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    signature: Optional[str] = None


class SendEmailRequest(BaseModel):
    to: List[str]
    cc: Optional[List[str]] = []
    bcc: Optional[List[str]] = []
    subject: str
    body_text: Optional[str] = ""
    body_html: Optional[str] = ""
    reply_to: Optional[str] = None
    thread_id: Optional[str] = None


class DraftEmailRequest(BaseModel):
    to: Optional[List[str]] = []
    cc: Optional[List[str]] = []
    bcc: Optional[List[str]] = []
    subject: Optional[str] = ""
    body_text: Optional[str] = ""
    body_html: Optional[str] = ""


class MoveEmailRequest(BaseModel):
    folder: str


class BulkOperationRequest(BaseModel):
    ids: List[str]
    action: str  # read, unread, flag, unflag, delete, move
    folder: Optional[str] = None


class ContactCreateRequest(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    notes: Optional[str] = ""


class LabelCreateRequest(BaseModel):
    name: str
    color: Optional[str] = "#667eea"


class AdminUserCreateRequest(BaseModel):
    email: str
    password: str
    display_name: str
    is_admin: Optional[bool] = False
    quota_mb: Optional[int] = None


class AdminUserUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None
    quota_mb: Optional[int] = None


class SettingsUpdateRequest(BaseModel):
    signature: Optional[str] = None
    display_name: Optional[str] = None


ALLOWED_HTML_TAGS = [
    "p", "br", "b", "i", "u", "strong", "em", "strike", "s",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "blockquote", "pre", "code",
    "a", "img", "div", "span", "table", "thead", "tbody", "tr", "th", "td",
    "hr", "sup", "sub",
]
ALLOWED_HTML_ATTRS = {
    "*": ["style", "class"],
    "a": ["href", "title", "target"],
    "img": ["src", "alt", "width", "height"],
}


def sanitize_html(html: str) -> str:
    """Sanitize HTML to prevent XSS."""
    return bleach.clean(
        html,
        tags=ALLOWED_HTML_TAGS,
        attributes=ALLOWED_HTML_ATTRS,
        strip=True,
    )


# ─── Auth Endpoints ────────────────────────────────────────────────────────────

@app.post("/api/auth/login")
async def api_login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please wait.",
        )

    user = await authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    ua = request.headers.get("User-Agent", "")
    access_token, refresh_token = await login_user(db, user, client_ip, ua)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "Bearer",
        "user": serialize_user(user),
    }


@app.post("/api/auth/logout")
async def api_logout(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    await logout_user(db, body.refresh_token)
    return {"message": "Logged out successfully"}


@app.post("/api/auth/refresh")
async def api_refresh(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    new_token = await refresh_access_token(db, body.refresh_token)
    if not new_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    return {"access_token": new_token, "token_type": "Bearer"}


@app.get("/api/auth/me")
async def api_me(current_user=Depends(get_current_user)):
    return serialize_user(current_user)


@app.put("/api/auth/password")
async def api_change_password(
    body: PasswordChangeRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from auth import verify_password
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    valid, msg = validate_password_strength(body.new_password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    new_hash = hash_password(body.new_password)
    await db_ops.update_user(db, current_user.id, password_hash=new_hash)
    return {"message": "Password updated successfully"}


@app.put("/api/auth/profile")
async def api_update_profile(
    body: ProfileUpdateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    updates = {}
    if body.display_name is not None:
        updates["display_name"] = body.display_name.strip()
    if body.signature is not None:
        updates["signature"] = sanitize_html(body.signature)

    if updates:
        await db_ops.update_user(db, current_user.id, **updates)

    updated = await db_ops.get_user_by_id(db, current_user.id)
    return serialize_user(updated)


@app.post("/api/auth/avatar")
async def api_upload_avatar(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if file.content_type not in ("image/jpeg", "image/png", "image/gif", "image/webp"):
        raise HTTPException(status_code=400, detail="Invalid image type")

    data = await file.read()
    if len(data) > 2 * 1024 * 1024:  # 2MB limit
        raise HTTPException(status_code=400, detail="Image too large (max 2MB)")

    await db_ops.update_user(
        db, current_user.id,
        avatar_data=data,
        avatar_mime=file.content_type
    )
    return {"message": "Avatar updated"}


@app.get("/api/auth/avatar/{user_id}")
async def api_get_avatar(user_id: str, db: AsyncSession = Depends(get_db)):
    user = await db_ops.get_user_by_id(db, user_id)
    if not user or not user.avatar_data:
        raise HTTPException(status_code=404, detail="No avatar found")
    return Response(
        content=user.avatar_data,
        media_type=user.avatar_mime or "image/jpeg"
    )


# ─── Email Endpoints ───────────────────────────────────────────────────────────

@app.get("/api/emails/count")
async def api_email_counts(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    unread = await db_ops.get_unread_counts(db, current_user.id)
    total = await db_ops.get_folder_counts(db, current_user.id)
    return {"unread": unread, "total": total}


@app.get("/api/emails/thread/{thread_id}")
async def api_get_thread(
    thread_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    emails = await db_ops.get_thread_emails(db, thread_id, current_user.id)
    return [serialize_email(e) for e in emails]


@app.get("/api/emails")
async def api_list_emails(
    folder: str = Query("INBOX"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None),
    label: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db_ops.get_emails(
        db,
        user_id=current_user.id,
        folder=folder,
        page=page,
        limit=limit,
        search=search,
        label_id=label,
    )
    return {
        "emails": [serialize_email(e) for e in result["emails"]],
        "total": result["total"],
        "page": result["page"],
        "limit": result["limit"],
        "pages": (result["total"] + limit - 1) // limit,
    }


@app.get("/api/emails/{email_id}")
async def api_get_email(
    email_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    email = await db_ops.get_email_by_id(db, email_id, current_user.id)
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    # Auto mark as read
    if not email.is_read:
        await db_ops.update_email(db, email_id, current_user.id, is_read=True)
        email.is_read = True

    # Notify unread count change via WebSocket
    await ws_manager.send_to_user(current_user.id, {
        "type": "email_read",
        "data": {"id": email_id}
    })

    return serialize_email(email)


@app.post("/api/emails")
async def api_send_email(
    to: str = Form(...),
    subject: str = Form(...),
    body_text: str = Form(""),
    body_html: str = Form(""),
    cc: str = Form(""),
    bcc: str = Form(""),
    reply_to: str = Form(""),
    thread_id: str = Form(""),
    attachments: List[UploadFile] = File(default=[]),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    to_list = [a.strip() for a in to.split(",") if a.strip()]
    cc_list = [a.strip() for a in cc.split(",") if a.strip()] if cc else []
    bcc_list = [a.strip() for a in bcc.split(",") if a.strip()] if bcc else []

    if not to_list:
        raise HTTPException(status_code=400, detail="At least one recipient required")

    # Sanitize HTML
    clean_html = sanitize_html(body_html) if body_html else ""

    # Process attachments
    att_list = []
    total_size = 0
    for f in attachments:
        if f.filename:
            data = await f.read()
            total_size += len(data)
            if total_size > config.MAX_EMAIL_SIZE_MB * 1024 * 1024:
                raise HTTPException(status_code=400, detail="Total email size too large")
            att_list.append({
                "filename": f.filename,
                "content_type": f.content_type or "application/octet-stream",
                "data": data,
            })

    # Send via SMTP
    success = await send_email_via_smtp(
        from_addr=current_user.email,
        to_addrs=to_list,
        subject=subject,
        body_text=body_text,
        body_html=clean_html,
        cc=cc_list if cc_list else None,
        bcc=bcc_list if bcc_list else None,
        reply_to=reply_to or None,
        attachments=att_list if att_list else None,
    )

    # Also store in Sent folder
    msg_id = f"<{uuid.uuid4()}@{config.DOMAIN}>"
    t_id = thread_id if thread_id else str(uuid.uuid4())
    size = len(body_text.encode()) + len(clean_html.encode())
    for att in att_list:
        size += len(att["data"])

    email_obj = await db_ops.create_email(
        db,
        user_id=current_user.id,
        folder="Sent",
        from_addr=current_user.email,
        to_addrs=to_list,
        subject=subject,
        body_text=body_text,
        body_html=clean_html,
        cc=cc_list,
        bcc=bcc_list,
        reply_to=reply_to or None,
        message_id=msg_id,
        size_bytes=size,
        is_read=True,
        thread_id=t_id,
    )
    email_obj.has_attachments = len(att_list) > 0

    for att in att_list:
        await db_ops.create_attachment(
            db,
            email_id=email_obj.id,
            filename=att["filename"],
            content_type=att["content_type"],
            data=att["data"],
        )

    await db_ops.update_user_quota_usage(db, current_user.id, size)
    await db.commit()

    return {"message": "Email sent", "id": email_obj.id, "smtp_success": success}


@app.post("/api/emails/draft")
async def api_save_draft(
    body: DraftEmailRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    email_obj = await db_ops.create_email(
        db,
        user_id=current_user.id,
        folder="Drafts",
        from_addr=current_user.email,
        to_addrs=body.to or [],
        subject=body.subject or "",
        body_text=body.body_text or "",
        body_html=sanitize_html(body.body_html) if body.body_html else "",
        cc=body.cc or [],
        bcc=body.bcc or [],
        is_read=True,
    )
    await db.commit()
    return serialize_email(email_obj)


@app.put("/api/emails/{email_id}/draft")
async def api_update_draft(
    email_id: str,
    body: DraftEmailRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import json as _json
    updates = {}
    if body.to is not None:
        updates["to_addrs"] = _json.dumps(body.to)
    if body.cc is not None:
        updates["cc"] = _json.dumps(body.cc)
    if body.bcc is not None:
        updates["bcc"] = _json.dumps(body.bcc)
    if body.subject is not None:
        updates["subject"] = body.subject
    if body.body_text is not None:
        updates["body_text"] = body.body_text
    if body.body_html is not None:
        updates["body_html"] = sanitize_html(body.body_html)

    email = await db_ops.update_email(db, email_id, current_user.id, **updates)
    if not email:
        raise HTTPException(status_code=404, detail="Draft not found")
    return serialize_email(email)


@app.put("/api/emails/{email_id}/read")
async def api_mark_read(
    email_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    email = await db_ops.update_email(db, email_id, current_user.id, is_read=True)
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    return {"id": email_id, "is_read": True}


@app.put("/api/emails/{email_id}/unread")
async def api_mark_unread(
    email_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    email = await db_ops.update_email(db, email_id, current_user.id, is_read=False)
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    return {"id": email_id, "is_read": False}


@app.put("/api/emails/{email_id}/flag")
async def api_flag_email(
    email_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    email = await db_ops.update_email(db, email_id, current_user.id, is_flagged=True)
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    return {"id": email_id, "is_flagged": True}


@app.put("/api/emails/{email_id}/unflag")
async def api_unflag_email(
    email_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    email = await db_ops.update_email(db, email_id, current_user.id, is_flagged=False)
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    return {"id": email_id, "is_flagged": False}


@app.put("/api/emails/{email_id}/move")
async def api_move_email(
    email_id: str,
    body: MoveEmailRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    success = await db_ops.move_email(db, email_id, current_user.id, body.folder)
    if not success:
        raise HTTPException(status_code=404, detail="Email not found")
    return {"id": email_id, "folder": body.folder}


@app.put("/api/emails/bulk")
async def api_bulk_operations(
    body: BulkOperationRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.ids:
        raise HTTPException(status_code=400, detail="No email IDs provided")

    action = body.action.lower()
    count = 0

    if action == "read":
        count = await db_ops.bulk_update_emails(db, body.ids, current_user.id, is_read=True)
    elif action == "unread":
        count = await db_ops.bulk_update_emails(db, body.ids, current_user.id, is_read=False)
    elif action == "flag":
        count = await db_ops.bulk_update_emails(db, body.ids, current_user.id, is_flagged=True)
    elif action == "unflag":
        count = await db_ops.bulk_update_emails(db, body.ids, current_user.id, is_flagged=False)
    elif action == "delete":
        for eid in body.ids:
            await db_ops.soft_delete_email(db, eid, current_user.id)
            count += 1
    elif action == "move" and body.folder:
        count = await db_ops.bulk_update_emails(db, body.ids, current_user.id, folder=body.folder)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {action}")

    return {"affected": count, "action": action}


@app.delete("/api/emails/{email_id}")
async def api_delete_email(
    email_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    success = await db_ops.soft_delete_email(db, email_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Email not found")
    return {"message": "Email deleted"}


@app.get("/api/emails/{email_id}/attachment/{att_id}")
async def api_get_attachment(
    email_id: str,
    att_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify email ownership
    email = await db_ops.get_email_by_id(db, email_id, current_user.id)
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    att = await db_ops.get_attachment(db, att_id, email_id)
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    return Response(
        content=att.data,
        media_type=att.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{att.filename}"',
            "Content-Length": str(att.size_bytes),
        },
    )


# ─── Contact Endpoints ─────────────────────────────────────────────────────────

@app.get("/api/contacts")
async def api_list_contacts(
    search: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contacts = await db_ops.get_contacts(db, current_user.id, search=search)
    return [
        {
            "id": c.id,
            "name": c.name,
            "email": c.email,
            "phone": c.phone,
            "notes": c.notes,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in contacts
    ]


@app.get("/api/contacts/suggest")
async def api_suggest_contacts(
    q: str = Query(""),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contacts = await db_ops.get_contacts(db, current_user.id, search=q)
    return [{"name": c.name, "email": c.email} for c in contacts[:10]]


@app.post("/api/contacts")
async def api_create_contact(
    body: ContactCreateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contact = await db_ops.create_contact(
        db,
        user_id=current_user.id,
        name=body.name,
        email=body.email,
        phone=body.phone,
        notes=body.notes or "",
    )
    return {
        "id": contact.id,
        "name": contact.name,
        "email": contact.email,
        "phone": contact.phone,
        "notes": contact.notes,
    }


@app.put("/api/contacts/{contact_id}")
async def api_update_contact(
    contact_id: str,
    body: ContactCreateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contact = await db_ops.update_contact(
        db, contact_id, current_user.id,
        name=body.name, email=body.email,
        phone=body.phone, notes=body.notes or ""
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {
        "id": contact.id,
        "name": contact.name,
        "email": contact.email,
        "phone": contact.phone,
        "notes": contact.notes,
    }


@app.delete("/api/contacts/{contact_id}")
async def api_delete_contact(
    contact_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    success = await db_ops.delete_contact(db, contact_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"message": "Contact deleted"}


# ─── Label Endpoints ───────────────────────────────────────────────────────────

@app.get("/api/labels")
async def api_list_labels(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    labels = await db_ops.get_labels(db, current_user.id)
    return [{"id": l.id, "name": l.name, "color": l.color} for l in labels]


@app.post("/api/labels")
async def api_create_label(
    body: LabelCreateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    label = await db_ops.create_label(db, current_user.id, body.name, body.color or "#667eea")
    return {"id": label.id, "name": label.name, "color": label.color}


@app.put("/api/labels/{label_id}")
async def api_update_label(
    label_id: str,
    body: LabelCreateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    label = await db_ops.update_label(
        db, label_id, current_user.id,
        name=body.name, color=body.color or "#667eea"
    )
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")
    return {"id": label.id, "name": label.name, "color": label.color}


@app.delete("/api/labels/{label_id}")
async def api_delete_label(
    label_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    success = await db_ops.delete_label(db, label_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Label not found")
    return {"message": "Label deleted"}


@app.post("/api/emails/{email_id}/labels/{label_id}")
async def api_add_email_label(
    email_id: str,
    label_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    email = await db_ops.get_email_by_id(db, email_id, current_user.id)
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    await db_ops.add_email_label(db, email_id, label_id)
    return {"message": "Label added"}


@app.delete("/api/emails/{email_id}/labels/{label_id}")
async def api_remove_email_label(
    email_id: str,
    label_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db_ops.remove_email_label(db, email_id, label_id)
    return {"message": "Label removed"}


# ─── Settings Endpoints ────────────────────────────────────────────────────────

@app.get("/api/settings")
async def api_get_settings(current_user=Depends(get_current_user)):
    return {
        "display_name": current_user.display_name,
        "email": current_user.email,
        "signature": current_user.signature or "",
        "avatar_color": current_user.avatar_color,
        "quota_bytes": current_user.quota_bytes,
        "used_bytes": current_user.used_bytes,
    }


@app.put("/api/settings")
async def api_update_settings(
    body: SettingsUpdateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    updates = {}
    if body.display_name is not None:
        updates["display_name"] = body.display_name.strip()
    if body.signature is not None:
        updates["signature"] = sanitize_html(body.signature)

    if updates:
        await db_ops.update_user(db, current_user.id, **updates)

    updated = await db_ops.get_user_by_id(db, current_user.id)
    return serialize_user(updated)


# ─── Admin Endpoints ───────────────────────────────────────────────────────────

@app.get("/api/admin/users")
async def api_admin_list_users(
    skip: int = 0,
    limit: int = 100,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    users = await db_ops.get_all_users(db, skip=skip, limit=limit)
    return [serialize_user(u) for u in users]


@app.post("/api/admin/users")
async def api_admin_create_user(
    body: AdminUserCreateRequest,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = await db_ops.get_user_by_email(db, body.email)
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    valid, msg = validate_password_strength(body.password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    quota = (body.quota_mb or config.DEFAULT_QUOTA_MB) * 1024 * 1024
    user = await db_ops.create_user(
        db,
        email=body.email,
        password_hash=hash_password(body.password),
        display_name=body.display_name,
        is_admin=body.is_admin or False,
        quota_bytes=quota,
    )
    return serialize_user(user)


@app.put("/api/admin/users/{user_id}")
async def api_admin_update_user(
    user_id: str,
    body: AdminUserUpdateRequest,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    updates = {}
    if body.display_name is not None:
        updates["display_name"] = body.display_name
    if body.is_admin is not None:
        updates["is_admin"] = body.is_admin
    if body.is_active is not None:
        updates["is_active"] = body.is_active
    if body.quota_mb is not None:
        updates["quota_bytes"] = body.quota_mb * 1024 * 1024

    user = await db_ops.update_user(db, user_id, **updates)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return serialize_user(user)


@app.delete("/api/admin/users/{user_id}")
async def api_admin_delete_user(
    user_id: str,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    success = await db_ops.delete_user(db, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}


@app.get("/api/admin/stats")
async def api_admin_stats(
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    stats = await db_ops.get_server_stats(db)
    stats["domain"] = config.DOMAIN
    stats["smtp_port"] = config.SMTP_PORT
    stats["imap_port"] = config.IMAP_PORT
    stats["web_port"] = config.WEB_PORT
    return stats


@app.get("/api/admin/queue")
async def api_admin_queue(admin=Depends(get_current_admin)):
    # In production, this would show queued messages waiting for relay
    return {"queue": [], "total": 0}


@app.post("/api/admin/users/{user_id}/reset-password")
async def api_admin_reset_password(
    user_id: str,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    import secrets as _secrets
    new_pass = _secrets.token_urlsafe(12)
    await db_ops.update_user(db, user_id, password_hash=hash_password(new_pass))
    return {"new_password": new_pass, "message": "Password reset successfully"}


# ─── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    if not token:
        await websocket.close(code=4001)
        return

    from auth import decode_token
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=4001)
        return

    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=4001)
        return

    await ws_manager.connect(websocket, user_id)
    try:
        # Send initial connection confirmation
        await websocket.send_json({"type": "connected", "user_id": user_id})

        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                # Handle ping/pong
                if data == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                # Send keepalive
                try:
                    await websocket.send_json({"type": "keepalive"})
                except Exception:
                    break
            except WebSocketDisconnect:
                break
    except Exception as e:
        logger.debug(f"WebSocket error: {e}")
    finally:
        ws_manager.disconnect(websocket, user_id)


# ─── Health check ──────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "server": config.COMPANY_NAME,
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ─── Static file serving ───────────────────────────────────────────────────────

static_dir = config.STATIC_DIR

if static_dir.exists():
    # Mount static assets
    css_dir = static_dir / "css"
    js_dir = static_dir / "js"
    if css_dir.exists():
        app.mount("/css", StaticFiles(directory=str(css_dir)), name="css")
    if js_dir.exists():
        app.mount("/js", StaticFiles(directory=str(js_dir)), name="js")


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa(full_path: str):
    """Serve the SPA index.html for all non-API routes."""
    index_file = config.STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return HTMLResponse(
        "<h1>Mail Server Running</h1><p>Static files not found. Please check your setup.</p>"
    )
