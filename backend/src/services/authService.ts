import mysql from "mysql2/promise";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import type { AuthTokenPayload, MailUser } from "../types/index.js";

let pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: config.DB_HOST,
      port: config.DB_PORT,
      database: config.DB_NAME,
      user: config.DB_USER,
      password: config.DB_PASS,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}

export async function verifyCredentials(email: string, password: string): Promise<MailUser | null> {
  const [rows] = await getPool().execute<mysql.RowDataPacket[]>(
    "SELECT id, email, domain_id, quota_mb, password AS hash FROM virtual_users WHERE email = ? AND active = 1",
    [email]
  );
  if (!rows.length) return null;
  const user = rows[0];
  const valid = await argon2.verify(user.hash as string, password);
  if (!valid) return null;
  return { id: user.id, email: user.email, domain_id: user.domain_id, quota_mb: user.quota_mb };
}

export function issueAccessToken(user: MailUser): string {
  const payload: AuthTokenPayload = { sub: user.email, domain: user.email.split("@")[1] };
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: "15m" });
}

export function issueRefreshToken(user: MailUser): string {
  return jwt.sign({ sub: user.email }, config.JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  return jwt.verify(token, config.JWT_SECRET) as AuthTokenPayload;
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as { sub: string };
}

export async function getUserByEmail(email: string): Promise<MailUser | null> {
  const [rows] = await getPool().execute<mysql.RowDataPacket[]>(
    "SELECT id, email, domain_id, quota_mb FROM virtual_users WHERE email = ? AND active = 1",
    [email]
  );
  return rows.length ? (rows[0] as MailUser) : null;
}

export async function createUser(email: string, password: string, domainId: number, quotaMb = 2048): Promise<void> {
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  await getPool().execute(
    "INSERT INTO virtual_users (domain_id, email, password, quota_mb) VALUES (?, ?, ?, ?)",
    [domainId, email, hash, quotaMb]
  );
}
