import { Router } from "express";
import { z } from "zod";
import {
  verifyCredentials,
  issueAccessToken,
  issueRefreshToken,
  verifyRefreshToken,
  getUserByEmail,
} from "../services/authService.js";

const router = Router();

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

// POST /auth/login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await verifyCredentials(email, password);
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const accessToken  = issueAccessToken(user);
    const refreshToken = issueRefreshToken(user);

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/auth/refresh",
    });

    res.json({
      accessToken,
      user: {
        email: user.email,
        role:  user.role,
        domain: user.domain,
        displayName: user.displayName,
      },
    });
  } catch (e) {
    next(e);
  }
});

// POST /auth/refresh
router.post("/refresh", async (req, res, next) => {
  try {
    const token = req.cookies?.refresh_token as string | undefined;
    if (!token) { res.status(401).json({ error: "No refresh token" }); return; }

    const { sub } = verifyRefreshToken(token);
    const user = await getUserByEmail(sub);
    if (!user) { res.status(401).json({ error: "User not found" }); return; }

    res.json({
      accessToken: issueAccessToken(user),
      user: { email: user.email, role: user.role, domain: user.domain },
    });
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

// POST /auth/logout
router.post("/logout", (_req, res) => {
  res.clearCookie("refresh_token", { path: "/auth/refresh" });
  res.json({ ok: true });
});

export default router;
