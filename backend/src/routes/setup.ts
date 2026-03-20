/**
 * /setup — One-time first-run superadmin creation.
 * Only works when zero superadmin accounts exist in the database.
 * Safe to leave exposed: becomes a no-op after first use.
 */
import { Router } from "express";
import { User } from "../models/User.js";
import { createUser } from "../services/authService.js";

const router = Router();

// GET /setup — check if first-run setup is needed
router.get("/", async (_req, res) => {
  const exists = await User.exists({ role: "superadmin" });
  res.json({ setupRequired: !exists });
});

// POST /setup — create the first superadmin (locked out after first call)
router.post("/", async (req, res, next) => {
  try {
    const exists = await User.exists({ role: "superadmin" });
    if (exists) {
      res.status(409).json({ error: "Setup already complete. Superadmin exists." });
      return;
    }

    const { email, password, displayName } = req.body as {
      email?: string; password?: string; displayName?: string;
    };

    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "password must be at least 8 characters" });
      return;
    }

    const user = await createUser({
      email,
      password,
      role: "superadmin",
      displayName: displayName ?? "Super Admin",
      tenantDomain: "localhost",
    });

    res.status(201).json({
      message: "Superadmin created. You can now log in.",
      email: user.email,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
