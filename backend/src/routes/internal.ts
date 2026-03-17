/**
 * Internal routes — called by Dovecot checkpassword and Postfix lookup
 * Protected by X-Internal-Token header (never exposed to internet via Nginx)
 */
import { Router } from "express";
import { z } from "zod";
import { config } from "../config/index.js";
import { verifyCredentials, domainExists, getUserByEmail } from "../services/authService.js";

const router = Router();

// Middleware: check internal token
router.use((req, res, next) => {
  const token = req.headers["x-internal-token"];
  if (token !== config.INTERNAL_AUTH_TOKEN) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
});

// POST /internal/auth — Dovecot checkpassword calls this
const authSchema = z.object({ email: z.string(), password: z.string() });

router.post("/auth", async (req, res, next) => {
  try {
    const { email, password } = authSchema.parse(req.body);
    const user = await verifyCredentials(email, password);
    if (!user) {
      res.status(401).json({ ok: false });
      return;
    }
    res.json({
      ok: true,
      email: user.email,
      domain: user.domain,
      quotaMb: user.quotaMb,
      home: `/var/mail/vhosts/${user.domain}/${user.email.split("@")[0]}`,
    });
  } catch (e) { next(e); }
});

// GET /internal/virtual-domain?name=domain.com — Postfix domain check
router.get("/virtual-domain", async (req, res, next) => {
  try {
    const name = req.query.name as string;
    const exists = await domainExists(name);
    if (exists) res.json({ exists: true });
    else res.status(404).json({ exists: false });
  } catch (e) { next(e); }
});

// GET /internal/virtual-user?email=user@domain.com — Postfix mailbox check
router.get("/virtual-user", async (req, res, next) => {
  try {
    const email = req.query.email as string;
    const user = await getUserByEmail(email);
    if (user) res.json({ exists: true, email: user.email });
    else res.status(404).json({ exists: false });
  } catch (e) { next(e); }
});

export default router;
