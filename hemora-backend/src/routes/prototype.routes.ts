import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requirePermission, requireAuth, type AuthenticatedRequest } from "../middleware/rbac.middleware.js";
import { BloodGroup, BloodComponent, Urgency, RequisitionStatus, InvitationStatus } from "../generated/prisma/client.js";

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
            const aiRes = await fetch(`${aiUrl}/predict`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ blood_group: bloodGroup, lead_time_days: 7 }),
            });
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
        
        let forecasts: Record<string, number> = {};
        let engine = "XGBoost-FastAPI";
        
        try {
            const aiRes = await fetch(`${aiUrl}/predict/all`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lead_time_days: 7 }),
            });
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
        
        try {
            const aiRes = await fetch(`${aiUrl}/model-info`);
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
                invitations: {
                    include: {
                        donor: { select: { name: true, email: true, bloodGroup: true } },
                    },
                },
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
            include: {
                facility: true,
                requisitions: {
                    orderBy: { createdAt: "desc" },
                    take: 5,
                },
                campaignInvitations: {
                    orderBy: { sentAt: "desc" },
                    include: { campaign: true },
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

        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to respond to invitation" });
    }
});

export default router;