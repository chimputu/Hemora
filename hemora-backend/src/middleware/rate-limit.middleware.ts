import { Request, Response, NextFunction } from "express";

/**
 * Simple in-memory rate limiter middleware.
 * Tracks request counts per IP address using a sliding window approach.
 *
 * Configuration:
 * - windowMs: Time window in milliseconds (default: 15 minutes)
 * - maxRequests: Maximum requests per window (default: 20)
 *
 * This is a lightweight implementation suitable for development and
 * single-instance production. For multi-instance deployments, use
 * a distributed store like Redis.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Prevent the interval from keeping the process alive
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

export function rateLimit(options?: { windowMs?: number; maxRequests?: number }) {
  const windowMs = options?.windowMs ?? 15 * 60 * 1000; // 15 minutes
  const maxRequests = options?.maxRequests ?? 20;

  return (req: Request, _res: Response, next: NextFunction) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const now = Date.now();

    let entry = rateLimitStore.get(ip);

    if (!entry || now > entry.resetTime) {
      rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    entry.count += 1;

    if (entry.count > maxRequests) {
      _res.status(429).json({
        error: "Too many requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      });
      return;
    }

    next();
  };
}

/**
 * Stricter rate limiter for authentication endpoints.
 * In development, allows 100 requests per 15 minutes to avoid blocking during testing.
 * In production, limits to 10 per 15 minutes to prevent brute-force attacks.
 */
export function authRateLimit() {
  const isDev = process.env.NODE_ENV !== "production";
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: isDev ? 100 : 10,
  });
}
