import bcrypt from "bcrypt";
import { pool } from "../db/pool";

const BCRYPT_COST = 12;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface SessionInfo {
  token: string;
  expiresAt: Date;
}

export async function createSession(userId: string): Promise<SessionInfo> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const result = await pool.query(
    `INSERT INTO sessions (user_id, expires_at) VALUES ($1, $2) RETURNING id`,
    [userId, expiresAt]
  );
  return { token: result.rows[0].id, expiresAt };
}

export async function validateSession(token: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT user_id FROM sessions WHERE id = $1 AND expires_at > now()`,
    [token]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0].user_id;
}

export async function deleteSession(token: string): Promise<void> {
  await pool.query(`DELETE FROM sessions WHERE id = $1`, [token]);
}

export const SESSION_COOKIE_NAME = "session";
export const SESSION_COOKIE_MAX_AGE_MS = SESSION_TTL_MS;

// Precomputed at startup so failed logins for a non-existent email take about as
// long as a wrong-password login, and don't leak which case occurred via timing.
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_COST);
