/**
 * /tenants — Super Admin only
 * Full CRUD for tenants (companies). Creates the admin user automatically.
 */
import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { Tenant } from "../models/Tenant.js";
import { User, Domain } from "../models/User.js";
import { createUser, getUsersByDomain, countUsersByDomain } from "../services/authService.js";

const router = Router();
router.use(requireAuth, requireRole("superadmin"));

const createSchema = z.object({
  name:             z.string().min(2),
  domain:           z.string().min(3).toLowerCase(),
  adminEmail:       z.string().email(),
  adminPassword:    z.string().min(8),
  adminDisplayName: z.string().optional(),
  maxUsers:         z.coerce.number().int().min(1).default(10),
  storagePerUserMb: z.coerce.number().int().min(100).default(1024),
});

// POST /tenants — Create tenant + admin user atomically
router.post("/", async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);

    // Check domain not already taken
    const existing = await Tenant.findOne({ domain: data.domain });
    if (existing) { res.status(409).json({ error: "Domain already registered" }); return; }

    // Validate admin email is on the right domain
    if (!data.adminEmail.endsWith(`@${data.domain}`)) {
      res.status(400).json({ error: `Admin email must be @${data.domain}` });
      return;
    }

    // Create tenant
    const tenant = await Tenant.create({
      name: data.name,
      domain: data.domain,
      adminEmail: data.adminEmail,
      maxUsers: data.maxUsers,
      storagePerUserMb: data.storagePerUserMb,
      createdBy: req.user!.sub,
    });

    // Register domain for Postfix/Dovecot
    await Domain.findOneAndUpdate(
      { name: data.domain },
      { name: data.domain, active: true },
      { upsert: true }
    );

    // Create admin user for this tenant
    const adminUser = await createUser({
      email: data.adminEmail,
      password: data.adminPassword,
      role: "admin",
      displayName: data.adminDisplayName ?? data.name + " Admin",
      quotaMb: data.storagePerUserMb,
    });

    res.status(201).json({ tenant, adminEmail: adminUser.email });
  } catch (e) { next(e); }
});

// GET /tenants — List all tenants with live user counts
router.get("/", async (_req, res, next) => {
  try {
    const tenants = await Tenant.find().sort({ createdAt: -1 });
    const withCounts = await Promise.all(
      tenants.map(async (t) => ({
        ...t.toObject(),
        currentUsers: await countUsersByDomain(t.domain),
      }))
    );
    res.json(withCounts);
  } catch (e) { next(e); }
});

// GET /tenants/:domain — Tenant details + users
router.get("/:domain", async (req, res, next) => {
  try {
    const tenant = await Tenant.findOne({ domain: req.params.domain });
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
    const users = await getUsersByDomain(tenant.domain);
    const currentUsers = users.filter(u => u.active && u.role === "user").length;
    res.json({ ...tenant.toObject(), currentUsers, users });
  } catch (e) { next(e); }
});

// PATCH /tenants/:domain — Update limits / status
router.patch("/:domain", async (req, res, next) => {
  try {
    const patch = z.object({
      name:             z.string().optional(),
      maxUsers:         z.coerce.number().int().min(1).optional(),
      storagePerUserMb: z.coerce.number().int().min(100).optional(),
      active:           z.boolean().optional(),
    }).parse(req.body);

    const tenant = await Tenant.findOneAndUpdate(
      { domain: req.params.domain },
      patch,
      { new: true }
    );
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

    // If deactivating tenant, deactivate all their users too
    if (patch.active === false) {
      await User.updateMany({ domain: req.params.domain }, { active: false });
      await Domain.updateOne({ name: req.params.domain }, { active: false });
    } else if (patch.active === true) {
      await User.updateMany({ domain: req.params.domain }, { active: true });
      await Domain.updateOne({ name: req.params.domain }, { active: true });
    }

    res.json(tenant);
  } catch (e) { next(e); }
});

// DELETE /tenants/:domain — Hard deactivate
router.delete("/:domain", async (req, res, next) => {
  try {
    await Tenant.findOneAndUpdate({ domain: req.params.domain }, { active: false });
    await User.updateMany({ domain: req.params.domain }, { active: false });
    await Domain.updateOne({ name: req.params.domain }, { active: false });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
