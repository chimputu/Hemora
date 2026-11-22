import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { prisma } from "./prisma.js";

// ── Configuration ──

const JWT_SECRET = process.env.JWT_SECRET || "hemora-dev-jwt-secret-change-in-production";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "hemora-dev-refresh-secret-change-in-production";

const ACCESS_TOKEN_EXPIRY = "15m"; // 15 minutes
const ISSUER = "hemora";
const AUDIENCE = "hemora-mobile";

const secret = new TextEncoder().encode(JWT_SECRET);

/**
 * JWT payload structure for access tokens.
 */
export interface AccessTokenPayload extends JWTPayload {
  sub: string;      // user ID
  email: string;
  role: string;
  iss: string;
  aud: string;
}

/**
 * Generate a signed JWT access token for a user.
 * Token expires in 15 minutes.
 */
export async function generateAccessToken(userId: string, email: string, role: string): Promise<string> {
    const token = await new SignJWT({
        sub: userId,
        email,
        role,
    } as JWTPayload)
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setIssuedAt()
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setExpirationTime(ACCESS_TOKEN_EXPIRY)
        .sign(secret);

    return token;
}

/**
 * Verify and decode a JWT access token.
 * Returns the payload if valid, or null if invalid/expired.
 * This function replaces the `jwt-verify.ts` interface used by RBAC middleware.
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, secret, {
            issuer: ISSUER,
            audience: AUDIENCE,
        });

        return {
            sub: payload.sub as string,
            email: payload.email as string,
            role: payload.role as string,
            iss: payload.iss as string,
            aud: payload.aud as string,
        };
    } catch {
        return null;
    }
}

/**
 * Extract user from database given a valid access token.
 * Returns the user object or null if the token is invalid or user not found.
 * This is the main function used by RBAC middleware.
 */
export async function getUserFromToken(token: string) {
    const payload = await verifyAccessToken(token);
    if (!payload) return null;

    const user = await prisma.user.findUnique({
        where: { id: payload.sub },
    });

    if (!user) return null;

    // Check if user is banned
    if (user.banned) {
        // Check if ban has expired
        if (user.banExpires && user.banExpires <= new Date()) {
            // Ban expired — automatically unban
            await prisma.user.update({
                where: { id: user.id },
                data: { banned: false, banReason: null, banExpires: null },
            });
        } else {
            return null; // User is still banned
        }
    }

    return user;
}

/**
 * Extract the bearer token from an Authorization header.
 * Returns the raw token string or null if the header is missing/malformed.
 */
export function extractBearerToken(authorizationHeader: string | undefined): string | null {
    if (!authorizationHeader) return null;

    const parts = authorizationHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") return null;

    return parts[1];
}
