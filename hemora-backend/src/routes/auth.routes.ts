import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { generateAccessToken, verifyAccessToken } from "../lib/auth-jwt.js";
import { createRefreshToken, findValidRefreshToken, revokeRefreshToken, revokeAllUserSessions, rotateRefreshToken } from "../lib/token.js";
import { authRateLimit } from "../middleware/rate-limit.middleware.js";
import { sendEmail, passwordResetEmail, emailVerificationEmail, isEmailConfigured } from "../lib/email.js";
import { randomBytes, createHash } from "crypto";

const router = Router();

// ── Helper: return user summary (safe fields only) ──
function userSummary(user: any) {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        bloodGroup: user.bloodGroup,
        phone: user.phone,
        eligible: user.eligible,
        facilityId: user.facilityId,
        emailVerified: user.emailVerified,
    };
}

// ── POST /auth/register ──
router.post("/register", authRateLimit(), async (req: Request, res: Response) => {
    try {
        const { email, password, name, bloodGroup } = req.body;

        // Validation
        if (!email || !password || !name) {
            return res.status(400).json({ error: "Email, password, and name are required" });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: "Password must be at least 8 characters" });
        }

        // Normalize email
        const normalizedEmail = email.toLowerCase().trim();

        // Check for duplicate email
        const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (existingUser) {
            return res.status(409).json({ error: "An account with this email already exists" });
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create user in a transaction
        const user = await prisma.user.create({
            data: {
                name,
                email: normalizedEmail,
                passwordHash,
                role: "DONOR", // New registrations are always DONOR
                emailVerified: false,
                banned: false,
                bloodGroup: bloodGroup || null,
            },
        });

        // Generate email verification token
        const verifyToken = randomBytes(32).toString("hex");
        const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await prisma.user.update({
            where: { id: user.id },
            data: {
                emailVerificationToken: verifyToken,
                emailVerificationExpires: verifyExpires,
            },
        });

        // Send verification email
        const emailContent = emailVerificationEmail(verifyToken);
        const emailSent = await sendEmail({
            to: user.email,
            ...emailContent,
        });

        if (!emailSent && isEmailConfigured()) {
            console.error(`[Auth] Failed to send verification email to ${user.email}`);
        } else if (!emailSent) {
            console.log(`[Auth] Verification token for ${user.email}: ${verifyToken} (SMTP not configured, dev mode)`);
        }

        // Generate tokens
        const accessToken = await generateAccessToken(user.id, user.email, user.role);
        const { rawToken: refreshToken } = await createRefreshToken(user.id);

        res.status(201).json({
            user: userSummary(user),
            access_token: accessToken,
            refresh_token: refreshToken,
        });
    } catch (error: any) {
        console.error("Registration error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── POST /auth/login ──
router.post("/login", authRateLimit(), async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        // Normalize email
        const normalizedEmail = email.toLowerCase().trim();

        // Find user
        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });

        // Use generic error to prevent user enumeration
        if (!user || !user.passwordHash) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        // Check if user is banned
        if (user.banned) {
            if (user.banExpires && user.banExpires <= new Date()) {
                // Ban expired — auto unban
                await prisma.user.update({
                    where: { id: user.id },
                    data: { banned: false, banReason: null, banExpires: null },
                });
            } else {
                return res.status(403).json({ error: "Account is suspended" });
            }
        }

        // Verify password
        const validPassword = await verifyPassword(password, user.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        // Generate tokens
        const accessToken = await generateAccessToken(user.id, user.email, user.role);
        const { rawToken: refreshToken } = await createRefreshToken(user.id);

        res.json({
            user: userSummary(user),
            access_token: accessToken,
            refresh_token: refreshToken,
        });
    } catch (error: any) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── POST /auth/logout ──
router.post("/logout", async (req: Request, res: Response) => {
    try {
        const { refresh_token } = req.body;

        if (!refresh_token) {
            return res.status(400).json({ error: "Refresh token is required" });
        }

        // Revoke the refresh token
        await revokeRefreshToken(refresh_token);

        res.json({ success: true });
    } catch (error: any) {
        console.error("Logout error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── POST /auth/refresh ──
router.post("/refresh", async (req: Request, res: Response) => {
    try {
        const { refresh_token } = req.body;

        if (!refresh_token) {
            return res.status(400).json({ error: "Refresh token is required" });
        }

        // Find the valid refresh token
        const tokenRecord = await findValidRefreshToken(refresh_token);
        if (!tokenRecord) {
            return res.status(401).json({ error: "Invalid or expired refresh token" });
        }

        const user = tokenRecord.user;

        // Check if user is banned
        if (user.banned) {
            if (user.banExpires && user.banExpires <= new Date()) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { banned: false, banReason: null, banExpires: null },
                });
            } else {
                return res.status(403).json({ error: "Account is suspended" });
            }
        }

        // Rotate the refresh token
        const rotationResult = await rotateRefreshToken(refresh_token, user.id);
        if (!rotationResult) {
            // Token was reused — all sessions invalidated
            return res.status(401).json({ error: "Session invalidated due to security concern" });
        }

        // Generate new access token
        const accessToken = await generateAccessToken(user.id, user.email, user.role);

        res.json({
            access_token: accessToken,
            refresh_token: rotationResult.newRawToken,
        });
    } catch (error: any) {
        console.error("Refresh error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── POST /auth/forgot-password ──
router.post("/forgot-password", async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Find user
        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });

        // Always return success to prevent email enumeration
        if (!user) {
            return res.json({ message: "If an account exists, a reset link was sent" });
        }

        // Generate reset token
        const resetToken = randomBytes(32).toString("hex");
        const resetTokenHash = createHash("sha256").update(resetToken).digest("hex");
        const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordResetToken: resetTokenHash,
                passwordResetExpires: resetExpires,
            },
        });

        // Send password reset email
        const emailContent = passwordResetEmail(resetToken);
        const emailSent = await sendEmail({
            to: user.email,
            ...emailContent,
        });

        if (!emailSent && isEmailConfigured()) {
            console.error(`[Auth] Failed to send password reset email to ${user.email}`);
        } else if (!emailSent) {
            console.log(`[Auth] Password reset token for ${user.email}: ${resetToken} (SMTP not configured, dev mode)`);
        }

        res.json({ message: "If an account exists, a reset link was sent" });
    } catch (error: any) {
        console.error("Forgot password error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── POST /auth/reset-password ──
router.post("/reset-password", async (req: Request, res: Response) => {
    try {
        const { token, new_password } = req.body;

        if (!token || !new_password) {
            return res.status(400).json({ error: "Token and new password are required" });
        }

        if (new_password.length < 8) {
            return res.status(400).json({ error: "Password must be at least 8 characters" });
        }

        // Find user by reset token hash
        const tokenHash = createHash("sha256").update(token).digest("hex");

        const user = await prisma.user.findFirst({
            where: {
                passwordResetToken: tokenHash,
                passwordResetExpires: { gt: new Date() },
            },
        });

        if (!user) {
            return res.status(400).json({ error: "Invalid or expired reset token" });
        }

        // Hash new password and update
        const passwordHash = await hashPassword(new_password);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash,
                passwordResetToken: null,
                passwordResetExpires: null,
            },
        });

        // Revoke all existing sessions — force re-login
        await revokeAllUserSessions(user.id);

        res.json({ success: true });
    } catch (error: any) {
        console.error("Reset password error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── POST /auth/verify-email ──
router.post("/verify-email", async (req: Request, res: Response) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: "Token is required" });
        }

        // Find user by verification token
        const user = await prisma.user.findFirst({
            where: {
                emailVerificationToken: token,
                emailVerificationExpires: { gt: new Date() },
            },
        });

        if (!user) {
            return res.status(400).json({ error: "Invalid or expired verification token" });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                emailVerified: true,
                emailVerificationToken: null,
                emailVerificationExpires: null,
            },
        });

        res.json({ success: true });
    } catch (error: any) {
        console.error("Verify email error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── GET /auth/me ──
router.get("/me", async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: "Authorization header required" });
        }

        const token = authHeader.split(" ")[1];
        if (!token) {
            return res.status(401).json({ error: "Token required" });
        }

        // Verify token and get user
        const payload = await verifyAccessToken(token);
        if (!payload) {
            return res.status(401).json({ error: "Invalid or expired token" });
        }

        const user = await prisma.user.findUnique({
            where: { id: payload.sub },
        });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (user.banned) {
            if (user.banExpires && user.banExpires <= new Date()) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { banned: false, banReason: null, banExpires: null },
                });
            } else {
                return res.status(403).json({ error: "Account is suspended" });
            }
        }

        res.json({ user: userSummary(user) });
    } catch (error: any) {
        console.error("Get me error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
