import { CookieOptions, NextFunction, Request, Response } from "express";
import { SESSION_COOKIE_MAX_AGE_MS, SESSION_COOKIE_NAME, validateSession } from "../services/authService";
import { asyncHandler } from "./errorHandler";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

export function sessionCookieOptions(): CookieOptions {
  return { ...baseCookieOptions(), maxAge: SESSION_COOKIE_MAX_AGE_MS };
}

// clearCookie must NOT carry maxAge: Express expires the cookie by adding
// `expires` in the past, but a positive Max-Age in the same header would win
// over that in the browser and keep the cookie alive.
export function clearSessionCookieOptions(): CookieOptions {
  return baseCookieOptions();
}

export const requireAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const userId = await validateSession(token);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  req.userId = userId;
  next();
});
