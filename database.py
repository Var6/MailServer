"""
Database layer using Motor (async MongoDB driver).
Collections: users, emails, contacts, labels, sessions
Attachments: stored via GridFS (supports files up to 25 MB+)
"""
import io
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorGridFSBucket
from pymongo import ASCENDING, DESCENDING, TEXT

from config import config

logger = logging.getLogger(__name__)

# ── Module-level singletons ────────────────────────────────────────────────────
_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None
_gridfs: Optional[AsyncIOMotorGridFSBucket] = None


async def init_db():
    """Connect to MongoDB, create indexes, ensure admin user exists."""
    global _client, _db, _gridfs

    _client = AsyncIOMotorClient(config.MONGODB_URI, serverSelectionTimeoutMS=5000)

    # Verify connection
    await _client.admin.command("ping")
    logger.info("MongoDB connected: %s", config.MONGODB_URI)

    _db = _client[config.MONGODB_DB_NAME]
    _gridfs = AsyncIOMotorGridFSBucket(_db, bucket_name="attachments")

    # ── Indexes ────────────────────────────────────────────────────────────────
    await _db.users.create_index("email", unique=True)
    await _db.users.create_index("is_admin")

    await _db.emails.create_index([("user_id", ASCENDING), ("folder", ASCENDING)])
    await _db.emails.create_index([("user_id", ASCENDING), ("is_read", ASCENDING)])
    await _db.emails.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    await _db.emails.create_index("message_id")
    await _db.emails.create_index("thread_id")
    await _db.emails.create_index([("subject", TEXT), ("from_addr", TEXT), ("body_text", TEXT)])

    await _db.sessions.create_index("token_hash", unique=True)
    await _db.sessions.create_index("expires_at", expireAfterSeconds=0)  # TTL auto-delete

    await _db.contacts.create_index([("user_id", ASCENDING), ("name", ASCENDING)])
    await _db.contacts.create_index([("user_id", ASCENDING), ("email", ASCENDING)])

    await _db.labels.create_index([("user_id", ASCENDING), ("name", ASCENDING)])

    logger.info("MongoDB indexes created/verified.")


def get_db() -> AsyncIOMotorDatabase:
    """Return the active Motor database (used as FastAPI dependency)."""
    return _db


def get_gridfs() -> AsyncIOMotorGridFSBucket:
    """Return the GridFS bucket for attachments."""
    return _gridfs


async def close_db():
    """Close MongoDB connection."""
    global _client
    if _client:
        _client.close()
        logger.info("MongoDB connection closed.")


# ── Helpers ────────────────────────────────────────────────────────────────────

def _new_id() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _avatar_color(email: str) -> str:
    palette = ["#667eea", "#764ba2", "#f093fb", "#4facfe", "#43e97b",
               "#fa709a", "#fee140", "#30cfd0", "#a18cd1", "#fda085"]
    return palette[hash(email) % len(palette)]


# ── User CRUD ──────────────────────────────────────────────────────────────────

async def create_user(
    db: AsyncIOMotorDatabase,
    email: str,
    password_hash: str,
    display_name: str,
    is_admin: bool = False,
    quota_bytes: int = None,
) -> Dict:
    quota = quota_bytes or (config.DEFAULT_QUOTA_MB * 1024 * 1024)
    doc = {
        "_id": _new_id(),
        "email": email,
        "password_hash": password_hash,
        "display_name": display_name,
        "avatar_color": _avatar_color(email),
        "avatar_data": None,
        "avatar_mime": None,
        "quota_bytes": quota,
        "used_bytes": 0,
        "is_admin": is_admin,
        "is_active": True,
        "signature": "",
        "created_at": _now(),
        "last_login": None,
    }
    await db.users.insert_one(doc)
    return _user_out(doc)


async def get_user_by_email(db: AsyncIOMotorDatabase, email: str) -> Optional[Dict]:
    doc = await db.users.find_one({"email": email})
    return _user_out(doc) if doc else None


async def get_user_by_id(db: AsyncIOMotorDatabase, user_id: str) -> Optional[Dict]:
    doc = await db.users.find_one({"_id": user_id})
    return _user_out(doc) if doc else None


async def get_all_users(
    db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 100
) -> List[Dict]:
    cursor = db.users.find({}).sort("created_at", ASCENDING).skip(skip).limit(limit)
    return [_user_out(d) async for d in cursor]


async def update_user(
    db: AsyncIOMotorDatabase, user_id: str, **kwargs
) -> Optional[Dict]:
    await db.users.update_one({"_id": user_id}, {"$set": kwargs})
    return await get_user_by_id(db, user_id)


async def delete_user(db: AsyncIOMotorDatabase, user_id: str) -> bool:
    result = await db.users.delete_one({"_id": user_id})
    return result.deleted_count > 0


async def update_user_login(db: AsyncIOMotorDatabase, user_id: str):
    await db.users.update_one(
        {"_id": user_id}, {"$set": {"last_login": _now()}}
    )


async def update_user_quota_usage(
    db: AsyncIOMotorDatabase, user_id: str, delta_bytes: int
):
    await db.users.update_one(
        {"_id": user_id}, {"$inc": {"used_bytes": delta_bytes}}
    )


def _user_out(doc: Optional[Dict]) -> Optional[Dict]:
    if doc is None:
        return None
    out = dict(doc)
    out["id"] = out.pop("_id")
    return out


# ── Email CRUD ─────────────────────────────────────────────────────────────────

async def create_email(
    db: AsyncIOMotorDatabase,
    user_id: str,
    folder: str,
    from_addr: str,
    to_addrs: List[str],
    subject: str,
    body_text: str = "",
    body_html: str = "",
    cc: List[str] = None,
    bcc: List[str] = None,
    reply_to: str = None,
    message_id: str = None,
    raw_message: str = None,
    size_bytes: int = 0,
    is_read: bool = False,
    thread_id: str = None,
    spam_score: int = 0,
) -> Dict:
    eid = _new_id()
    if not message_id:
        message_id = f"<{eid}@{config.DOMAIN}>"
    if not thread_id:
        thread_id = _new_id()

    doc = {
        "_id": eid,
        "message_id": message_id,
        "user_id": user_id,
        "folder": folder,
        "from_addr": from_addr,
        "to_addrs": to_addrs or [],
        "cc": cc or [],
        "bcc": bcc or [],
        "reply_to": reply_to,
        "subject": subject or "(no subject)",
        "body_text": body_text,
        "body_html": body_html,
        "raw_message": raw_message,
        "size_bytes": size_bytes,
        "is_read": is_read,
        "is_flagged": False,
        "is_deleted": False,
        "has_attachments": False,
        "attachment_ids": [],   # GridFS file IDs
        "thread_id": thread_id,
        "spam_score": spam_score,
        "created_at": _now(),
    }
    await db.emails.insert_one(doc)
    return _email_out(doc)


async def get_emails(
    db: AsyncIOMotorDatabase,
    user_id: str,
    folder: str = "INBOX",
    page: int = 1,
    limit: int = 50,
    search: str = None,
    label_id: str = None,
    unread_only: bool = False,
) -> Dict[str, Any]:
    query: Dict[str, Any] = {
        "user_id": user_id,
        "folder": folder,
        "is_deleted": False,
    }

    if unread_only:
        query["is_read"] = False

    if search:
        query["$text"] = {"$search": search}

    if label_id:
        query["label_ids"] = label_id

    total = await db.emails.count_documents(query)
    skip = (page - 1) * limit

    cursor = (
        db.emails.find(query, {"raw_message": 0})
        .sort("created_at", DESCENDING)
        .skip(skip)
        .limit(limit)
    )
    emails = [_email_out(d) async for d in cursor]

    # Attach label info to each email
    for em in emails:
        em["labels"] = await _get_email_labels(db, em["label_ids"])
        em["attachments"] = await _get_attachment_meta(db, em["attachment_ids"])

    return {"emails": emails, "total": total, "page": page, "limit": limit}


async def get_email_by_id(
    db: AsyncIOMotorDatabase, email_id: str, user_id: str
) -> Optional[Dict]:
    doc = await db.emails.find_one({"_id": email_id, "user_id": user_id})
    if not doc:
        return None
    out = _email_out(doc)
    out["labels"] = await _get_email_labels(db, out["label_ids"])
    out["attachments"] = await _get_attachment_meta(db, out["attachment_ids"])
    return out


async def get_thread_emails(
    db: AsyncIOMotorDatabase, thread_id: str, user_id: str
) -> List[Dict]:
    cursor = db.emails.find(
        {"thread_id": thread_id, "user_id": user_id, "is_deleted": False},
        {"raw_message": 0},
    ).sort("created_at", ASCENDING)
    results = []
    async for d in cursor:
        out = _email_out(d)
        out["attachments"] = await _get_attachment_meta(db, out["attachment_ids"])
        results.append(out)
    return results


async def update_email(
    db: AsyncIOMotorDatabase, email_id: str, user_id: str, **kwargs
) -> Optional[Dict]:
    await db.emails.update_one(
        {"_id": email_id, "user_id": user_id}, {"$set": kwargs}
    )
    return await get_email_by_id(db, email_id, user_id)


async def move_email(
    db: AsyncIOMotorDatabase, email_id: str, user_id: str, folder: str
) -> bool:
    result = await db.emails.update_one(
        {"_id": email_id, "user_id": user_id}, {"$set": {"folder": folder}}
    )
    return result.modified_count > 0


async def bulk_update_emails(
    db: AsyncIOMotorDatabase, email_ids: List[str], user_id: str, **kwargs
) -> int:
    result = await db.emails.update_many(
        {"_id": {"$in": email_ids}, "user_id": user_id}, {"$set": kwargs}
    )
    return result.modified_count


async def soft_delete_email(
    db: AsyncIOMotorDatabase, email_id: str, user_id: str
) -> bool:
    doc = await db.emails.find_one({"_id": email_id, "user_id": user_id})
    if not doc:
        return False
    if doc.get("folder") == "Trash":
        # Hard delete — also remove attachments from GridFS
        for att_id in doc.get("attachment_ids", []):
            try:
                gridfs = get_gridfs()
                await gridfs.delete(att_id)
            except Exception:
                pass
        await db.emails.delete_one({"_id": email_id})
    else:
        await db.emails.update_one(
            {"_id": email_id, "user_id": user_id},
            {"$set": {"folder": "Trash"}}
        )
    return True


async def get_unread_counts(
    db: AsyncIOMotorDatabase, user_id: str
) -> Dict[str, int]:
    pipeline = [
        {"$match": {"user_id": user_id, "is_read": False, "is_deleted": False}},
        {"$group": {"_id": "$folder", "count": {"$sum": 1}}},
    ]
    result = {}
    async for doc in db.emails.aggregate(pipeline):
        result[doc["_id"]] = doc["count"]
    return result


async def get_folder_counts(
    db: AsyncIOMotorDatabase, user_id: str
) -> Dict[str, int]:
    pipeline = [
        {"$match": {"user_id": user_id, "is_deleted": False}},
        {"$group": {"_id": "$folder", "count": {"$sum": 1}}},
    ]
    result = {}
    async for doc in db.emails.aggregate(pipeline):
        result[doc["_id"]] = doc["count"]
    return result


def _email_out(doc: Dict) -> Dict:
    out = dict(doc)
    out["id"] = out.pop("_id")
    if isinstance(out.get("created_at"), datetime):
        out["created_at"] = out["created_at"].isoformat()
    out.setdefault("label_ids", [])
    out.setdefault("attachment_ids", [])
    return out


async def _get_email_labels(
    db: AsyncIOMotorDatabase, label_ids: List[str]
) -> List[Dict]:
    if not label_ids:
        return []
    cursor = db.labels.find({"_id": {"$in": label_ids}})
    return [{"id": d["_id"], "name": d["name"], "color": d["color"]} async for d in cursor]


# ── Attachment CRUD (GridFS) ───────────────────────────────────────────────────

async def create_attachment(
    db: AsyncIOMotorDatabase,
    email_id: str,
    filename: str,
    content_type: str,
    data: bytes,
) -> Dict:
    gridfs = get_gridfs()
    meta = {
        "email_id": email_id,
        "filename": filename,
        "content_type": content_type,
        "size_bytes": len(data),
    }
    file_id = await gridfs.upload_from_stream(
        filename, io.BytesIO(data), metadata=meta
    )
    # Store the string representation of the GridFS file ID in the email doc
    file_id_str = str(file_id)
    await db.emails.update_one(
        {"_id": email_id},
        {
            "$push": {"attachment_ids": file_id_str},
            "$set": {"has_attachments": True},
        }
    )
    return {
        "id": file_id_str,
        "email_id": email_id,
        "filename": filename,
        "content_type": content_type,
        "size_bytes": len(data),
    }


async def get_attachment(
    db: AsyncIOMotorDatabase, att_id: str, email_id: str
) -> Optional[Dict]:
    """Return attachment metadata + binary data."""
    from bson import ObjectId
    try:
        oid = ObjectId(att_id)
    except Exception:
        return None
    gridfs = get_gridfs()
    try:
        grid_out = await gridfs.open_download_stream(oid)
        data = await grid_out.read()
        meta = grid_out.metadata or {}
        return {
            "id": att_id,
            "email_id": meta.get("email_id", email_id),
            "filename": grid_out.filename,
            "content_type": meta.get("content_type", "application/octet-stream"),
            "size_bytes": len(data),
            "data": data,
        }
    except Exception:
        return None


async def _get_attachment_meta(
    db: AsyncIOMotorDatabase, att_ids: List[str]
) -> List[Dict]:
    """Return attachment metadata (no binary data) for email listings."""
    if not att_ids:
        return []
    from bson import ObjectId
    result = []
    for att_id in att_ids:
        try:
            oid = ObjectId(att_id)
            cursor = db["attachments.files"].find({"_id": oid})
            async for doc in cursor:
                meta = doc.get("metadata", {})
                result.append({
                    "id": att_id,
                    "filename": doc.get("filename", "file"),
                    "content_type": meta.get("content_type", "application/octet-stream"),
                    "size_bytes": doc.get("length", 0),
                })
        except Exception:
            pass
    return result


# ── Contact CRUD ───────────────────────────────────────────────────────────────

async def create_contact(
    db: AsyncIOMotorDatabase,
    user_id: str,
    name: str,
    email: str,
    phone: str = None,
    notes: str = "",
) -> Dict:
    doc = {
        "_id": _new_id(),
        "user_id": user_id,
        "name": name,
        "email": email,
        "phone": phone,
        "notes": notes,
        "created_at": _now(),
    }
    await db.contacts.insert_one(doc)
    return _contact_out(doc)


async def get_contacts(
    db: AsyncIOMotorDatabase, user_id: str, search: str = None
) -> List[Dict]:
    query: Dict = {"user_id": user_id}
    if search:
        pattern = {"$regex": search, "$options": "i"}
        query["$or"] = [{"name": pattern}, {"email": pattern}]
    cursor = db.contacts.find(query).sort("name", ASCENDING)
    return [_contact_out(d) async for d in cursor]


async def update_contact(
    db: AsyncIOMotorDatabase, contact_id: str, user_id: str, **kwargs
) -> Optional[Dict]:
    await db.contacts.update_one(
        {"_id": contact_id, "user_id": user_id}, {"$set": kwargs}
    )
    doc = await db.contacts.find_one({"_id": contact_id})
    return _contact_out(doc) if doc else None


async def delete_contact(
    db: AsyncIOMotorDatabase, contact_id: str, user_id: str
) -> bool:
    result = await db.contacts.delete_one({"_id": contact_id, "user_id": user_id})
    return result.deleted_count > 0


def _contact_out(doc: Dict) -> Dict:
    out = dict(doc)
    out["id"] = out.pop("_id")
    if isinstance(out.get("created_at"), datetime):
        out["created_at"] = out["created_at"].isoformat()
    return out


# ── Label CRUD ─────────────────────────────────────────────────────────────────

async def create_label(
    db: AsyncIOMotorDatabase, user_id: str, name: str, color: str = "#667eea"
) -> Dict:
    doc = {"_id": _new_id(), "user_id": user_id, "name": name, "color": color}
    await db.labels.insert_one(doc)
    return _label_out(doc)


async def get_labels(db: AsyncIOMotorDatabase, user_id: str) -> List[Dict]:
    cursor = db.labels.find({"user_id": user_id}).sort("name", ASCENDING)
    return [_label_out(d) async for d in cursor]


async def get_label_by_id(
    db: AsyncIOMotorDatabase, label_id: str, user_id: str
) -> Optional[Dict]:
    doc = await db.labels.find_one({"_id": label_id, "user_id": user_id})
    return _label_out(doc) if doc else None


async def update_label(
    db: AsyncIOMotorDatabase, label_id: str, user_id: str, **kwargs
) -> Optional[Dict]:
    await db.labels.update_one(
        {"_id": label_id, "user_id": user_id}, {"$set": kwargs}
    )
    return await get_label_by_id(db, label_id, user_id)


async def delete_label(
    db: AsyncIOMotorDatabase, label_id: str, user_id: str
) -> bool:
    result = await db.labels.delete_one({"_id": label_id, "user_id": user_id})
    if result.deleted_count:
        # Remove label from all emails
        await db.emails.update_many(
            {"label_ids": label_id}, {"$pull": {"label_ids": label_id}}
        )
    return result.deleted_count > 0


async def add_email_label(
    db: AsyncIOMotorDatabase, email_id: str, label_id: str
) -> bool:
    result = await db.emails.update_one(
        {"_id": email_id}, {"$addToSet": {"label_ids": label_id}}
    )
    return result.modified_count > 0


async def remove_email_label(
    db: AsyncIOMotorDatabase, email_id: str, label_id: str
) -> bool:
    result = await db.emails.update_one(
        {"_id": email_id}, {"$pull": {"label_ids": label_id}}
    )
    return result.modified_count > 0


def _label_out(doc: Dict) -> Dict:
    out = dict(doc)
    out["id"] = out.pop("_id")
    return out


# ── Session CRUD ───────────────────────────────────────────────────────────────

async def create_session(
    db: AsyncIOMotorDatabase,
    user_id: str,
    token_hash: str,
    ip_address: str,
    user_agent: str,
    expires_at: datetime,
) -> Dict:
    doc = {
        "_id": _new_id(),
        "user_id": user_id,
        "token_hash": token_hash,
        "ip_address": ip_address,
        "user_agent": user_agent,
        "created_at": _now(),
        "expires_at": expires_at,
        "is_active": True,
    }
    await db.sessions.insert_one(doc)
    return doc


async def get_session_by_token_hash(
    db: AsyncIOMotorDatabase, token_hash: str
) -> Optional[Dict]:
    doc = await db.sessions.find_one(
        {
            "token_hash": token_hash,
            "is_active": True,
            "expires_at": {"$gt": _now()},
        }
    )
    if not doc:
        return None
    # Attach user
    user = await get_user_by_id(db, doc["user_id"])
    if user:
        doc["user"] = user
    return doc


async def invalidate_session(db: AsyncIOMotorDatabase, token_hash: str) -> bool:
    result = await db.sessions.update_one(
        {"token_hash": token_hash}, {"$set": {"is_active": False}}
    )
    return result.modified_count > 0


async def invalidate_user_sessions(db: AsyncIOMotorDatabase, user_id: str) -> int:
    result = await db.sessions.update_many(
        {"user_id": user_id}, {"$set": {"is_active": False}}
    )
    return result.modified_count


# ── Statistics ─────────────────────────────────────────────────────────────────

async def get_server_stats(db: AsyncIOMotorDatabase) -> Dict[str, Any]:
    user_count = await db.users.count_documents({})
    active_users = await db.users.count_documents({"is_active": True})
    email_count = await db.emails.count_documents({})

    pipeline = [{"$group": {"_id": None, "total": {"$sum": "$used_bytes"}}}]
    storage_result = []
    async for doc in db.users.aggregate(pipeline):
        storage_result.append(doc)
    total_storage = storage_result[0]["total"] if storage_result else 0

    return {
        "total_users": user_count,
        "active_users": active_users,
        "total_emails": email_count,
        "total_storage_bytes": total_storage,
    }


# ── Serializers (kept for web_app.py compatibility) ───────────────────────────

def serialize_email(email: Dict) -> Dict:
    """Pass-through — emails are already plain dicts from MongoDB."""
    return email


def serialize_user(user: Dict, include_sensitive: bool = False) -> Dict:
    """Return user dict without password hash."""
    if not user:
        return {}
    out = {k: v for k, v in user.items() if k != "password_hash"}
    out.setdefault("has_avatar", bool(user.get("avatar_data")))
    if isinstance(out.get("created_at"), datetime):
        out["created_at"] = out["created_at"].isoformat()
    if isinstance(out.get("last_login"), datetime):
        out["last_login"] = out["last_login"].isoformat()
    return out
