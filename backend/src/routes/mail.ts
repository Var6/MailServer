import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import * as imap from "../services/imapService.js";
import { sendMail } from "../services/smtpService.js";

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
    imap.appendToSent(from, password, { from, to: toStr, subject: opts.subject, text: opts.text, html: opts.html }).catch(() => {});
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

export default router;
