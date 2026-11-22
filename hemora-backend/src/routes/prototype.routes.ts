import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requirePermission, requireAuth, type AuthenticatedRequest } from "../middleware/rbac.middleware.js";
import { BloodGroup, BloodComponent, Urgency, RequisitionStatus, InvitationStatus, NotificationType } from "../generated/prisma/client.js";

const router = Router();
const ALL_GROUPS: BloodGroup[] = ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"];

// 1. GET Blood Inventory (with component support)
router.get("/inventory", requirePermission({ inventory: ["read"] }), async (_req, res) => {
    try {
        const stock = await prisma.bloodInventory.findMany({
            orderBy: [{ bloodGroup: "asc" }, { component: "asc" }],
        });
        res.json(stock);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load inventory" });
    }
});

// 2. POST Create or Update Blood Inventory Record
router.post("/inventory", requirePermission({ inventory: ["update"] }), async (req, res) => {
    try {
        const { bloodGroup, component, units, minThreshold, expiresAt } = req.body as {
            bloodGroup: BloodGroup;
            component: BloodComponent;
            units: number;
            minThreshold?: number;
            expiresAt?: string;
        };

        if (!bloodGroup || !component || units === undefined) {
            return res.status(400).json({ error: "bloodGroup, component, and units are required" });
        }

        const upserted = await prisma.bloodInventory.upsert({
            where: { bloodGroup_component: { bloodGroup, component } },
            create: {
                bloodGroup,
                component,
                units: Number(units),
                minThreshold: minThreshold ? Number(minThreshold) : 10,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
            },
            update: {
                units: Number(units),
                ...(minThreshold !== undefined && { minThreshold: Number(minThreshold) }),
                ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
            },
        });

        res.json(upserted);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create or update inventory record" });
    }
});

// 3. PATCH Blood Inventory Units
router.patch("/inventory/:bloodGroup", requirePermission({ inventory: ["update"] }), async (req, res) => {
    try {
        const bloodGroup = req.params.bloodGroup as BloodGroup;
        const { component, delta } = req.body as { component?: BloodComponent; delta: number };

        const current = component
            ? await prisma.bloodInventory.findUnique({
                where: { bloodGroup_component: { bloodGroup, component } },
            })
            : await prisma.bloodInventory.findFirst({ where: { bloodGroup } });

        if (!current) return res.status(404).json({ error: "Inventory record not found" });

        const updated = await prisma.bloodInventory.update({
            where: { id: current.id },
            data: { units: Math.max(0, current.units + Number(delta || 0)) },
        });

        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update stock" });
    }
});

// 3. GET All Blood Requisitions
router.get("/requisitions", requirePermission({ requisition: ["read"] }), async (_req, res) => {
    try {
        const list = await prisma.requisition.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                requester: { select: { name: true, role: true, facilityId: true } },
                facility: true,
            },
        });
        res.json(list);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load requisitions" });
    }
});

// 4. GET My Requisitions (current user only)
router.get("/requisitions/my", requirePermission({ requisition: ["read"] }), async (req: AuthenticatedRequest, res) => {
    try {
        const list = await prisma.requisition.findMany({
            where: { requesterId: req.user!.id },
            orderBy: { createdAt: "desc" },
            include: {
                facility: true,
            },
        });
        res.json(list);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load your requisitions" });
    }
});

// 5. POST Create New Requisition
router.post("/requisitions", requirePermission({ requisition: ["create"] }), async (req: AuthenticatedRequest, res) => {
    try {
        const { bloodGroup, component, unitsNeeded, urgency, patientName, patientRef, clinicalNote, facilityId } =
            req.body as {
                bloodGroup: BloodGroup;
                component?: BloodComponent;
                unitsNeeded: number;
                urgency?: Urgency;
                patientName?: string;
                patientRef?: string;
                clinicalNote?: string;
                facilityId?: string;
            };

        const created = await prisma.requisition.create({
            data: {
                requesterId: req.user!.id,
                bloodGroup,
                component: component || "WHOLE_BLOOD",
                unitsNeeded: Number(unitsNeeded),
                urgency: urgency || "ROUTINE",
                patientName: patientName || null,
                patientRef: patientRef || null,
                clinicalNote: clinicalNote || null,
                facilityId: facilityId || null,
            },
            include: {
                requester: { select: { name: true, role: true, facilityId: true } },
                facility: true,
            },
        });

        res.status(201).json(created);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create requisition" });
    }
});

// 6. PATCH Approve / Dispatch / Reject Requisition
router.patch("/requisitions/:id/status", requirePermission({ requisition: ["approve"] }), async (req, res) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { status } = req.body as { status: RequisitionStatus };

        const updated = await prisma.$transaction(async (tx) => {
            const record = await tx.requisition.findUnique({ where: { id } });
            if (!record) throw new Error("Requisition not found");

            if (status === "DISPATCHED" && record.status !== "DISPATCHED") {
                const stock = await tx.bloodInventory.findUnique({
                    where: { bloodGroup_component: { bloodGroup: record.bloodGroup, component: record.component } },
                });
                if (!stock || stock.units < record.unitsNeeded) {
                    throw new Error(`Insufficient ${record.bloodGroup} ${record.component} stock`);
                }
                await tx.bloodInventory.update({
                    where: { id: stock.id },
                    data: { units: { decrement: record.unitsNeeded } },
                });
            }

            const data: any = { status };
            if (status === "APPROVED") {
                data.approvedBy = (req as AuthenticatedRequest).user?.id || null;
                data.approvedAt = new Date();
            }
            return tx.requisition.update({ where: { id }, data });
        });

        res.json(updated);
    } catch (error: any) {
        res.status(400).json({ error: error.message || "Failed to update requisition status" });
    }
});

// 7. POST Blood Demand Forecast
router.post("/forecast", requirePermission({ forecast: ["view"] }), async (req, res) => {
    try {
        const { bloodGroup } = req.body as { bloodGroup: BloodGroup };
        const stock = await prisma.bloodInventory.findMany({ where: { bloodGroup } });
        const availableUnits = stock.reduce((sum, s) => sum + s.units, 0);

        let predictedDemand = 0;
        let engine = "XGBoost-FastAPI";

        try {
            const aiUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
            const aiApiKey = process.env.AI_SERVICE_API_KEY || "";
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (aiApiKey) {
                headers["Authorization"] = `Bearer ${aiApiKey}`;
            }
            const aiRes = await fetch(`${aiUrl}/predict`, {
                method: "POST",
                headers,
                body: JSON.stringify({ blood_group: bloodGroup, lead_time_days: 7 }),
                signal: controller.signal,
            }).finally(() => clearTimeout(timeoutId));
            if (!aiRes.ok) throw new Error("AI offline");
            const aiData = (await aiRes.json()) as { forecasted_demand_units: number };
            predictedDemand = Math.ceil(aiData.forecasted_demand_units);
        } catch {
            engine = "Prototype-Heuristic-Fallback";
            const baseline: Record<BloodGroup, number> = {
                O_POS: 34, O_NEG: 18, A_POS: 24, A_NEG: 12,
                B_POS: 20, B_NEG: 14, AB_POS: 10, AB_NEG: 8,
            };
            predictedDemand = baseline[bloodGroup] ?? 20;
        }

        const deficit = Math.max(0, predictedDemand - availableUnits);

        res.json({
            bloodGroup,
            availableUnits,
            predictedDemand,
            deficit,
            mobilizationRequired: deficit > 0,
            engine,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Forecast failed" });
    }
});

// 7a. POST Forecast All Blood Groups
router.post("/forecast/all", requirePermission({ forecast: ["view"] }), async (_req, res) => {
    try {
        const aiUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
        const aiApiKey = process.env.AI_SERVICE_API_KEY || "";
            
        let forecasts: Record<string, number> = {};
        let engine = "XGBoost-FastAPI";
            
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (aiApiKey) {
                headers["Authorization"] = `Bearer ${aiApiKey}`;
            }
            const aiRes = await fetch(`${aiUrl}/predict/all`, {
                method: "POST",
                headers,
                body: JSON.stringify({ lead_time_days: 7 }),
                signal: controller.signal,
            }).finally(() => clearTimeout(timeoutId));
            if (!aiRes.ok) throw new Error("AI offline");
            const aiData = (await aiRes.json()) as { forecasts: Record<string, number> };
            forecasts = aiData.forecasts;
        } catch {
            engine = "Prototype-Heuristic-Fallback";
            forecasts = {
                O_POS: 34, O_NEG: 18, A_POS: 24, A_NEG: 12,
                B_POS: 20, B_NEG: 14, AB_POS: 10, AB_NEG: 8,
            };
        }

        // Get current inventory for all groups
        const stock = await prisma.bloodInventory.findMany();
        const inventoryByGroup: Record<string, number> = {};
        for (const s of stock) {
            inventoryByGroup[s.bloodGroup] = (inventoryByGroup[s.bloodGroup] || 0) + s.units;
        }

        const results = ALL_GROUPS.map((bg) => {
            const availableUnits = inventoryByGroup[bg] || 0;
            const predictedDemand = Math.ceil(forecasts[bg] || 0);
            const deficit = Math.max(0, predictedDemand - availableUnits);
            return {
                bloodGroup: bg,
                availableUnits,
                predictedDemand,
                deficit,
                mobilizationRequired: deficit > 0,
                engine,
            };
        });

        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Forecast all failed" });
    }
});

// 7b. GET Model Info
router.get("/forecast/model-info", requirePermission({ forecast: ["view"] }), async (_req, res) => {
    try {
        const aiUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
        const aiApiKey = process.env.AI_SERVICE_API_KEY || "";
            
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const headers: Record<string, string> = {};
            if (aiApiKey) {
                headers["Authorization"] = `Bearer ${aiApiKey}`;
            }
            const aiRes = await fetch(`${aiUrl}/model-info`, {
                headers,
                signal: controller.signal,
            }).finally(() => clearTimeout(timeoutId));
            if (!aiRes.ok) throw new Error("AI offline");
            const info = await aiRes.json();
            res.json(info);
        } catch {
            res.json({
                model_type: "Prototype-Heuristic-Fallback",
                mae: null,
                rmse: null,
                r2: null,
                note: "AI service is offline. Using heuristic fallback.",
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load model info" });
    }
});

// 8. GET Facilities
router.get("/facilities", requirePermission({ inventory: ["read"] }), async (_req, res) => {
    try {
        const facilities = await prisma.facility.findMany({
            include: {
                _count: { select: { users: true } },
            },
            orderBy: { name: "asc" },
        });
        res.json(facilities);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load facilities" });
    }
});

// 9. GET Campaigns
router.get("/campaigns", requirePermission({ campaign: ["read"] }), async (_req, res) => {
    try {
        const campaigns = await prisma.campaign.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                _count: { select: { invitations: true } },
            },
        });
        res.json(campaigns);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load campaigns" });
    }
});

// 9a. POST Create Campaign with Invitations
router.post("/campaigns", requirePermission({ campaign: ["create"] }), async (req: AuthenticatedRequest, res) => {
    try {
        const { title, description, bloodGroup, targetUnits, startDate, endDate } = req.body as {
            title: string;
            description?: string;
            bloodGroup?: BloodGroup;
            targetUnits?: number;
            startDate?: string;
            endDate?: string;
        };

        if (!title) {
            return res.status(400).json({ error: "Title is required" });
        }

        // Create the campaign
        const campaign = await prisma.campaign.create({
            data: {
                title,
                description: description || null,
                bloodGroup: bloodGroup || null,
                targetUnits: targetUnits ? Number(targetUnits) : 10,
                status: "ACTIVE",
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                createdBy: req.user!.id,
            },
        });

        // Find eligible donors matching the blood group (or all donors if no blood group specified)
        const donorWhere: any = {
            role: "DONOR",
            eligible: true,
        };
        if (bloodGroup) {
            donorWhere.bloodGroup = bloodGroup;
        }

        const donors = await prisma.user.findMany({
            where: donorWhere,
            select: { id: true },
        });

        // Create invitations for each eligible donor
        if (donors.length > 0) {
            await prisma.campaignInvitation.createMany({
                data: donors.map((donor) => ({
                    campaignId: campaign.id,
                    donorId: donor.id,
                    status: "PENDING",
                })),
            });
        }

        // Return the campaign with invitation count
        const campaignWithCount = await prisma.campaign.findUnique({
            where: { id: campaign.id },
            include: {
                _count: { select: { invitations: true } },
            },
        });

        res.status(201).json(campaignWithCount);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create campaign" });
    }
});

// 10. GET User Profile
router.get("/me", requireAuth(), async (req: AuthenticatedRequest, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            select: {
                id: true,
                name: true,
                email: true,
                bloodGroup: true,
                phone: true,
                image: true,
                role: true,
                eligible: true,
                lastDonation: true,
                createdAt: true,
                updatedAt: true,
                facilityId: true,
                facility: true,
                requisitions: {
                    orderBy: { createdAt: "desc" },
                    take: 5,
                    select: {
                        id: true,
                        bloodGroup: true,
                        unitsNeeded: true,
                        status: true,
                        urgency: true,
                        createdAt: true,
                    },
                },
                campaignInvitations: {
                    orderBy: { sentAt: "desc" },
                    select: {
                        id: true,
                        status: true,
                        sentAt: true,
                        respondedAt: true,
                        campaign: { select: { id: true, title: true, status: true } },
                    },
                },
            },
        });
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load profile" });
    }
});

// 10a. GET User Role (lightweight, for mobile navigation guards)
router.get("/role", requireAuth(), async (req: AuthenticatedRequest, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            select: { role: true },
        });
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json({ role: user.role });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load role" });
    }
});

// 11. GET All Users (Admin only)
router.get("/users", requirePermission({ user: ["list"] }), async (_req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                bloodGroup: true,
                facilityId: true,
                eligible: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
        });
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load users" });
    }
});

// 11a. POST Create User (admin only — creates or updates any user record)
router.post("/users", requireAuth(), requirePermission({ user: ["create"] }), async (req, res) => {
    try {
        const { id, name, email, bloodGroup, role } = req.body as {
            id: string;
            name: string;
            email: string;
            bloodGroup?: string;
            role?: string;
        };

        if (!id || !name || !email) {
            return res.status(400).json({ error: "id, name, and email are required" });
        }

        // Validate role — only allow valid UserRole values; default to DONOR
        const validRoles = ["DONOR", "NURSE", "DOCTOR", "MANAGER", "ADMIN"];
        const sanitizedRole = (role && validRoles.includes(role)) ? role : "DONOR";

        // Validate bloodGroup — only allow valid BloodGroup values
        const validBloodGroups = ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"];
        const sanitizedBloodGroup = (bloodGroup && validBloodGroups.includes(bloodGroup)) ? bloodGroup : null;

        const user = await prisma.user.upsert({
            where: { id },
            create: {
                id,
                name,
                email,
                role: sanitizedRole as any,
                bloodGroup: sanitizedBloodGroup as any,
            },
            update: {
                name,
                bloodGroup: sanitizedBloodGroup as any,
                // Admin can update role only if explicitly provided and valid
                ...(role && validRoles.includes(role) && { role: sanitizedRole as any }),
            },
        });

        // Return sanitized user data (no sensitive fields)
        res.status(201).json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            bloodGroup: user.bloodGroup,
            createdAt: user.createdAt,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create user" });
    }
});

// 11b. POST Self-Register (any authenticated user creating their own DB record after sign-up)
router.post("/users/self", requireAuth(), async (req: AuthenticatedRequest, res) => {
    try {
        const authUserId = req.user?.id;
        if (!authUserId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { name, email, bloodGroup } = req.body as {
            name?: string;
            email?: string;
            bloodGroup?: string;
        };

        // Validate bloodGroup — only allow valid BloodGroup values
        const validBloodGroups = ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"];
        const sanitizedBloodGroup = (bloodGroup && validBloodGroups.includes(bloodGroup)) ? bloodGroup : null;

        // Only allow creating/updating the authenticated user's own record
        // Role is always DONOR for self-registration — cannot be manipulated
        const user = await prisma.user.upsert({
            where: { id: authUserId },
            create: {
                id: authUserId,
                name: name || authUserId,
                email: email || authUserId,
                role: "DONOR",
                bloodGroup: sanitizedBloodGroup as any,
            },
            update: {
                name: name || undefined,
                bloodGroup: sanitizedBloodGroup as any,
            },
        });

        // Return sanitized user data (no sensitive fields)
        res.status(201).json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            bloodGroup: user.bloodGroup,
            createdAt: user.createdAt,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create user profile" });
    }
});

// 12. GET System Statistics
router.get("/stats", requirePermission({ inventory: ["read"] }), async (_req, res) => {
    try {
        // User counts by role
        const userCounts = await prisma.user.groupBy({
            by: ["role"],
            _count: { role: true },
        });
        const usersByRole: Record<string, number> = {};
        for (const uc of userCounts) {
            usersByRole[uc.role] = uc._count.role;
        }
        const totalUsers = await prisma.user.count();

        // Facility count
        const totalFacilities = await prisma.facility.count();

        // Inventory stats
        const inventory = await prisma.bloodInventory.findMany();
        const totalBloodUnits = inventory.reduce((sum, s) => sum + s.units, 0);
        const lowStockCount = inventory.filter((s) => s.units < s.minThreshold).length;

        // Requisition counts by status
        const reqCounts = await prisma.requisition.groupBy({
            by: ["status"],
            _count: { status: true },
        });
        const requisitionsByStatus: Record<string, number> = {};
        for (const rc of reqCounts) {
            requisitionsByStatus[rc.status] = rc._count.status;
        }

        // Campaign count
        const totalCampaigns = await prisma.campaign.count();

        res.json({
            totalUsers,
            usersByRole,
            totalFacilities,
            totalBloodUnits,
            lowStockCount,
            requisitionsByStatus,
            totalCampaigns,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load system stats" });
    }
});

// 13. GET Facility Requisitions
router.get("/facilities/:id/requisitions", requirePermission({ requisition: ["read"] }), async (req, res) => {
    try {
        const facilityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const list = await prisma.requisition.findMany({
            where: { facilityId },
            orderBy: { createdAt: "desc" },
            include: {
                requester: { select: { name: true, role: true, facilityId: true } },
                facility: true,
            },
        });
        res.json(list);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load facility requisitions" });
    }
});

// Helper: create a notification for a user
async function createNotification(
    userId: string,
    title: string,
    message: string,
    type: NotificationType,
    relatedId?: string | null
) {
    try {
        await prisma.notification.create({
            data: {
                userId,
                title,
                message,
                type,
                relatedId: relatedId || null,
            },
        });
    } catch (err) {
        console.error("Failed to create notification:", err);
    }
}

// 14. PATCH Respond to Campaign Invitation (Accept or Decline)
router.patch("/invitations/:id/respond", requireAuth(), async (req: AuthenticatedRequest, res) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { status } = req.body as { status: InvitationStatus };

        if (!status || (status !== "ACCEPTED" && status !== "DECLINED")) {
            return res.status(400).json({ error: "Status must be ACCEPTED or DECLINED" });
        }

        const invitation = await prisma.campaignInvitation.findUnique({
            where: { id },
            include: { campaign: true },
        });

        if (!invitation) {
            return res.status(404).json({ error: "Invitation not found" });
        }

        if (invitation.donorId !== req.user!.id) {
            return res.status(403).json({ error: "You can only respond to your own invitations" });
        }

        if (invitation.status !== "PENDING") {
            return res.status(400).json({ error: `Invitation has already been ${invitation.status}` });
        }

        const updated = await prisma.campaignInvitation.update({
            where: { id },
            data: { status, respondedAt: new Date() },
            include: { campaign: true },
        });

        // Create notification for the donor about their response
        const notifType = status === "ACCEPTED" ? NotificationType.CAMPAIGN_ACCEPT : NotificationType.CAMPAIGN_DECLINE;
        const notifTitle = status === "ACCEPTED" ? "Donation Confirmed" : "Donation Declined";
        const notifMessage = status === "ACCEPTED"
            ? `You have confirmed your donation for "${updated.campaign.title}".`
            : `You have declined the invitation for "${updated.campaign.title}".`;
        await createNotification(req.user!.id, notifTitle, notifMessage, notifType, updated.campaignId);

        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to respond to invitation" });
    }
});

// 15. GET User Notifications
router.get("/notifications", requireAuth(), async (req: AuthenticatedRequest, res) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: { userId: req.user!.id },
            orderBy: { createdAt: "desc" },
            take: 50,
        });
        const unreadCount = await prisma.notification.count({
            where: { userId: req.user!.id, isRead: false },
        });
        res.json({ notifications, unreadCount });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load notifications" });
    }
});

// 16. PATCH Mark Notification as Read
router.patch("/notifications/:id/read", requireAuth(), async (req: AuthenticatedRequest, res) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const notification = await prisma.notification.findUnique({
            where: { id },
        });

        if (!notification) {
            return res.status(404).json({ error: "Notification not found" });
        }

        if (notification.userId !== req.user!.id) {
            return res.status(403).json({ error: "You can only mark your own notifications" });
        }

        const updated = await prisma.notification.update({
            where: { id },
            data: { isRead: true },
        });

        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to mark notification as read" });
    }
});

// 17. PATCH Mark All Notifications as Read
router.patch("/notifications/read-all", requireAuth(), async (req: AuthenticatedRequest, res) => {
    try {
        await prisma.notification.updateMany({
            where: { userId: req.user!.id, isRead: false },
            data: { isRead: true },
        });
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
});

// 18. GET Search (campaigns, facilities, requisitions)
router.get("/search", requireAuth(), async (req: AuthenticatedRequest, res) => {
    try {
        const q = (req.query.q as string || "").trim().toLowerCase();
        const type = (req.query.type as string || "").toLowerCase();

        if (!q) {
            return res.json({ campaigns: [], facilities: [], requisitions: [] });
        }

        const results: any = {};

        // Search campaigns
        if (!type || type === "campaign") {
            const campaigns = await prisma.campaign.findMany({
                where: {
                    OR: [
                        { title: { contains: q, mode: "insensitive" } },
                        { description: { contains: q, mode: "insensitive" } },
                    ],
                },
                orderBy: { createdAt: "desc" },
                take: 20,
            });
            results.campaigns = campaigns;
        }

        // Search facilities
        if (!type || type === "facility" || type === "hospital") {
            const facilities = await prisma.facility.findMany({
                where: {
                    OR: [
                        { name: { contains: q, mode: "insensitive" } },
                        { type: { contains: q, mode: "insensitive" } },
                        { address: { contains: q, mode: "insensitive" } },
                    ],
                },
                orderBy: { name: "asc" },
                take: 20,
            });
            results.facilities = facilities;
        }

        // Search requisitions — only search string fields (patientName, patientRef)
        // Enum fields (bloodGroup, status, urgency) cannot use contains operator
        if (!type || type === "requisition") {
            const requisitions = await prisma.requisition.findMany({
                where: {
                    OR: [
                        { patientName: { contains: q, mode: "insensitive" } },
                        { patientRef: { contains: q, mode: "insensitive" } },
                    ],
                },
                orderBy: { createdAt: "desc" },
                take: 20,
                select: {
                    id: true,
                    bloodGroup: true,
                    component: true,
                    unitsNeeded: true,
                    urgency: true,
                    status: true,
                    patientName: true,
                    patientRef: true,
                    createdAt: true,
                    facility: { select: { id: true, name: true } },
                },
            });
            results.requisitions = requisitions;
        }

        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Search failed" });
    }
});

// 19. PATCH Update User Profile
router.patch("/me", requireAuth(), async (req: AuthenticatedRequest, res) => {
    try {
        const { name, phone, bloodGroup } = req.body as {
            name?: string;
            phone?: string;
            bloodGroup?: BloodGroup;
        };

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (phone !== undefined) updateData.phone = phone;
        if (bloodGroup !== undefined) updateData.bloodGroup = bloodGroup;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }

        const updated = await prisma.user.update({
            where: { id: req.user!.id },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                bloodGroup: true,
                phone: true,
                image: true,
                role: true,
                eligible: true,
                lastDonation: true,
                createdAt: true,
                updatedAt: true,
                facilityId: true,
            },
        });

        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update profile" });
    }
});

// 20. POST Join a Campaign (create or find PENDING invitation)
router.post("/campaigns/:id/join", requireAuth(), async (req: AuthenticatedRequest, res) => {
    try {
        const campaignId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
        });

        if (!campaign) {
            return res.status(404).json({ error: "Campaign not found" });
        }

        if (campaign.status !== "ACTIVE") {
            return res.status(400).json({ error: "Campaign is not active" });
        }

        // Check if invitation already exists
        const existing = await prisma.campaignInvitation.findFirst({
            where: {
                campaignId,
                donorId: req.user!.id,
                status: "PENDING",
            },
        });

        if (existing) {
            return res.json({ invitation: existing, alreadyInvited: true });
        }

        // Create a new invitation
        const invitation = await prisma.campaignInvitation.create({
            data: {
                campaignId,
                donorId: req.user!.id,
                status: "PENDING",
            },
            include: { campaign: true },
        });

        // Create notification for the donor
        await createNotification(
            req.user!.id,
            "Campaign Registration",
            `You have registered for "${campaign.title}". Please confirm your participation.`,
            NotificationType.CAMPAIGN_JOIN,
            campaignId
        );

        res.status(201).json({ invitation, alreadyInvited: false });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to join campaign" });
    }
});

// 21. PATCH Cancel Invitation (DECLINE a PENDING invitation)
router.patch("/invitations/:id/cancel", requireAuth(), async (req: AuthenticatedRequest, res) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

        const invitation = await prisma.campaignInvitation.findUnique({
            where: { id },
            include: { campaign: true },
        });

        if (!invitation) {
            return res.status(404).json({ error: "Invitation not found" });
        }

        if (invitation.donorId !== req.user!.id) {
            return res.status(403).json({ error: "You can only cancel your own invitations" });
        }

        if (invitation.status !== "PENDING") {
            return res.status(400).json({ error: `Invitation has already been ${invitation.status}` });
        }

        const updated = await prisma.campaignInvitation.update({
            where: { id },
            data: { status: "DECLINED", respondedAt: new Date() },
            include: { campaign: true },
        });

        // Create notification for the donor
        await createNotification(
            req.user!.id,
            "Donation Cancelled",
            `You have cancelled your upcoming donation for "${updated.campaign.title}".`,
            NotificationType.CAMPAIGN_DECLINE,
            updated.campaignId
        );

        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to cancel invitation" });
    }
});

// 22. GET Campaign by ID
router.get("/campaigns/:id", requirePermission({ campaign: ["read"] }), async (req, res) => {
    try {
        const campaignId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: {
                _count: { select: { invitations: true } },
            },
        });

        if (!campaign) {
            return res.status(404).json({ error: "Campaign not found" });
        }

        res.json(campaign);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load campaign" });
    }
});

// 23. GET Unread Notification Count (lightweight)
router.get("/notifications/unread-count", requireAuth(), async (req: AuthenticatedRequest, res) => {
    try {
        const count = await prisma.notification.count({
            where: { userId: req.user!.id, isRead: false },
        });
        res.json({ count });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load unread count" });
    }
});

export default router;