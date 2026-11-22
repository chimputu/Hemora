import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Hash a plaintext password using bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a plaintext password against a bcrypt hash.
 * Returns true if the password matches, false otherwise.
 */
export async function verifyPassword(password: string, hashValue: string): Promise<boolean> {
    return bcrypt.compare(password, hashValue);
}
