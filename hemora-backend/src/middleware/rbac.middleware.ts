import type { Request, Response, NextFunction } from "express";
import { getUserFromToken, extractBearerToken } from "../lib/auth-jwt.js";
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
            const token = extractBearerToken(req.headers.authorization as string);
            if (!token) {
                return res.status(401).json({ error: "Unauthorized: Authorization header required" });
            }

            const user = await getUserFromToken(token);
            if (!user) {
                return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
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
            const token = extractBearerToken(req.headers.authorization as string);
            if (!token) {
                return res.status(401).json({ error: "Unauthorized: Authorization header required" });
            }

            const user = await getUserFromToken(token);
            if (!user) {
                return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
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