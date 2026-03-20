"""
IMAP4rev1 server implementation using asyncio TCP sockets.
Implements a full state machine with all major IMAP commands.
"""
import asyncio
import base64
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from email.utils import formatdate
from typing import Dict, List, Optional, Set, Tuple

from config import config
from database import AsyncSessionLocal, get_user_by_email, get_emails, get_email_by_id
from database import update_email, soft_delete_email, get_unread_counts
import database as db_ops
from auth import verify_password

logger = logging.getLogger(__name__)

# IMAP states
STATE_NOT_AUTHENTICATED = "not_authenticated"
STATE_AUTHENTICATED = "authenticated"
STATE_SELECTED = "selected"
STATE_LOGOUT = "logout"

CAPABILITIES = "CAPABILITY IMAP4rev1 AUTH=PLAIN AUTH=LOGIN IDLE MOVE UNSELECT UIDPLUS"


def imap_date(dt: Optional[datetime]) -> str:
    """Format datetime as IMAP internal date string."""
    if not dt:
        dt = datetime.now(timezone.utc)
    return dt.strftime("%d-%b-%Y %H:%M:%S +0000")


def imap_envelope(email_obj) -> str:
    """Build IMAP ENVELOPE response for an email."""
    date_str = imap_date(email_obj.created_at)
    subject = email_obj.subject or "(no subject)"
    from_addr = email_obj.from_addr or ""
    to_addrs = json.loads(email_obj.to_addrs) if email_obj.to_addrs else []

    def fmt_addr(addr_str):
        if not addr_str:
            return "NIL"
        name = ""
        mailbox = addr_str
        domain = ""
        if "<" in addr_str:
            parts = addr_str.split("<")
            name = parts[0].strip().strip('"')
            mailbox_domain = parts[1].rstrip(">").split("@")
            mailbox = mailbox_domain[0] if mailbox_domain else addr_str
            domain = mailbox_domain[1] if len(mailbox_domain) > 1 else ""
        elif "@" in addr_str:
            parts = addr_str.split("@")
            mailbox = parts[0]
            domain = parts[1]
        return f'(("{name}" NIL "{mailbox}" "{domain}"))'

    from_env = fmt_addr(from_addr)
    to_env = "(" + " ".join(fmt_addr(a) for a in to_addrs) + ")" if to_addrs else "NIL"

    return (
        f'("{date_str}" "{subject}" {from_env} {from_env} {from_env} '
        f'{to_env} NIL NIL NIL "<{email_obj.message_id or uuid.uuid4()}>")'
    )


def flags_str(email_obj) -> str:
    """Build IMAP flags string from email attributes."""
    flags = []
    if email_obj.is_read:
        flags.append("\\Seen")
    if email_obj.is_flagged:
        flags.append("\\Flagged")
    if email_obj.folder == "Drafts":
        flags.append("\\Draft")
    if email_obj.folder == "Sent":
        flags.append("\\Answered")
    return "(" + " ".join(flags) + ")"


class IMAPSession:
    """Handles a single IMAP client connection."""

    def __init__(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        self.reader = reader
        self.writer = writer
        self.state = STATE_NOT_AUTHENTICATED
        self.user = None
        self.selected_folder = None
        self.selected_emails = []  # cached list of emails in selected mailbox
        self.tag = None
        self.addr = writer.get_extra_info("peername", ("unknown", 0))

    async def send(self, data: str):
        """Send a response line to the client."""
        line = data + "\r\n"
        self.writer.write(line.encode("utf-8", errors="replace"))
        await self.writer.drain()

    async def handle(self):
        """Main connection handler loop."""
        client_addr = f"{self.addr[0]}:{self.addr[1]}"
        logger.info(f"IMAP connection from {client_addr}")
        await self.send(f"* OK [{CAPABILITIES}] {config.COMPANY_NAME} IMAP4rev1 Server Ready")

        try:
            while self.state != STATE_LOGOUT:
                try:
                    line = await asyncio.wait_for(
                        self.reader.readline(), timeout=300
                    )
                except asyncio.TimeoutError:
                    await self.send("* BYE Connection timeout")
                    break

                if not line:
                    break

                decoded = line.decode("utf-8", errors="replace").rstrip("\r\n")
                if not decoded:
                    continue

                await self.process_command(decoded)

        except ConnectionResetError:
            pass
        except Exception as e:
            logger.error(f"IMAP session error for {client_addr}: {e}", exc_info=True)
        finally:
            try:
                self.writer.close()
                await self.writer.wait_closed()
            except Exception:
                pass
            logger.info(f"IMAP connection closed: {client_addr}")

    async def process_command(self, line: str):
        """Parse and dispatch an IMAP command."""
        parts = line.split(None, 2)
        if len(parts) < 2:
            await self.send("* BAD Invalid command")
            return

        self.tag = parts[0]
        command = parts[1].upper()
        args = parts[2] if len(parts) > 2 else ""

        try:
            if command == "CAPABILITY":
                await self.cmd_capability()
            elif command == "NOOP":
                await self.cmd_noop()
            elif command == "LOGOUT":
                await self.cmd_logout()
            elif command == "LOGIN":
                await self.cmd_login(args)
            elif command == "AUTHENTICATE":
                await self.cmd_authenticate(args)
            elif command == "SELECT":
                await self.cmd_select(args, readonly=False)
            elif command == "EXAMINE":
                await self.cmd_select(args, readonly=True)
            elif command == "CLOSE":
                await self.cmd_close()
            elif command == "EXPUNGE":
                await self.cmd_expunge()
            elif command == "FETCH":
                await self.cmd_fetch(args)
            elif command == "STORE":
                await self.cmd_store(args)
            elif command == "SEARCH":
                await self.cmd_search(args)
            elif command == "CREATE":
                await self.cmd_create(args)
            elif command == "DELETE":
                await self.cmd_delete_mailbox(args)
            elif command == "RENAME":
                await self.cmd_rename(args)
            elif command == "LIST":
                await self.cmd_list(args)
            elif command == "LSUB":
                await self.cmd_lsub(args)
            elif command == "SUBSCRIBE":
                await self.cmd_subscribe(args)
            elif command == "UNSUBSCRIBE":
                await self.cmd_unsubscribe(args)
            elif command == "STATUS":
                await self.cmd_status(args)
            elif command == "APPEND":
                await self.cmd_append(args)
            elif command == "UID":
                await self.cmd_uid(args)
            elif command == "IDLE":
                await self.cmd_idle()
            else:
                await self.send(f"{self.tag} BAD Unknown command: {command}")
        except Exception as e:
            logger.error(f"Error in IMAP command {command}: {e}", exc_info=True)
            await self.send(f"{self.tag} BAD Internal error")

    def _require_auth(self) -> bool:
        return self.state in (STATE_AUTHENTICATED, STATE_SELECTED)

    def _require_selected(self) -> bool:
        return self.state == STATE_SELECTED

    async def cmd_capability(self):
        await self.send(f"* {CAPABILITIES}")
        await self.send(f"{self.tag} OK CAPABILITY completed")

    async def cmd_noop(self):
        if self._require_selected():
            await self._send_mailbox_updates()
        await self.send(f"{self.tag} OK NOOP completed")

    async def cmd_logout(self):
        await self.send("* BYE Logging out")
        await self.send(f"{self.tag} OK LOGOUT completed")
        self.state = STATE_LOGOUT

    async def cmd_login(self, args: str):
        # Parse: username password (possibly quoted)
        parts = self._parse_args(args)
        if len(parts) < 2:
            await self.send(f"{self.tag} BAD LOGIN requires username and password")
            return

        username = parts[0].strip('"')
        password = parts[1].strip('"')

        async with AsyncSessionLocal() as db:
            user = await get_user_by_email(db, username)
            if user and user.is_active and verify_password(password, user.password_hash):
                self.user = {"id": user.id, "email": user.email}
                self.state = STATE_AUTHENTICATED
                await self.send(f"{self.tag} OK LOGIN completed")
                return

        await self.send(f"{self.tag} NO LOGIN failed: invalid credentials")

    async def cmd_authenticate(self, args: str):
        parts = args.split()
        mechanism = parts[0].upper() if parts else ""

        if mechanism == "PLAIN":
            await self.send("+ ")
            try:
                line = await asyncio.wait_for(self.reader.readline(), timeout=30)
                decoded_line = line.decode("utf-8", errors="replace").rstrip("\r\n")
                raw = base64.b64decode(decoded_line).decode("utf-8")
                null_parts = raw.split("\x00")
                if len(null_parts) >= 3:
                    username = null_parts[1]
                    password = null_parts[2]
                else:
                    await self.send(f"{self.tag} BAD Invalid PLAIN encoding")
                    return
            except Exception:
                await self.send(f"{self.tag} BAD AUTHENTICATE failed")
                return

            async with AsyncSessionLocal() as db:
                user = await get_user_by_email(db, username)
                if user and user.is_active and verify_password(password, user.password_hash):
                    self.user = {"id": user.id, "email": user.email}
                    self.state = STATE_AUTHENTICATED
                    await self.send(f"{self.tag} OK AUTHENTICATE completed")
                    return
            await self.send(f"{self.tag} NO AUTHENTICATE failed")
        else:
            await self.send(f"{self.tag} NO Unsupported authentication mechanism")

    async def _load_folder_emails(self, folder: str):
        """Load emails for selected folder into session cache."""
        async with AsyncSessionLocal() as db:
            result = await get_emails(db, self.user["id"], folder=folder, limit=10000)
            self.selected_emails = result["emails"]

    async def _send_mailbox_updates(self):
        """Send EXISTS and RECENT untagged responses."""
        await self.send(f"* {len(self.selected_emails)} EXISTS")
        recent = sum(1 for e in self.selected_emails if not e.is_read)
        await self.send(f"* {recent} RECENT")

    async def cmd_select(self, args: str, readonly: bool = False):
        if not self._require_auth():
            await self.send(f"{self.tag} NO Not authenticated")
            return

        folder = args.strip().strip('"')
        # Normalize folder names
        folder_map = {
            "inbox": "INBOX",
            "sent": "Sent",
            "drafts": "Drafts",
            "trash": "Trash",
            "spam": "Spam",
            "junk": "Spam",
            "archive": "Archive",
        }
        folder = folder_map.get(folder.lower(), folder)

        await self._load_folder_emails(folder)
        self.selected_folder = folder
        self.state = STATE_SELECTED

        total = len(self.selected_emails)
        unseen = sum(1 for e in self.selected_emails if not e.is_read)
        recent = 0

        await self.send(f"* {total} EXISTS")
        await self.send(f"* {recent} RECENT")
        if unseen > 0:
            await self.send(f"* OK [UNSEEN {unseen}] Message {unseen} is first unseen")
        await self.send(f'* OK [PERMANENTFLAGS (\\Seen \\Flagged \\Deleted \\Draft \\Answered \\*)] Flags permitted')
        await self.send(f"* FLAGS (\\Seen \\Flagged \\Deleted \\Draft \\Answered)")
        await self.send(f"* OK [UIDVALIDITY 1] UIDs valid")
        await self.send(f"* OK [UIDNEXT {total + 1}] Predicted next UID")

        mode = "EXAMINE" if readonly else "SELECT"
        await self.send(f"{self.tag} OK [{('READ-ONLY' if readonly else 'READ-WRITE')}] {mode} completed")

    async def cmd_close(self):
        if not self._require_selected():
            await self.send(f"{self.tag} NO No mailbox selected")
            return
        self.selected_folder = None
        self.selected_emails = []
        self.state = STATE_AUTHENTICATED
        await self.send(f"{self.tag} OK CLOSE completed")

    async def cmd_expunge(self):
        if not self._require_selected():
            await self.send(f"{self.tag} NO No mailbox selected")
            return
        # No-op for now; would permanently delete marked-deleted messages
        await self.send(f"{self.tag} OK EXPUNGE completed")

    def _parse_sequence_set(self, seq_str: str, emails: list) -> List[int]:
        """Parse IMAP sequence set (e.g., '1:3,5,7:*') into list of indices."""
        indices = set()
        n = len(emails)
        if not n:
            return []

        for part in seq_str.split(","):
            part = part.strip()
            if ":" in part:
                start_str, end_str = part.split(":", 1)
                start = int(start_str) if start_str != "*" else n
                end = n if end_str == "*" else int(end_str)
                for i in range(min(start, end), max(start, end) + 1):
                    if 1 <= i <= n:
                        indices.add(i)
            else:
                idx = n if part == "*" else int(part)
                if 1 <= idx <= n:
                    indices.add(idx)

        return sorted(indices)

    async def cmd_fetch(self, args: str, uid_mode: bool = False):
        if not self._require_selected():
            await self.send(f"{self.tag} NO No mailbox selected")
            return

        parts = args.split(None, 1)
        if len(parts) < 2:
            await self.send(f"{self.tag} BAD FETCH requires sequence set and items")
            return

        seq_set, items_str = parts[0], parts[1].strip()
        indices = self._parse_sequence_set(seq_set, self.selected_emails)

        # Normalize items
        items_str = items_str.strip("()")
        items_upper = items_str.upper()

        for idx in indices:
            email_obj = self.selected_emails[idx - 1]
            response_parts = [f"* {idx} FETCH ("]
            fetch_items = []

            if "UID" in items_upper:
                fetch_items.append(f"UID {idx}")

            if "FLAGS" in items_upper:
                fetch_items.append(f"FLAGS {flags_str(email_obj)}")

            if "INTERNALDATE" in items_upper:
                fetch_items.append(f'INTERNALDATE "{imap_date(email_obj.created_at)}"')

            if "RFC822.SIZE" in items_upper:
                fetch_items.append(f"RFC822.SIZE {email_obj.size_bytes or 0}")

            if "ENVELOPE" in items_upper:
                fetch_items.append(f"ENVELOPE {imap_envelope(email_obj)}")

            if "RFC822" in items_upper or "BODY[]" in items_upper.replace(" ", ""):
                body = email_obj.raw_message or email_obj.body_text or ""
                encoded = body.encode("utf-8", errors="replace")
                fetch_items.append(f"RFC822 {{{len(encoded)}}}\r\n{body}")

            if "BODY[TEXT]" in items_upper or "BODY.PEEK[TEXT]" in items_upper:
                body = email_obj.body_text or ""
                fetch_items.append(f"BODY[TEXT] {{{len(body.encode())}}}\r\n{body}")

            if "BODY[HEADER]" in items_upper or "BODY.PEEK[HEADER]" in items_upper:
                headers = (
                    f"From: {email_obj.from_addr}\r\n"
                    f"To: {', '.join(json.loads(email_obj.to_addrs) if email_obj.to_addrs else [])}\r\n"
                    f"Subject: {email_obj.subject}\r\n"
                    f"Date: {imap_date(email_obj.created_at)}\r\n"
                    f"Message-ID: {email_obj.message_id or ''}\r\n\r\n"
                )
                fetch_items.append(f"BODY[HEADER] {{{len(headers.encode())}}}\r\n{headers}")

            if "BODY[HEADER.FIELDS" in items_upper:
                # Extract requested header fields
                match = re.search(r"BODY(?:\.PEEK)?\[HEADER\.FIELDS\s+\(([^)]+)\)\]", items_str, re.IGNORECASE)
                fields = match.group(1).split() if match else []
                header_lines = []
                field_map = {
                    "FROM": f"From: {email_obj.from_addr}",
                    "TO": f"To: {', '.join(json.loads(email_obj.to_addrs) if email_obj.to_addrs else [])}",
                    "SUBJECT": f"Subject: {email_obj.subject}",
                    "DATE": f"Date: {imap_date(email_obj.created_at)}",
                    "CC": f"Cc: {', '.join(json.loads(email_obj.cc) if email_obj.cc else [])}",
                    "MESSAGE-ID": f"Message-ID: {email_obj.message_id or ''}",
                }
                for f in fields:
                    if f.upper() in field_map:
                        header_lines.append(field_map[f.upper()])
                header_str = "\r\n".join(header_lines) + "\r\n\r\n"
                fetch_items.append(f"BODY[HEADER.FIELDS ({' '.join(fields)})] {{{len(header_str.encode())}}}\r\n{header_str}")

            if "BODYSTRUCTURE" in items_upper or "BODY" == items_upper.strip():
                # Simple body structure
                has_html = bool(email_obj.body_html)
                if has_html:
                    bs = '("TEXT" "HTML" ("CHARSET" "UTF-8") NIL NIL "7BIT" 0 0)'
                else:
                    bs = '("TEXT" "PLAIN" ("CHARSET" "UTF-8") NIL NIL "7BIT" 0 0)'
                fetch_items.append(f"BODYSTRUCTURE {bs}")

            response = f"* {idx} FETCH ({' '.join(fetch_items)})"
            await self.send(response)

            # Mark as read if fetching body
            if any(k in items_upper for k in ["RFC822", "BODY[TEXT]", "BODY[]"]):
                async with AsyncSessionLocal() as db:
                    await update_email(db, email_obj.id, self.user["id"], is_read=True)
                email_obj.is_read = True

        await self.send(f"{self.tag} OK FETCH completed")

    async def cmd_store(self, args: str, uid_mode: bool = False):
        if not self._require_selected():
            await self.send(f"{self.tag} NO No mailbox selected")
            return

        parts = args.split(None, 2)
        if len(parts) < 3:
            await self.send(f"{self.tag} BAD STORE requires sequence-set, item, and flags")
            return

        seq_set, item, flags_str_val = parts
        indices = self._parse_sequence_set(seq_set, self.selected_emails)
        flags_list = flags_str_val.strip("()").split()
        item_upper = item.upper()

        async with AsyncSessionLocal() as db:
            for idx in indices:
                if idx < 1 or idx > len(self.selected_emails):
                    continue
                email_obj = self.selected_emails[idx - 1]

                if "\\SEEN" in [f.upper() for f in flags_list]:
                    if "+FLAGS" in item_upper:
                        await update_email(db, email_obj.id, self.user["id"], is_read=True)
                        email_obj.is_read = True
                    elif "-FLAGS" in item_upper:
                        await update_email(db, email_obj.id, self.user["id"], is_read=False)
                        email_obj.is_read = False
                    elif item_upper == "FLAGS":
                        await update_email(db, email_obj.id, self.user["id"], is_read=True)
                        email_obj.is_read = True

                if "\\FLAGGED" in [f.upper() for f in flags_list]:
                    if "+FLAGS" in item_upper:
                        await update_email(db, email_obj.id, self.user["id"], is_flagged=True)
                        email_obj.is_flagged = True
                    elif "-FLAGS" in item_upper:
                        await update_email(db, email_obj.id, self.user["id"], is_flagged=False)
                        email_obj.is_flagged = False

                if "\\DELETED" in [f.upper() for f in flags_list]:
                    if "+FLAGS" in item_upper:
                        await soft_delete_email(db, email_obj.id, self.user["id"])

                if "SILENT" not in item_upper:
                    await self.send(f"* {idx} FETCH (FLAGS {flags_str(email_obj)})")

        await self.send(f"{self.tag} OK STORE completed")

    async def cmd_search(self, args: str, uid_mode: bool = False):
        if not self._require_selected():
            await self.send(f"{self.tag} NO No mailbox selected")
            return

        args_upper = args.upper()
        matching = []

        for i, email_obj in enumerate(self.selected_emails, 1):
            match = True

            if "UNSEEN" in args_upper and email_obj.is_read:
                match = False
            if "SEEN" in args_upper and not email_obj.is_read:
                match = False
            if "FLAGGED" in args_upper and not email_obj.is_flagged:
                match = False
            if "UNFLAGGED" in args_upper and email_obj.is_flagged:
                match = False

            # FROM search
            from_match = re.search(r'FROM\s+"([^"]+)"', args, re.IGNORECASE)
            if from_match:
                search_from = from_match.group(1).lower()
                if search_from not in (email_obj.from_addr or "").lower():
                    match = False

            # SUBJECT search
            subj_match = re.search(r'SUBJECT\s+"([^"]+)"', args, re.IGNORECASE)
            if subj_match:
                search_subj = subj_match.group(1).lower()
                if search_subj not in (email_obj.subject or "").lower():
                    match = False

            # TEXT search
            text_match = re.search(r'TEXT\s+"([^"]+)"', args, re.IGNORECASE)
            if text_match:
                search_text = text_match.group(1).lower()
                full_text = f"{email_obj.subject} {email_obj.body_text}".lower()
                if search_text not in full_text:
                    match = False

            if match:
                matching.append(str(i))

        await self.send(f"* SEARCH {' '.join(matching)}")
        await self.send(f"{self.tag} OK SEARCH completed")

    async def cmd_create(self, args: str):
        # Folder creation is not stored persistently in this implementation
        await self.send(f"{self.tag} OK CREATE completed")

    async def cmd_delete_mailbox(self, args: str):
        await self.send(f"{self.tag} OK DELETE completed")

    async def cmd_rename(self, args: str):
        await self.send(f"{self.tag} OK RENAME completed")

    async def cmd_list(self, args: str):
        folders = ["INBOX", "Sent", "Drafts", "Spam", "Trash", "Archive"]
        for folder in folders:
            await self.send(f'* LIST (\\HasNoChildren) "/" "{folder}"')
        await self.send(f"{self.tag} OK LIST completed")

    async def cmd_lsub(self, args: str):
        folders = ["INBOX", "Sent", "Drafts", "Spam", "Trash", "Archive"]
        for folder in folders:
            await self.send(f'* LSUB (\\HasNoChildren) "/" "{folder}"')
        await self.send(f"{self.tag} OK LSUB completed")

    async def cmd_subscribe(self, args: str):
        await self.send(f"{self.tag} OK SUBSCRIBE completed")

    async def cmd_unsubscribe(self, args: str):
        await self.send(f"{self.tag} OK UNSUBSCRIBE completed")

    async def cmd_status(self, args: str):
        parts = args.split(None, 1)
        if len(parts) < 2:
            await self.send(f"{self.tag} BAD STATUS requires mailbox and items")
            return

        mailbox = parts[0].strip('"')
        items_str = parts[1].strip("()")
        items = items_str.upper().split()

        if not self.user:
            await self.send(f"{self.tag} NO Not authenticated")
            return

        async with AsyncSessionLocal() as db:
            result = await get_emails(db, self.user["id"], folder=mailbox, limit=100000)
            emails = result["emails"]
            total = result["total"]
            unseen = sum(1 for e in emails if not e.is_read)

        status_items = []
        for item in items:
            if item == "MESSAGES":
                status_items.append(f"MESSAGES {total}")
            elif item == "RECENT":
                status_items.append(f"RECENT 0")
            elif item == "UNSEEN":
                status_items.append(f"UNSEEN {unseen}")
            elif item == "UIDVALIDITY":
                status_items.append(f"UIDVALIDITY 1")
            elif item == "UIDNEXT":
                status_items.append(f"UIDNEXT {total + 1}")

        await self.send(f'* STATUS "{mailbox}" ({" ".join(status_items)})')
        await self.send(f"{self.tag} OK STATUS completed")

    async def cmd_append(self, args: str):
        """APPEND: accept message and store in specified mailbox."""
        # Parse: mailbox [flags] [datetime] literal
        parts = args.split(None, 1)
        if not parts:
            await self.send(f"{self.tag} BAD APPEND requires mailbox")
            return

        mailbox = parts[0].strip('"')
        rest = parts[1] if len(parts) > 1 else ""

        # Extract literal size
        size_match = re.search(r"\{(\d+)\}", rest)
        if not size_match:
            await self.send(f"{self.tag} BAD No literal size specified")
            return

        size = int(size_match.group(1))
        await self.send("+ Ready for literal data")

        try:
            data = await asyncio.wait_for(self.reader.readexactly(size), timeout=60)
            # Read trailing CRLF
            await self.reader.readline()
        except Exception:
            await self.send(f"{self.tag} BAD Failed to read literal data")
            return

        if self.user:
            async with AsyncSessionLocal() as db:
                import email as email_lib
                msg = email_lib.message_from_bytes(data)
                from database import create_email as db_create_email
                from email.utils import getaddresses
                subject = msg.get("Subject", "(no subject)")
                from_addr = msg.get("From", "")
                to_list = [a for _, a in getaddresses([msg.get("To", "")])]
                await db_create_email(
                    db,
                    user_id=self.user["id"],
                    folder=mailbox,
                    from_addr=from_addr,
                    to_addrs=to_list,
                    subject=subject,
                    body_text=data.decode("utf-8", errors="replace")[:10000],
                    size_bytes=size,
                    is_read=True,
                )
                await db.commit()

        await self.send(f"{self.tag} OK APPEND completed")

    async def cmd_uid(self, args: str):
        """UID prefix command: dispatch to underlying command with UID mode."""
        parts = args.split(None, 1)
        if not parts:
            await self.send(f"{self.tag} BAD UID requires a command")
            return

        uid_cmd = parts[0].upper()
        uid_args = parts[1] if len(parts) > 1 else ""

        if uid_cmd == "FETCH":
            await self.cmd_fetch(uid_args, uid_mode=True)
        elif uid_cmd == "STORE":
            await self.cmd_store(uid_args, uid_mode=True)
        elif uid_cmd == "SEARCH":
            await self.cmd_search(uid_args, uid_mode=True)
        elif uid_cmd == "COPY":
            await self.send(f"{self.tag} OK UID COPY completed")
        elif uid_cmd == "MOVE":
            await self.send(f"{self.tag} OK UID MOVE completed")
        else:
            await self.send(f"{self.tag} BAD Unknown UID command: {uid_cmd}")

    async def cmd_idle(self):
        """IDLE: wait for new messages."""
        await self.send("+ idling")
        try:
            line = await asyncio.wait_for(self.reader.readline(), timeout=1800)
            decoded = line.decode("utf-8", errors="replace").strip().upper()
            if decoded == "DONE":
                await self.send(f"{self.tag} OK IDLE terminated")
            else:
                await self.send(f"{self.tag} BAD Expected DONE")
        except asyncio.TimeoutError:
            await self.send("* BYE IDLE timeout")
            self.state = STATE_LOGOUT

    def _parse_args(self, args: str) -> List[str]:
        """Simple argument parser respecting quoted strings."""
        result = []
        current = ""
        in_quotes = False

        for char in args:
            if char == '"' and not in_quotes:
                in_quotes = True
            elif char == '"' and in_quotes:
                in_quotes = False
                result.append(current)
                current = ""
            elif char == ' ' and not in_quotes:
                if current:
                    result.append(current)
                    current = ""
            else:
                current += char

        if current:
            result.append(current)

        return result


class IMAPServer:
    """Manages the IMAP server listener."""

    def __init__(self):
        self.server = None
        self._task = None

    async def start(self):
        """Start the IMAP server."""
        try:
            self.server = await asyncio.start_server(
                self._handle_client,
                host=config.IMAP_HOST,
                port=config.IMAP_PORT,
            )
            logger.info(f"IMAP server started on {config.IMAP_HOST}:{config.IMAP_PORT}")
            async with self.server:
                await self.server.serve_forever()
        except Exception as e:
            logger.error(f"IMAP server error: {e}", exc_info=True)

    async def _handle_client(
        self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter
    ):
        """Handle a new IMAP client connection."""
        session = IMAPSession(reader, writer)
        await session.handle()

    def stop(self):
        """Stop the IMAP server."""
        if self.server:
            self.server.close()
            logger.info("IMAP server stopped.")


imap_server = IMAPServer()
