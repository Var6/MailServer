import { Router } from "express";
import { z } from "zod";
import argon2 from "argon2";
import { requireAuth } from "../middleware/auth.js";
import { User } from "../models/User.js";

const router = Router();
router.use(requireAuth);

// GET /settings/profile — return current profile info
router.get("/profile", async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.user!.sub });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json({
      email: user.email,
      displayName: user.displayName ?? "",
      avatar: user.avatar ?? "",
      domain: user.domain,
      role: user.role,
    });
  } catch (e) { next(e); }
});

// PATCH /settings/profile — update display name
const profileSchema = z.object({
  displayName: z.string().min(1).max(100),
});

router.patch("/profile", async (req, res, next) => {
  try {
    const { displayName } = profileSchema.parse(req.body);
    const user = await User.findOneAndUpdate(
      { email: req.user!.sub },
      { displayName },
      { new: true }
    );
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ ok: true, displayName: user.displayName });
  } catch (e) { next(e); }
});

// PATCH /settings/password — change password
const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

router.patch("/password", async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = passwordSchema.parse(req.body);
    const user = await User.findOne({ email: req.user!.sub });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const valid = await argon2.verify(user.password, currentPassword);
    if (!valid) { res.status(403).json({ error: "Current password is incorrect" }); return; }

    user.password = await argon2.hash(newPassword);
    await user.save();

    res.json({ ok: true });
  } catch (e) { next(e); }
});

// PATCH /settings/avatar — update profile picture (base64 data URL, max 512KB)
const avatarSchema = z.object({
  avatar: z.string().max(700_000, "Avatar too large (max ~512 KB)"),
});

router.patch("/avatar", async (req, res, next) => {
  try {
    const { avatar } = avatarSchema.parse(req.body);
    // Validate data URL pattern
    if (avatar && !avatar.startsWith("data:image/")) {
      res.status(400).json({ error: "Avatar must be a data:image/* URL" });
      return;
    }
    const user = await User.findOneAndUpdate(
      { email: req.user!.sub },
      { avatar },
      { new: true }
    );
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ ok: true, avatar: user.avatar ?? "" });
  } catch (e) { next(e); }
});

export default router;
