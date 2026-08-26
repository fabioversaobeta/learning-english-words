import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { Request } from "express";

// Coarse backstop against a single IP hammering the whole API.
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

// Per-IP backstop on login attempts. The real brute-force protection is the
// per-email/IP lockout backed by the login_attempts table (see routes/auth.ts).
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, try again later." },
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many accounts created from this IP, try again later." },
});

// Per-IP backstop on forgot-password requests, so the endpoint can't be used
// to mass-email arbitrary addresses or brute-force which emails are registered.
export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many password reset requests, try again later." },
});

// Safety cap by IP; the actual "1 per day" rule is enforced per-user in routes/topics.ts.
export const topicCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many topic creation attempts, try again later." },
});

function userOrIpKey(req: Request): string {
  return req.userId ?? ipKeyGenerator(req.ip ?? "unknown");
}

export const translateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: { error: "Too many translation requests, try again later." },
});
