/**
 * Internal routes — called by Dovecot checkpassword and Postfix lookup
 * NEVER exposed via Nginx — internal Docker network only
 */
import { Router } from "express";
import { z } from "zod";
import { config } from "../config/index.js";
import { verifyCredentials, domainExists, getUserByEmail, createUser } from "../services/authService.js";

const router = Router();

// Check internal token
router.use((req, res, next) => {
  const token = req.headers["x-internal-token"];
  if (token !== config.INTERNAL_AUTH_TOKEN) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
});

// POST /internal/auth — Dovecot checkpassword
router.post("/auth", async (req, res, next) => {
  try {
    const { email, password } = z.object({ email: z.string(), password: z.string() }).parse(req.body);
    const user = await verifyCredentials(email, password);
    if (!user) { res.status(401).json({ ok: false }); return; }
    res.json({
      ok: true,
      email: user.email,
      domain: user.domain,
      role: user.role,
      quotaMb: user.quotaMb,
      home: `/var/mail/vhosts/${user.domain}/${user.email.split("@")[0]}`,
    });
  } catch (e) { next(e); }
});

// GET /internal/virtual-domain?name=domain.com — Postfix domain check
router.get("/virtual-domain", async (req, res, next) => {
  try {
    const exists = await domainExists(req.query.name as string);
    if (exists) res.json({ exists: true });
    else res.status(404).json({ exists: false });
  } catch (e) { next(e); }
});

// GET /internal/virtual-user?email=user@domain.com — Postfix mailbox check
router.get("/virtual-user", async (req, res, next) => {
  try {
    const user = await getUserByEmail(req.query.email as string);
    if (user) res.json({ exists: true, email: user.email });
    else res.status(404).json({ exists: false });
  } catch (e) { next(e); }
});

// POST /internal/auth-create — used by add-mail-user.sh script
router.post("/auth-create", async (req, res, next) => {
  try {
    const data = z.object({
      email:       z.string().email(),
      password:    z.string().min(1),
      quotaMb:     z.coerce.number().optional(),
      displayName: z.string().optional(),
      role:        z.enum(["superadmin","admin","user"]).default("user"),
    }).parse(req.body);

    const user = await createUser(data);
    res.json({ ok: true, email: user.email });
  } catch (e) { next(e); }
});

export default router;
