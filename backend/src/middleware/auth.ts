import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../services/authService.js";
import type { AuthTokenPayload, UserRole } from "../types/index.js";
import { User } from "../models/User.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
      userPassword?: string;
    }
  }
}

// ── requireAuth: verify JWT ───────────────────────────────
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }
  try {
    req.user = verifyAccessToken(auth.slice(7));
    req.userPassword = req.headers["x-mail-pass"] as string ?? "";
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ── requireRole: allow only specific roles ─────────────────
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) { res.status(401).json({ error: "Not authenticated" }); return; }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

// ── requireSameTenant: admin can only touch their own domain users ──
// Usage: router.patch("/:email", requireAuth, requireSameTenant(), handler)
// It reads the target user's domain from the DB and compares to req.user.domain.
export function requireSameTenant() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "Not authenticated" }); return; }
    // Superadmin bypasses this check
    if (req.user.role === "superadmin") { next(); return; }

    const targetEmail = req.params.email as string | undefined;
    if (!targetEmail) { next(); return; }

    const targetUser = await User.findOne({ email: targetEmail.toLowerCase() });
    if (!targetUser) { res.status(404).json({ error: "User not found" }); return; }

    if (targetUser.domain !== req.user.domain) {
      res.status(403).json({ error: "Access denied: user belongs to a different domain" });
      return;
    }
    next();
  };
}
