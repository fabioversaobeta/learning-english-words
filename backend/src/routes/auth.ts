import { Router } from "express";
import { pool } from "../db/pool";
import { asyncHandler } from "../middleware/errorHandler";
import { clearSessionCookieOptions, requireAuth, sessionCookieOptions } from "../middleware/auth";
import { forgotPasswordLimiter, loginLimiter, registerLimiter } from "../middleware/rateLimit";
import { sendPasswordResetEmail } from "../services/emailService";
import {
  consumePasswordResetToken,
  createPasswordResetToken,
  createSession,
  deleteAllSessionsForUser,
  deleteSession,
  DUMMY_PASSWORD_HASH,
  hashPassword,
  SESSION_COOKIE_NAME,
  verifyPassword,
} from "../services/authService";

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_CONSECUTIVE_FAILURES = 5;
const BASE_LOCKOUT_MS = 15 * 60 * 1000;
const MAX_LOCKOUT_MS = 24 * 60 * 60 * 1000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function getLockoutUntil(email: string): Promise<Date | null> {
  const result = await pool.query(
    `SELECT success, created_at FROM login_attempts
     WHERE email = $1 AND created_at > now() - interval '24 hours'
     ORDER BY created_at DESC`,
    [email]
  );

  let consecutiveFailures = 0;
  let lastFailureAt: Date | null = null;
  for (const row of result.rows) {
    if (row.success) break;
    consecutiveFailures++;
    if (!lastFailureAt) lastFailureAt = row.created_at;
  }

  if (consecutiveFailures < MAX_CONSECUTIVE_FAILURES || !lastFailureAt) {
    return null;
  }

  const escalation = Math.floor((consecutiveFailures - MAX_CONSECUTIVE_FAILURES) / MAX_CONSECUTIVE_FAILURES);
  const lockoutMs = Math.min(BASE_LOCKOUT_MS * 2 ** escalation, MAX_LOCKOUT_MS);
  const lockedUntil = new Date(lastFailureAt.getTime() + lockoutMs);
  return lockedUntil > new Date() ? lockedUntil : null;
}

authRouter.post(
  "/register",
  registerLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !EMAIL_RE.test(email)) {
      res.status(400).json({ error: "Please provide a valid email address" });
      return;
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    const passwordHash = await hashPassword(password);

    let userId: string;
    try {
      const result = await pool.query(
        `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
        [normalizedEmail, passwordHash]
      );
      userId = result.rows[0].id;
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
        res.status(409).json({ error: "Email already registered" });
        return;
      }
      throw err;
    }

    const session = await createSession(userId);
    res.cookie(SESSION_COOKIE_NAME, session.token, sessionCookieOptions());
    res.status(201).json({ user: { id: userId, email: normalizedEmail } });
  })
);

authRouter.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    const GENERIC_ERROR = { error: "Invalid email or password" };

    if (!email || !password) {
      res.status(400).json(GENERIC_ERROR);
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    const ip = req.ip ?? "unknown";

    const lockedUntil = await getLockoutUntil(normalizedEmail);
    if (lockedUntil) {
      res.status(429).json({
        error: "Too many login attempts. Please try again later.",
        retryAfter: lockedUntil.toISOString(),
      });
      return;
    }

    const userResult = await pool.query(
      `SELECT id, password_hash FROM users WHERE email = $1`,
      [normalizedEmail]
    );
    const user = userResult.rows[0] as { id: string; password_hash: string } | undefined;

    const passwordValid = await verifyPassword(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
    const success = Boolean(user) && passwordValid;

    await pool.query(
      `INSERT INTO login_attempts (email, ip, success) VALUES ($1, $2, $3)`,
      [normalizedEmail, ip, success]
    );

    if (!success || !user) {
      res.status(401).json(GENERIC_ERROR);
      return;
    }

    const session = await createSession(user.id);
    res.cookie(SESSION_COOKIE_NAME, session.token, sessionCookieOptions());
    res.json({ user: { id: user.id, email: normalizedEmail } });
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    if (token) {
      await deleteSession(token);
    }
    res.clearCookie(SESSION_COOKIE_NAME, clearSessionCookieOptions());
    res.status(204).end();
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await pool.query(`SELECT id, email FROM users WHERE id = $1`, [req.userId]);
    if (result.rows.length === 0) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    res.json({ user: result.rows[0] });
  })
);

authRouter.post(
  "/forgot-password",
  forgotPasswordLimiter,
  asyncHandler(async (req, res) => {
    const { email } = req.body as { email?: string };
    const GENERIC_RESPONSE = { message: "If that email is registered, a reset link has been sent." };

    if (!email || !EMAIL_RE.test(email)) {
      res.status(400).json({ error: "Please provide a valid email address" });
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    const userResult = await pool.query(`SELECT id FROM users WHERE email = $1`, [normalizedEmail]);
    const user = userResult.rows[0] as { id: string } | undefined;

    if (user) {
      const token = await createPasswordResetToken(user.id);
      const frontendUrl = (process.env.FRONTEND_URL ?? "").replace(/\/+$/, "");
      const resetUrl = `${frontendUrl}/?reset_token=${token}`;
      try {
        await sendPasswordResetEmail(normalizedEmail, resetUrl);
      } catch (err) {
        console.error("Failed to send password reset email", err);
      }
    }

    // Same response whether or not the email is registered, so this endpoint
    // can't be used to enumerate which addresses have accounts.
    res.status(202).json(GENERIC_RESPONSE);
  })
);

authRouter.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const { token, password } = req.body as { token?: string; password?: string };
    const INVALID_TOKEN_ERROR = { error: "This reset link is invalid or has expired." };

    if (!token) {
      res.status(400).json(INVALID_TOKEN_ERROR);
      return;
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      return;
    }

    const userId = await consumePasswordResetToken(token);
    if (!userId) {
      res.status(400).json(INVALID_TOKEN_ERROR);
      return;
    }

    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING email`,
      [passwordHash, userId]
    );

    // Reset invalidates any sessions from before the password change, then
    // immediately logs the user in on this device with a fresh one.
    await deleteAllSessionsForUser(userId);
    const session = await createSession(userId);
    res.cookie(SESSION_COOKIE_NAME, session.token, sessionCookieOptions());
    res.json({ user: { id: userId, email: result.rows[0].email } });
  })
);
