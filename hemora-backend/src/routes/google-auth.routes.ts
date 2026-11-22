import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { verifyGoogleIdToken } from "../lib/google-auth.js";
import { generateAccessToken } from "../lib/auth-jwt.js";
import { createRefreshToken } from "../lib/token.js";

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

// ── POST /auth/google/verify ──
router.post("/google/verify", async (req: Request, res: Response) => {
    try {
        const { id_token } = req.body;

        if (!id_token) {
            return res.status(400).json({ error: "Google ID token is required" });
        }

        const googleClientId = process.env.GOOGLE_CLIENT_ID;
        if (!googleClientId) {
            console.error(
                "GOOGLE_CLIENT_ID is not configured. Google Sign-In is unavailable.",
            );
            return res.status(503).json({
                error: "Google Sign-In is not configured",
            });
        }

        // Verify the Google ID token
        let googlePayload: any;
        try {
            googlePayload = await verifyGoogleIdToken(id_token, googleClientId);
        } catch (error: any) {
            console.error("Google token verification failed:", error.message);
            return res.status(401).json({
                error: "Invalid Google ID token",
            });
        }

        const { sub: googleSub, email, email_verified, name, picture } =
            googlePayload;
        const normalizedEmail = email.toLowerCase().trim();

        // Check if this Google account is already linked to a HEMORA user
        const existingGoogleAccount = await prisma.googleAccount.findUnique({
            where: { googleSub },
            include: { user: true },
        });

        if (existingGoogleAccount) {
            // Google account already linked — sign in the existing user
            const user = existingGoogleAccount.user;

            // Check if user is banned
            if (user.banned) {
                if (user.banExpires && user.banExpires <= new Date()) {
                    await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            banned: false,
                            banReason: null,
                            banExpires: null,
                        },
                    });
                } else {
                    return res.status(403).json({ error: "Account is suspended" });
                }
            }

            const accessToken = await generateAccessToken(
                user.id,
                user.email,
                user.role,
            );
            const { rawToken: refreshToken } = await createRefreshToken(user.id);

            return res.json({
                user: userSummary(user),
                access_token: accessToken,
                refresh_token: refreshToken,
            });
        }

        // Google account not linked — check if email exists in HEMORA
        const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });

        if (existingUser) {
            // Email exists but Google account is not linked
            // Link the Google account to the existing HEMORA user safely
            // Google-verified email means we can trust the email is verified
            const updatedUser = await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    googleAccounts: {
                        create: {
                            googleSub,
                            email: normalizedEmail,
                        },
                    },
                    emailVerified: true,
                    image: picture || existingUser.image,
                },
                include: { googleAccounts: true },
            });

            // Check if user is banned
            if (updatedUser.banned) {
                if (
                    updatedUser.banExpires &&
                    updatedUser.banExpires <= new Date()
                ) {
                    await prisma.user.update({
                        where: { id: updatedUser.id },
                        data: {
                            banned: false,
                            banReason: null,
                            banExpires: null,
                        },
                    });
                } else {
                    return res
                        .status(403)
                        .json({ error: "Account is suspended" });
                }
            }

            const accessToken = await generateAccessToken(
                updatedUser.id,
                updatedUser.email,
                updatedUser.role,
            );
            const { rawToken: refreshToken } = await createRefreshToken(
                updatedUser.id,
            );

            return res.json({
                user: userSummary(updatedUser),
                access_token: accessToken,
                refresh_token: refreshToken,
            });
        }

        // No existing account — create a new HEMORA user
        // New Google users get DONOR role by default
        // Google-verified email means we can mark emailVerified as true
        const newUser = await prisma.user.create({
            data: {
                name: name || "Google User",
                email: normalizedEmail,
                emailVerified: email_verified,
                image: picture || null,
                role: "DONOR",
                banned: false,
                googleAccounts: {
                    create: {
                        googleSub,
                        email: normalizedEmail,
                    },
                },
            },
            include: { googleAccounts: true },
        });

        const accessToken = await generateAccessToken(
            newUser.id,
            newUser.email,
            newUser.role,
        );
        const { rawToken: refreshToken } = await createRefreshToken(newUser.id);

        res.status(201).json({
            user: userSummary(newUser),
            access_token: accessToken,
            refresh_token: refreshToken,
        });
    } catch (error: any) {
        console.error("Google auth error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
