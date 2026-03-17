import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../services/authService.js";
import type { AuthTokenPayload } from "../types/index.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
      userPassword?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }
  try {
    req.user = verifyAccessToken(auth.slice(7));
    // Password is passed as X-Mail-Pass header for IMAP/SMTP proxying
    // In production consider storing encrypted in Redis keyed by session
    req.userPassword = req.headers["x-mail-pass"] as string ?? "";
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
