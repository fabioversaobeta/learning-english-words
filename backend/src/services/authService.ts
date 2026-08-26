import bcrypt from "bcrypt";
import crypto from "crypto";
import { pool } from "../db/pool";

const BCRYPT_COST = 12;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

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

export async function deleteAllSessionsForUser(userId: string): Promise<void> {
  await pool.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Returns the raw token to email to the user; only its hash is persisted, so a
// database leak alone doesn't let an attacker reset anyone's password.
export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, hashToken(token), expiresAt]
  );
  return token;
}

// Atomically marks the token used so it can't be replayed, returning the
// associated user id, or null if the token is missing/expired/already used.
export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const result = await pool.query(
    `UPDATE password_reset_tokens
     SET used_at = now()
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
     RETURNING user_id`,
    [hashToken(token)]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0].user_id;
}

export const SESSION_COOKIE_NAME = "session";
export const SESSION_COOKIE_MAX_AGE_MS = SESSION_TTL_MS;

// Precomputed at startup so failed logins for a non-existent email take about as
// long as a wrong-password login, and don't leak which case occurred via timing.
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_COST);
