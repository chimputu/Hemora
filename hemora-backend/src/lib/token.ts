import { createHash, randomBytes } from "crypto";
import { prisma } from "./prisma.js";

/**
 * Generate a cryptographically secure random refresh token.
 * 64 bytes of random data, hex-encoded (128 characters).
 */
export function generateRefreshToken(): string {
    return randomBytes(64).toString("hex");
}

/**
 * Hash a refresh token using SHA-256 for secure storage.
 * Never store plaintext refresh tokens in the database.
 */
export function hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

/**
 * Create a new refresh token record in the database.
 * Returns the raw token (to send to the client) and the stored record.
 */
export async function createRefreshToken(userId: string): Promise<{
    rawToken: string;
    tokenHash: string;
    expiresAt: Date;
}> {
    const rawToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.refreshToken.create({
        data: {
            userId,
            tokenHash,
            expiresAt,
        },
    });

    return { rawToken, tokenHash, expiresAt };
}

/**
 * Find a valid (non-revoked, non-expired) refresh token by its hash.
 * Returns the token record and associated user, or null if not found.
 */
export async function findValidRefreshToken(token: string) {
    const tokenHash = hashRefreshToken(token);
    const now = new Date();

    const refreshToken = await prisma.refreshToken.findFirst({
        where: {
            tokenHash,
            revokedAt: null,
            expiresAt: { gt: now },
        },
        include: {
            user: true,
        },
    });

    return refreshToken;
}

/**
 * Revoke a specific refresh token by marking it as revoked.
 */
export async function revokeRefreshToken(token: string): Promise<void> {
    const tokenHash = hashRefreshToken(token);
    await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
    });
}

/**
 * Revoke ALL refresh tokens for a user (session invalidation on token reuse detection).
 * This is the security measure that protects against token theft.
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
    });
}

/**
 * Rotate a refresh token: revoke the old one and create a new one.
 * Returns the new raw token.
 * If the token has already been revoked, it means it's being reused —
 * trigger session invalidation for all of that user's sessions.
 */
export async function rotateRefreshToken(
    oldToken: string,
    userId: string
): Promise<{ newRawToken: string; reused: boolean } | null> {
    const existingToken = await findValidRefreshToken(oldToken);

    if (!existingToken) {
        // Token not found or already revoked — possible reuse attack
        // Revoke all sessions for this user as a safety measure
        await revokeAllUserSessions(userId);
        return null;
    }

    // Revoke the old token
    await revokeRefreshToken(oldToken);

    // Create a new token
    const { rawToken: newRawToken } = await createRefreshToken(userId);

    return { newRawToken, reused: false };
}
