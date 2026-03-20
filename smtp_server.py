"""
SMTP Server using aiosmtpd.
Handles incoming mail, authenticated submission, local delivery, and relay.
"""
import asyncio
import base64
import email as email_lib
import email.policy
import json
import logging
import re
import smtplib
import ssl
import uuid
from email.header import decode_header
from email.message import EmailMessage
from email.utils import parseaddr, getaddresses
from typing import List, Optional, Tuple

from aiosmtpd.controller import Controller
from aiosmtpd.handlers import AsyncMessage
from aiosmtpd.smtp import SMTP as SMTPServer, AuthResult, LoginPassword

from config import config
from database import AsyncSessionLocal, create_email, create_attachment, update_user_quota_usage, get_user_by_email

logger = logging.getLogger(__name__)

# Spam keywords for basic filtering
SPAM_KEYWORDS = [
    "viagra", "cialis", "casino", "lottery", "winner", "prize",
    "nigerian", "inheritance", "bitcoin", "crypto", "investment",
    "click here", "free money", "make money", "work from home",
    "lose weight", "diet pills", "enlarge", "cheap meds",
]


def calculate_spam_score(subject: str, body: str) -> int:
    """Simple keyword-based spam scoring (0-100)."""
    score = 0
    text = (subject + " " + body).lower()
    for kw in SPAM_KEYWORDS:
        if kw in text:
            score += 10
    # Check for excessive caps
    if subject and sum(1 for c in subject if c.isupper()) > len(subject) * 0.7:
        score += 15
    # Check for excessive exclamation marks
    score += min(text.count("!") * 2, 20)
    return min(score, 100)


def decode_mime_header(value: str) -> str:
    """Decode MIME encoded header value."""
    if not value:
        return ""
    parts = decode_header(value)
    decoded = []
    for part, charset in parts:
        if isinstance(part, bytes):
            try:
                decoded.append(part.decode(charset or "utf-8", errors="replace"))
            except (LookupError, UnicodeDecodeError):
                decoded.append(part.decode("utf-8", errors="replace"))
        else:
            decoded.append(str(part))
    return " ".join(decoded)


def extract_email_parts(msg: email_lib.message.Message) -> Tuple[str, str, List[dict]]:
    """
    Extract text body, HTML body, and attachment info from an email message.
    Returns (text_body, html_body, attachments).
    """
    text_body = ""
    html_body = ""
    attachments = []

    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            cd = part.get("Content-Disposition", "")
            fn = part.get_filename()

            if fn or "attachment" in cd:
                # It's an attachment
                data = part.get_payload(decode=True)
                if data:
                    attachments.append({
                        "filename": fn or "attachment",
                        "content_type": ct,
                        "data": data,
                    })
            elif ct == "text/plain" and not text_body:
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or "utf-8"
                    text_body = payload.decode(charset, errors="replace")
            elif ct == "text/html" and not html_body:
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or "utf-8"
                    html_body = payload.decode(charset, errors="replace")
    else:
        ct = msg.get_content_type()
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or "utf-8"
            content = payload.decode(charset, errors="replace")
            if ct == "text/html":
                html_body = content
            else:
                text_body = content

    return text_body, html_body, attachments


class Authenticator:
    """Handles SMTP AUTH LOGIN and AUTH PLAIN."""

    async def __call__(self, server, args):
        return AuthResult(success=False, handled=False)

    async def auth_LOGIN(self, server, args):
        # args[0] = username (base64), args[1] = password (base64)
        try:
            username = base64.b64decode(args[0]).decode("utf-8")
            password = base64.b64decode(args[1]).decode("utf-8")
        except Exception:
            return AuthResult(success=False, handled=True)

        async with AsyncSessionLocal() as db:
            from auth import verify_password
            user = await get_user_by_email(db, username)
            if user and user.is_active and verify_password(password, user.password_hash):
                return AuthResult(success=True, handled=True, auth_data=user.email)
        return AuthResult(success=False, handled=True)

    async def auth_PLAIN(self, server, args):
        try:
            decoded = base64.b64decode(args[0]).decode("utf-8")
            parts = decoded.split("\x00")
            if len(parts) >= 3:
                username = parts[1]
                password = parts[2]
            else:
                return AuthResult(success=False, handled=True)
        except Exception:
            return AuthResult(success=False, handled=True)

        async with AsyncSessionLocal() as db:
            from auth import verify_password
            user = await get_user_by_email(db, username)
            if user and user.is_active and verify_password(password, user.password_hash):
                return AuthResult(success=True, handled=True, auth_data=user.email)
        return AuthResult(success=False, handled=True)


class MailHandler:
    """Main SMTP message handler."""

    async def handle_RCPT(self, server, session, envelope, address, rcpt_options):
        """Validate recipient."""
        if not address:
            return "550 Invalid recipient"
        envelope.rcpt_tos.append(address)
        return "250 OK"

    async def handle_DATA(self, server, session, envelope):
        """Process incoming message."""
        try:
            raw_data = envelope.content
            if isinstance(raw_data, bytes):
                raw_str = raw_data.decode("utf-8", errors="replace")
            else:
                raw_str = raw_data

            msg = email_lib.message_from_bytes(
                envelope.content if isinstance(envelope.content, bytes)
                else envelope.content.encode(),
                policy=email_lib.policy.default,
            )

            # Parse headers
            subject = decode_mime_header(msg.get("Subject", "(no subject)"))
            from_addr = msg.get("From", envelope.mail_from)
            message_id = msg.get("Message-ID", f"<{uuid.uuid4()}@{config.DOMAIN}>")
            reply_to = msg.get("Reply-To")

            to_list = [addr for _, addr in getaddresses([msg.get("To", "")])]
            cc_list = [addr for _, addr in getaddresses([msg.get("Cc", "")])]
            bcc_list = [addr for _, addr in getaddresses([msg.get("Bcc", "")])]

            text_body, html_body, raw_attachments = extract_email_parts(msg)
            size_bytes = len(envelope.content) if isinstance(envelope.content, bytes) else len(envelope.content.encode())
            spam_score = calculate_spam_score(subject, text_body)
            has_attachments = len(raw_attachments) > 0

            delivered = []
            relayed = []

            async with AsyncSessionLocal() as db:
                for rcpt in envelope.rcpt_tos:
                    _, rcpt_email = parseaddr(rcpt)
                    rcpt_domain = rcpt_email.split("@")[-1] if "@" in rcpt_email else ""

                    if rcpt_domain.lower() == config.DOMAIN.lower() or rcpt_domain == "localhost":
                        # Local delivery
                        user = await get_user_by_email(db, rcpt_email)
                        if user:
                            folder = "Spam" if spam_score >= 70 else "INBOX"
                            email_obj = await create_email(
                                db,
                                user_id=user.id,
                                folder=folder,
                                from_addr=from_addr,
                                to_addrs=to_list,
                                subject=subject,
                                body_text=text_body,
                                body_html=html_body,
                                cc=cc_list,
                                bcc=bcc_list,
                                reply_to=reply_to,
                                message_id=message_id,
                                raw_message=raw_str[:100000],  # Limit raw storage
                                size_bytes=size_bytes,
                                spam_score=spam_score,
                            )
                            email_obj.has_attachments = has_attachments

                            # Save attachments
                            for att in raw_attachments:
                                await create_attachment(
                                    db,
                                    email_id=email_obj.id,
                                    filename=att["filename"],
                                    content_type=att["content_type"],
                                    data=att["data"],
                                )

                            await update_user_quota_usage(db, user.id, size_bytes)
                            await db.commit()
                            delivered.append(rcpt_email)
                            logger.info(f"Delivered email to {rcpt_email} in {folder}")

                            # Notify WebSocket clients
                            try:
                                from web_app import notify_new_email
                                await notify_new_email(user.id, {
                                    "id": email_obj.id,
                                    "from": from_addr,
                                    "subject": subject,
                                    "folder": folder,
                                })
                            except Exception as ws_err:
                                logger.debug(f"WebSocket notify failed: {ws_err}")
                        else:
                            logger.warning(f"No local user for {rcpt_email}")
                    else:
                        # External relay
                        relayed.append(rcpt)

            # Attempt relay for external recipients
            if relayed and config.RELAY_HOST:
                await self._relay_message(envelope, relayed)

            return "250 Message accepted"

        except Exception as e:
            logger.error(f"SMTP handle_DATA error: {e}", exc_info=True)
            return "451 Internal server error"

    async def _relay_message(self, envelope, recipients: list):
        """Forward message to external SMTP relay."""
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None, self._sync_relay, envelope, recipients
            )
        except Exception as e:
            logger.error(f"Relay failed: {e}")

    def _sync_relay(self, envelope, recipients: list):
        """Synchronous relay via smtplib."""
        try:
            if config.RELAY_USE_TLS:
                ctx = ssl.create_default_context()
                smtp = smtplib.SMTP(config.RELAY_HOST, config.RELAY_PORT)
                smtp.starttls(context=ctx)
            else:
                smtp = smtplib.SMTP(config.RELAY_HOST, config.RELAY_PORT)

            if config.RELAY_USERNAME and config.RELAY_PASSWORD:
                smtp.login(config.RELAY_USERNAME, config.RELAY_PASSWORD)

            content = (
                envelope.content
                if isinstance(envelope.content, bytes)
                else envelope.content.encode()
            )
            smtp.sendmail(envelope.mail_from, recipients, content)
            smtp.quit()
            logger.info(f"Relayed email to {recipients}")
        except Exception as e:
            logger.error(f"SMTP relay error: {e}")


class SMTPController:
    """Manages SMTP server instances."""

    def __init__(self):
        self.handler = MailHandler()
        self.authenticator = Authenticator()
        self.controllers = []

    def start(self):
        """Start SMTP servers on configured ports."""
        # Main SMTP port
        try:
            ctrl1 = Controller(
                self.handler,
                hostname=config.SMTP_HOST,
                port=config.SMTP_PORT,
                authenticator=self.authenticator,
                auth_required=False,
                auth_require_tls=False,
            )
            ctrl1.start()
            self.controllers.append(ctrl1)
            logger.info(f"SMTP server started on {config.SMTP_HOST}:{config.SMTP_PORT}")
        except Exception as e:
            logger.error(f"Failed to start SMTP on port {config.SMTP_PORT}: {e}")

        # Submission port
        try:
            ctrl2 = Controller(
                self.handler,
                hostname=config.SMTP_HOST,
                port=config.SMTP_SUBMISSION_PORT,
                authenticator=self.authenticator,
                auth_required=True,
                auth_require_tls=False,
            )
            ctrl2.start()
            self.controllers.append(ctrl2)
            logger.info(f"SMTP submission server started on {config.SMTP_HOST}:{config.SMTP_SUBMISSION_PORT}")
        except Exception as e:
            logger.error(f"Failed to start SMTP submission on port {config.SMTP_SUBMISSION_PORT}: {e}")

    def stop(self):
        """Stop all SMTP server instances."""
        for ctrl in self.controllers:
            try:
                ctrl.stop()
            except Exception as e:
                logger.error(f"Error stopping SMTP controller: {e}")
        self.controllers.clear()
        logger.info("SMTP servers stopped.")


async def send_email_via_smtp(
    from_addr: str,
    to_addrs: List[str],
    subject: str,
    body_text: str,
    body_html: str = "",
    cc: List[str] = None,
    bcc: List[str] = None,
    reply_to: str = None,
    attachments: List[dict] = None,
) -> bool:
    """
    Send an email by injecting it into the local SMTP server.
    Used by the web API for outgoing mail.
    """
    try:
        msg = EmailMessage()
        msg["From"] = from_addr
        msg["To"] = ", ".join(to_addrs)
        msg["Subject"] = subject
        msg["Message-ID"] = f"<{uuid.uuid4()}@{config.DOMAIN}>"
        if cc:
            msg["Cc"] = ", ".join(cc)
        if reply_to:
            msg["Reply-To"] = reply_to

        if body_html:
            msg.set_content(body_text or "")
            msg.add_alternative(body_html, subtype="html")
        else:
            msg.set_content(body_text or "")

        if attachments:
            for att in attachments:
                msg.add_attachment(
                    att["data"],
                    maintype=att["content_type"].split("/")[0],
                    subtype=att["content_type"].split("/")[-1],
                    filename=att["filename"],
                )

        all_recipients = list(to_addrs)
        if cc:
            all_recipients.extend(cc)
        if bcc:
            all_recipients.extend(bcc)

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            _sync_send,
            from_addr,
            all_recipients,
            msg.as_bytes(),
        )
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {e}", exc_info=True)
        return False


def _sync_send(from_addr: str, to_addrs: List[str], msg_bytes: bytes):
    """Synchronous SMTP send to local server."""
    with smtplib.SMTP("127.0.0.1", config.SMTP_PORT) as smtp:
        smtp.sendmail(from_addr, to_addrs, msg_bytes)


smtp_controller = SMTPController()
