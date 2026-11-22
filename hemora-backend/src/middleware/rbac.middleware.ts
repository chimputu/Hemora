import type { Request, Response, NextFunction } from "express";
import { verifyAuthHeader } from "../lib/jwt-verify.js";
import { userHasPermission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        name?: string;
        role?: string | null;
        facilityId?: string | null;
        bloodGroup?: string | null;
    };
}

// Simple auth middleware — verifies JWT and sets req.user
export function requireAuth() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).json({ error: "Unauthorized: Authorization header required" });
            }

            const { user } = await verifyAuthHeader(authHeader);
            if (!user) {
                return res.status(401).json({ error: "Unauthorized: User not found" });
            }

            // Check if user is banned
            const dbUser = await prisma.user.findUnique({
                where: { id: user.id },
                select: { banned: true, banExpires: true },
            });
            if (dbUser?.banned) {
                // Allow access if ban has expired
                if (dbUser.banExpires && new Date(dbUser.banExpires) > new Date()) {
                    return res.status(403).json({ error: "Forbidden: Account is suspended" });
                }
                // If ban has no expiry or has expired, clear the ban flag
                if (!dbUser.banExpires || new Date(dbUser.banExpires) <= new Date()) {
                    await prisma.user.update({
                        where: { id: user.id },
                        data: { banned: false },
                    });
                }
            }

            req.user = {
                id: user.id,
                email: user.email,
                name: user.name || "",
                role: user.role,
                facilityId: user.facilityId,
                bloodGroup: user.bloodGroup,
            };
            return next();
        } catch {
            return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
        }
    };
}

// Permission-based middleware — verifies JWT and checks role permissions
export function requirePermission(permissions: Record<string, string[]>) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).json({ error: "Unauthorized: Authorization header required" });
            }

            const { user } = await verifyAuthHeader(authHeader);
            if (!user) {
                return res.status(401).json({ error: "Unauthorized: User not found" });
            }

            // Check if user is banned
            const dbUser = await prisma.user.findUnique({
                where: { id: user.id },
                select: { banned: true, banExpires: true },
            });
            if (dbUser?.banned) {
                // Allow access if ban has expired
                if (dbUser.banExpires && new Date(dbUser.banExpires) > new Date()) {
                    return res.status(403).json({ error: "Forbidden: Account is suspended" });
                }
                // If ban has no expiry or has expired, clear the ban flag
                if (!dbUser.banExpires || new Date(dbUser.banExpires) <= new Date()) {
                    await prisma.user.update({
                        where: { id: user.id },
                        data: { banned: false },
                    });
                }
            }

            if (!userHasPermission(user.role, permissions as Parameters<typeof userHasPermission>[1])) {
                return res.status(403).json({
                    error: "Forbidden: Insufficient permissions for this role",
                });
            }

            req.user = {
                id: user.id,
                email: user.email,
                name: user.name || "",
                role: user.role,
                facilityId: user.facilityId,
                bloodGroup: user.bloodGroup,
            };
            return next();
        } catch {
            return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
        }
    };
}