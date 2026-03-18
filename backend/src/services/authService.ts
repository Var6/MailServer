import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { User, Domain, type IUser, type UserRole } from "../models/User.js";
import { Tenant } from "../models/Tenant.js";
import { config } from "../config/index.js";
import type { AuthTokenPayload } from "../types/index.js";

// ── Auth ──────────────────────────────────────────────────
export async function verifyCredentials(email: string, password: string): Promise<IUser | null> {
  const user = await User.findOne({ email: email.toLowerCase(), active: true });
  if (!user) return null;
  const valid = await argon2.verify(user.password, password);
  return valid ? user : null;
}

export function issueAccessToken(user: IUser): string {
  const payload: AuthTokenPayload = { sub: user.email, domain: user.domain, role: user.role };
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: "15m" });
}

export function issueRefreshToken(user: IUser): string {
  return jwt.sign({ sub: user.email }, config.JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  return jwt.verify(token, config.JWT_SECRET) as AuthTokenPayload;
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as { sub: string };
}

export async function getUserByEmail(email: string): Promise<IUser | null> {
  return User.findOne({ email: email.toLowerCase(), active: true });
}

// ── User creation with tenant quota enforcement ────────────
export async function createUser(opts: {
  email: string;
  password: string;
  role?: UserRole;
  quotaMb?: number;
  displayName?: string;
  createdByDomain?: string;
  /** Explicit tenant domain — lets admin use any login email while still belonging to the right tenant */
  tenantDomain?: string;
}): Promise<IUser> {
  const { email, password, role = "user", displayName, createdByDomain } = opts;
  // Use explicit tenantDomain if provided, otherwise derive from email
  const domain = (opts.tenantDomain ?? email.split("@")[1]).toLowerCase();

  // Admins can only create users in their own domain
  if (createdByDomain && domain !== createdByDomain) {
    const err = new Error("Cannot create users outside your domain") as Error & { status: number };
    err.status = 403;
    throw err;
  }

  // Ensure domain exists (Postfix/Dovecot lookup chain)
  await Domain.findOneAndUpdate({ name: domain }, { name: domain, active: true }, { upsert: true });

  // Enforce maxUsers limit for regular users
  if (role === "user") {
    const tenant = await Tenant.findOne({ domain });
    if (tenant) {
      const currentCount = await User.countDocuments({ domain, active: true, role: "user" });
      if (currentCount >= tenant.maxUsers) {
        const err = new Error(`User limit reached (max ${tenant.maxUsers} for this domain)`) as Error & { status: number };
        err.status = 422;
        throw err;
      }
    }
  }

  // Resolve quota from tenant if not specified
  let quotaMb = opts.quotaMb;
  if (!quotaMb) {
    const tenant = await Tenant.findOne({ domain });
    quotaMb = tenant?.storagePerUserMb ?? 1024;
  }

  const hash = await argon2.hash(password, { type: argon2.argon2id });
  return User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { email: email.toLowerCase(), password: hash, domain, role, quotaMb, displayName: displayName || undefined, active: true },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ) as Promise<IUser>;
}

export async function domainExists(domain: string): Promise<boolean> {
  const d = await Domain.findOne({ name: domain.toLowerCase(), active: true });
  return !!d;
}

export async function getUsersByDomain(domain: string) {
  return User.find({ domain: domain.toLowerCase() }, { password: 0 }).sort({ createdAt: -1 });
}

export async function countUsersByDomain(domain: string): Promise<number> {
  return User.countDocuments({ domain: domain.toLowerCase(), active: true });
}
