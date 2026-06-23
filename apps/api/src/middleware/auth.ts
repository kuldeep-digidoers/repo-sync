import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { prisma } from "@repo-sync/db";
import { AppError } from "./error-handler.js";

export interface JwtPayload {
  userId: string;
  email: string;
}

// Extend Express Request with typed user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string | null;
        avatarUrl: string | null;
        githubLogin: string | null;
      };
    }
  }
}

/**
 * Extracts JWT from httpOnly cookie or Authorization header.
 * Attaches `req.user` with the authenticated user record.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token =
      req.cookies?.token ||
      extractBearerToken(req.headers.authorization);

    if (!token) {
      throw AppError.unauthorized("No authentication token provided");
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    } catch {
      throw AppError.unauthorized("Invalid or expired token");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        githubLogin: true,
      },
    });

    if (!user) {
      throw AppError.unauthorized("User account not found");
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

function extractBearerToken(header?: string): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

/**
 * Generate a signed JWT for a user.
 */
export function generateToken(userId: string, email: string): string {
  const payload: JwtPayload = { userId, email };
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as any,
  });
}

/**
 * Set the JWT as an httpOnly cookie on the response.
 */
export function setAuthCookie(res: Response, token: string): void {
  const maxAge = parseDuration(config.jwt.expiresIn);

  res.cookie("token", token, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: config.nodeEnv === "production" ? "strict" : "lax",
    maxAge,
    path: "/",
  });
}

/**
 * Clear the auth cookie.
 */
export function clearAuthCookie(res: Response): void {
  res.clearCookie("token", {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: config.nodeEnv === "production" ? "strict" : "lax",
    path: "/",
  });
}

/**
 * Parse duration strings like "7d", "24h", "60m" to milliseconds.
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([dhms])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "d":
      return value * 24 * 60 * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "m":
      return value * 60 * 1000;
    case "s":
      return value * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}
