import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { User, Domain, type IUser } from "../models/User.js";
import { config } from "../config/index.js";
import type { AuthTokenPayload } from "../types/index.js";

export async function verifyCredentials(email: string, password: string): Promise<IUser | null> {
  const user = await User.findOne({ email: email.toLowerCase(), active: true });
  if (!user) return null;
  const valid = await argon2.verify(user.password, password);
  return valid ? user : null;
}

export function issueAccessToken(user: IUser): string {
  const payload: AuthTokenPayload = { sub: user.email, domain: user.domain };
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

export async function createUser(
  email: string,
  password: string,
  quotaMb = 2048,
  displayName?: string
): Promise<IUser> {
  const domain = email.split("@")[1];
  // Ensure domain exists
  await Domain.findOneAndUpdate({ name: domain }, { name: domain, active: true }, { upsert: true });
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  return User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { email: email.toLowerCase(), password: hash, domain, quotaMb, displayName, active: true },
    { upsert: true, new: true }
  ) as Promise<IUser>;
}

export async function domainExists(domain: string): Promise<boolean> {
  const d = await Domain.findOne({ name: domain.toLowerCase(), active: true });
  return !!d;
}
