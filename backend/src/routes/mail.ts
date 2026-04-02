import { Router } from "express";
import { z } from "zod";
import path from "path";
import { requireAuth } from "../middleware/auth.js";
import * as imap from "../services/imapService.js";
import { sendMail } from "../services/smtpService.js";
import { provisionUser, uploadFile } from "../services/nextcloudService.js";
import { uploadLocalFile } from "../services/localFileService.js";

const router = Router();
router.use(requireAuth);

// In cloud deployments without Dovecot/Postfix, return a clear error
router.use((_req, res, next) => {
  if (!process.env.IMAP_HOST) {
    res.status(503).json({ error: "Mail server not configured in this deployment." });
    return;
  }
  next();
});

// GET /mail/folders
router.get("/folders", async (req, res, next) => {
  try {
    const folders = await imap.listFolders(req.user!.sub, req.userPassword!);
    res.json(folders);
  } catch (e) { next(e); }
});

// GET /mail/messages?folder=INBOX&page=1&limit=50
router.get("/messages", async (req, res, next) => {
  try {
    const folder = (req.query.folder as string) || "INBOX";
    const page   = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit  = Math.min(100, parseInt(req.query.limit as string) || 50);
    const result = await imap.fetchMessages(req.user!.sub, req.userPassword!, folder, page, limit);
    res.json(result);
  } catch (e) { next(e); }
});

// GET /mail/messages/:uid?folder=INBOX
router.get("/messages/:uid", async (req, res, next) => {
  try {
    const uid    = parseInt(req.params.uid);
    const folder = (req.query.folder as string) || "INBOX";
    const msg    = await imap.fetchMessage(req.user!.sub, req.userPassword!, folder, uid);
    if (!msg) { res.status(404).json({ error: "Message not found" }); return; }
    res.json(msg);
  } catch (e) { next(e); }
});

// GET /mail/messages/:uid/attachments/:index/download?folder=INBOX
router.get("/messages/:uid/attachments/:index/download", async (req, res, next) => {
  try {
    const uid = parseInt(req.params.uid, 10);
    const index = parseInt(req.params.index, 10);
    const folder = (req.query.folder as string) || "INBOX";

    if (Number.isNaN(uid) || Number.isNaN(index) || index < 0) {
      res.status(400).json({ error: "Invalid uid or attachment index" });
      return;
    }

    const attachment = await imap.fetchAttachment(req.user!.sub, req.userPassword!, folder, uid, index);
    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }

    res.setHeader("Content-Type", attachment.contentType || "application/octet-stream");
    res.setHeader("Content-Length", attachment.size.toString());
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(attachment.filename)}"`);
    res.send(attachment.content);
  } catch (e) { next(e); }
});

// POST /mail/messages/:uid/attachments/:index/edit-online
router.post("/messages/:uid/attachments/:index/edit-online", async (req, res, next) => {
  try {
    const uid = parseInt(req.params.uid, 10);
    const index = parseInt(req.params.index, 10);
    const folder = ((req.body as { folder?: string })?.folder as string) || "INBOX";

    if (Number.isNaN(uid) || Number.isNaN(index) || index < 0) {
      res.status(400).json({ error: "Invalid uid or attachment index" });
      return;
    }

    const email = req.user!.sub;
    const password = req.userPassword!;
    const attachment = await imap.fetchAttachment(email, password, folder, uid, index);
    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }

    const safeFilename = attachment.filename.replace(/[\\/:*?"<>|]/g, "_");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const targetPath = `/Mail Attachments/${stamp}-${safeFilename}`;

    await provisionUser(email, password).catch(() => {});
    await uploadFile(email, password, targetPath, attachment.content, attachment.contentType);

    const dir = path.posix.dirname(targetPath);
    const redirect = `/index.php/apps/files/?dir=${encodeURIComponent(dir)}&openfile=${encodeURIComponent(targetPath)}`;
    res.json({ ok: true, targetPath, redirect, filename: attachment.filename });
  } catch (e) { next(e); }
});

// GET /mail/contacts/suggestions?q=
router.get("/contacts/suggestions", async (req, res, next) => {
  try {
    const q = (req.query.q as string) ?? "";
    const suggestions = await imap.fetchContactSuggestions(req.user!.sub, req.userPassword!, q);
    res.json(suggestions);
  } catch (e) { next(e); }
});

// POST /mail/messages/:uid/attachments/:index/save-to-files
router.post("/messages/:uid/attachments/:index/save-to-files", async (req, res, next) => {
  try {
    const uid = parseInt(req.params.uid, 10);
    const index = parseInt(req.params.index, 10);
    const folder = ((req.body as { folder?: string })?.folder as string) || "INBOX";
    if (Number.isNaN(uid) || Number.isNaN(index) || index < 0) {
      res.status(400).json({ error: "Invalid uid or attachment index" }); return;
    }
    const attachment = await imap.fetchAttachment(req.user!.sub, req.userPassword!, folder, uid, index);
    if (!attachment) { res.status(404).json({ error: "Attachment not found" }); return; }

    const safeFilename = attachment.filename.replace(/[\\/:*?"<>|]/g, "_");
    const filePath = `/Mail Attachments/${safeFilename}`;
    await uploadLocalFile(req.user!.sub, filePath, attachment.content);
    res.json({ ok: true, path: filePath });
  } catch (e) { next(e); }
});

// POST /mail/send
const sendSchema = z.object({
  to: z.union([z.string(), z.array(z.string())]),
  cc: z.union([z.string(), z.array(z.string())]).optional(),
  bcc: z.union([z.string(), z.array(z.string())]).optional(),
  replyTo: z.string().optional(),
  subject: z.string(),
  text: z.string().optional(),
  html: z.string().optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string(),      // base64
    contentType: z.string(),
  })).optional(),
});

router.post("/send", async (req, res, next) => {
  try {
    const opts = sendSchema.parse(req.body);
    const from = req.user!.sub;
    const password = req.userPassword!;
    const attachments = opts.attachments?.map(a => ({
      filename: a.filename,
      content: Buffer.from(a.content, "base64"),
      contentType: a.contentType,
    }));
    await sendMail({ ...opts, from, attachments }, password);
    const toStr = Array.isArray(opts.to) ? opts.to.join(", ") : opts.to;
    imap.appendToSent(from, password, { from, to: toStr, subject: opts.subject, text: opts.text, html: opts.html, attachments }).catch(() => {});
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /mail/messages/:uid/move
router.post("/messages/:uid/move", async (req, res, next) => {
  try {
    const uid    = parseInt(req.params.uid);
    const { folder, destination } = req.body as { folder: string; destination: string };
    await imap.moveMessage(req.user!.sub, req.userPassword!, folder, uid, destination);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// DELETE /mail/messages/:uid
router.delete("/messages/:uid", async (req, res, next) => {
  try {
    const uid    = parseInt(req.params.uid);
    const folder = (req.query.folder as string) || "INBOX";
    await imap.deleteMessage(req.user!.sub, req.userPassword!, folder, uid);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// DELETE /mail/messages/:uid/permanent  (expunge — no recovery)
router.delete("/messages/:uid/permanent", async (req, res, next) => {
  try {
    const uid    = parseInt(req.params.uid);
    const folder = (req.query.folder as string) || "Trash";
    await imap.expungeMessage(req.user!.sub, req.userPassword!, folder, uid);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /mail/messages/:uid/flag
router.post("/messages/:uid/flag", async (req, res, next) => {
  try {
    const uid    = parseInt(req.params.uid);
    const { folder, flag, add } = req.body as { folder: string; flag: string; add: boolean };
    await imap.toggleFlag(req.user!.sub, req.userPassword!, folder, uid, flag, add);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /mail/backup  — export all emails as a JSON backup file
router.get("/backup", async (req, res, next) => {
  try {
    const email    = req.user!.sub;
    const password = req.userPassword!;
    const backup   = await imap.exportMailbox(email, password);
    const filename = `mailbackup_${email.replace("@", "_at_")}_${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.json(backup);
  } catch (e) { next(e); }
});

// POST /mail/restore  — import a JSON backup (re-appends all messages via IMAP)
router.post("/restore", async (req, res, next) => {
  try {
    const email    = req.user!.sub;
    const password = req.userPassword!;
    const backup   = req.body as imap.MailboxBackup;

    if (!backup || backup.version !== 1 || !Array.isArray(backup.folders)) {
      res.status(400).json({ error: "Invalid backup file format" });
      return;
    }

    // Stream progress via SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    const total = backup.folders.reduce((s, f) => s + f.messages.length, 0);
    send({ type: "start", total });

    const { imported, skipped } = await imap.importMailbox(
      email, password, backup,
      (done, total) => send({ type: "progress", done, total })
    );

    send({ type: "done", imported, skipped });
    res.end();
  } catch (e) { next(e); }
});

export default router;
