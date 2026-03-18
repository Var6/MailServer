/**
 * /admin — Company Admin only
 * Manage users within the admin's own domain. Strict isolation enforced.
 */
import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, requireSameTenant } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { Tenant } from "../models/Tenant.js";
import { createUser, getUsersByDomain, countUsersByDomain } from "../services/authService.js";

const router = Router();
router.use(requireAuth, requireRole("admin", "superadmin"));

// GET /admin/tenant — Own tenant info + usage stats
router.get("/tenant", async (req, res, next) => {
  try {
    const tenant = await Tenant.findOne({ domain: req.user!.domain });
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
    const currentUsers  = await countUsersByDomain(req.user!.domain);
    res.json({ ...tenant.toObject(), currentUsers });
  } catch (e) { next(e); }
});

// GET /admin/users — List users in own domain only
router.get("/users", async (req, res, next) => {
  try {
    // Domain is ALWAYS from the JWT — never from client input
    const users = await getUsersByDomain(req.user!.domain);
    res.json(users);
  } catch (e) { next(e); }
});

// POST /admin/users — Create user in own domain
const createSchema = z.object({
  // Accept either localPart ("john") or full email ("john@example.com")
  localPart:   z.string().regex(/^[a-zA-Z0-9._+%-]+$/).optional(),
  email:       z.string().email().optional(),
  password:    z.string().min(8),
  displayName: z.string().optional(),
  quotaMb:     z.coerce.number().int().min(100).optional(),
});

router.post("/users", async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);

    // Extract local part from either field; domain is always enforced from JWT
    const rawLocal = data.localPart ?? data.email?.split("@")[0];
    if (!rawLocal) { res.status(400).json({ error: "localPart or email required" }); return; }
    const enforcedEmail = `${rawLocal.toLowerCase()}@${req.user!.domain}`;

    const user = await createUser({
      email: enforcedEmail,
      password: data.password,
      role: "user",
      displayName: data.displayName,
      quotaMb: data.quotaMb,
      createdByDomain: req.user!.domain,   // enforces same-domain check in service
    });

    res.status(201).json({ email: user.email, displayName: user.displayName, quotaMb: user.quotaMb, active: user.active });
  } catch (e) { next(e); }
});

// PATCH /admin/users/:email — Update user (same domain only)
router.patch("/users/:email", requireSameTenant(), async (req, res, next) => {
  try {
    const patch = z.object({
      displayName: z.string().optional(),
      quotaMb:     z.coerce.number().int().min(100).optional(),
      active:      z.boolean().optional(),
    }).parse(req.body);

    // Validate quotaMb doesn't exceed tenant limit
    if (patch.quotaMb) {
      const tenant = await Tenant.findOne({ domain: req.user!.domain });
      if (tenant && patch.quotaMb > tenant.storagePerUserMb) {
        res.status(422).json({ error: `Quota cannot exceed ${tenant.storagePerUserMb} MB` });
        return;
      }
    }

    const user = await User.findOneAndUpdate(
      { email: req.params.email.toLowerCase(), domain: req.user!.domain },  // domain filter is redundant safety net
      patch,
      { new: true, projection: { password: 0 } }
    );
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(user);
  } catch (e) { next(e); }
});

// DELETE /admin/users/:email — Deactivate user (same domain only)
router.delete("/users/:email", requireSameTenant(), async (req, res, next) => {
  try {
    // Prevent admin from deleting themselves
    if (req.params.email.toLowerCase() === req.user!.sub) {
      res.status(400).json({ error: "Cannot deactivate your own account" });
      return;
    }
    await User.findOneAndUpdate(
      { email: req.params.email.toLowerCase(), domain: req.user!.domain },
      { active: false }
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /admin/stats — Quick stats for admin dashboard
router.get("/stats", async (req, res, next) => {
  try {
    const domain = req.user!.domain;
    const tenant = await Tenant.findOne({ domain });
    const [totalUsers, activeUsers] = await Promise.all([
      User.countDocuments({ domain, role: "user" }),
      User.countDocuments({ domain, role: "user", active: true }),
    ]);
    res.json({
      domain,
      companyName: tenant?.name,
      totalUsers,
      activeUsers,
      maxUsers: tenant?.maxUsers ?? 0,
      storagePerUserMb: tenant?.storagePerUserMb ?? 0,
      slotsRemaining: Math.max(0, (tenant?.maxUsers ?? 0) - activeUsers),
    });
  } catch (e) { next(e); }
});

export default router;
