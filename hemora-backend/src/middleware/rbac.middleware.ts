import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        name: string;
        role?: string | null;
        facility?: string | null;
        bloodGroup?: string | null;
    };
}

// Simple auth middleware — sets req.user without checking specific permissions
export function requireAuth() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const session = await auth.api.getSession({
                headers: fromNodeHeaders(req.headers),
            });

            if (!session || !session.user) {
                return res.status(401).json({ error: "Unauthorized: Active session required" });
            }

            req.user = session.user as AuthenticatedRequest["user"];
            return next();
        } catch (error) {
            console.error("Auth Middleware Error:", error);
            return res.status(500).json({ error: "Internal authorization error" });
        }
    };
}

export function requirePermission(permissions: Record<string, string[]>) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const session = await auth.api.getSession({
                headers: fromNodeHeaders(req.headers),
            });

            if (!session || !session.user) {
                return res.status(401).json({ error: "Unauthorized: Active session required" });
            }

            const permissionCheck = await auth.api.userHasPermission({
                body: {
                    userId: session.user.id,
                    permissions,
                },
            });

            if (!permissionCheck.success) {
                return res.status(403).json({
                    error: "Forbidden: Insufficient permissions for this role",
                });
            }

            req.user = session.user as AuthenticatedRequest["user"];
            return next();
        } catch (error) {
            console.error("RBAC Middleware Error:", error);
            return res.status(500).json({ error: "Internal authorization error" });
        }
    };
}