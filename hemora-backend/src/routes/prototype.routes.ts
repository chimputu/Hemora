import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requirePermission, requireAuth, type AuthenticatedRequest } from "../middleware/rbac.middleware.js";
import { BloodGroup, BloodComponent, Urgency, RequisitionStatus, InvitationStatus, NotificationType } from "../generated/prisma/client.js";
import { Expo, ExpoPushMessage } from "expo-server-sdk";
import cloudinary from "../config/cloudinary.js";
import { upload } from "../lib/upload.js";

const router = Router();
const ALL_GROUPS: BloodGroup[] = ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"];

// Simple in-memory cache for dashboard endpoints (TTL-based, no external deps)
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 1000 * 60 * 2; // 2 minutes

function getCached<T>(key: string): T | undefined {
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return undefined;
    }
    return entry.data as T;
}
function setCache(key: string, data: unknown) {
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}
function invalidateCache(pattern: string) {
    for (const key of cache.keys()) {
        if (key.includes(pattern)) cache.delete(key);
    }
}

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

// 6a. POST Distribute Blood to Facility (Admin-only shortcut)
// Sets the requisition status to DISPATCHED and deducts from inventory
router.post("/requisitions/:id/distribute", requirePermission({ requisition: ["approve"] }), async (req, res) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

        const updated = await prisma.$transaction(async (tx) => {
            const record = await tx.requisition.findUnique({ where: { id } });
            if (!record) throw new Error("Requisition not found");

            if (record.status === "DISPATCHED") {
                throw new Error("This requisition has already been dispatched");
            }

            const stock = await tx.bloodInventory.findUnique({
                where: { bloodGroup_component: { bloodGroup: record.bloodGroup, component: record.component } },
            });
            if (!stock || stock.units < record.unitsNeeded) {
                throw new Error(`Insufficient ${record.bloodGroup} ${record.component} stock for distribution`);
            }
            await tx.bloodInventory.update({
                where: { id: stock.id },
                data: { units: { decrement: record.unitsNeeded } },
            });

            return tx.requisition.update({
                where: { id },
                data: {
                    status: "DISPATCHED",
                    approvedBy: (req as AuthenticatedRequest).user?.id || null,
                    approvedAt: new Date(),
                },
            });
        });

        res.json({ message: "Blood distributed successfully", requisition: updated });
    } catch (error: any) {
        res.status(400).json({ error: error.message || "Failed to distribute blood" });
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
router.get("/facilities", requirePermission({ facility: ["read"] }), async (_req, res) => {
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

// 8a. GET Facility by ID
router.get("/facilities/:id", requirePermission({ facility: ["read"] }), async (req, res) => {
    try {
        const facilityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const facility = await prisma.facility.findUnique({
            where: { id: facilityId },
            include: {
                users: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        bloodGroup: true,
                        phone: true,
                    },
                },
                requisitions: {
                    orderBy: { createdAt: "desc" },
                    take: 10,
                    include: {
                        requester: { select: { name: true, role: true } },
                    },
                },
                _count: { select: { users: true, requisitions: true } },
            },
        });

        if (!facility) {
            return res.status(404).json({ error: "Facility not found" });
        }

        res.json(facility);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load facility details" });
    }
});

// 8b. POST Create Facility (ADMIN, MANAGER only)
router.post("/facilities", requirePermission({ facility: ["create"] }), async (req, res) => {
    try {
        const { name, type, address, phone } = req.body as {
            name: string;
            type: string;
            address?: string;
            phone?: string;
        };

        if (!name || !type) {
            return res.status(400).json({ error: "Name and type are required" });
        }

        // Validate type
        const validTypes = ["Hospital", "Clinic", "Blood Bank", "Health Center", "Mobile Unit"];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(", ")}` });
        }

        const facility = await prisma.facility.create({
            data: {
                name,
                type,
                address: address || null,
                phone: phone || null,
            },
        });

        // Invalidate dashboard counts cache since facility count changed
        invalidateCache("dashboard");

        res.status(201).json(facility);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create facility" });
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

// 9a. POST Create Campaign with Image Upload, Invitations, and Push Notifications
// Use upload middleware for multipart/form-data (image + fields)
router.post("/campaigns", requirePermission({ campaign: ["create"] }), upload.single("image"), async (req: AuthenticatedRequest, res) => {
    try {
        const body = req.body as any;
        const {
            title, description, bloodGroup, targetUnits, startDate, endDate,
            locationName, latitude, longitude,
            contactName, contactPhone, contactWhatsApp,
            services, availableItems, notificationType
        } = body;

        if (!title) {
            return res.status(400).json({ error: "Title is required" });
        }

        // Upload image to Cloudinary if provided
        let imageUrl: string | null = null;
        if (req.file) {
            try {
                const uploadResult = await new Promise<any>((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { folder: "hemora-campaigns" },
                        (error: any, result: any) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    stream.end(req.file!.buffer);
                });
                imageUrl = uploadResult.secure_url;
            } catch (err) {
                console.error("[Campaign] Cloudinary upload failed:", err);
                // Continue without image — don't fail the whole request
            }
        }

        // Parse arrays from comma-separated strings
        const servicesArray: string[] = services
            ? services.split(",").map((s: string) => s.trim()).filter(Boolean)
            : [];
        const itemsArray: string[] = availableItems
            ? availableItems.split(",").map((s: string) => s.trim()).filter(Boolean)
            : [];

        // Create the campaign with all new fields
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
                imageUrl,
                locationName: locationName || null,
                latitude: latitude ? parseFloat(latitude) : null,
                longitude: longitude ? parseFloat(longitude) : null,
                contactName: contactName || null,
                contactPhone: contactPhone || null,
                contactWhatsApp: contactWhatsApp || null,
                services: servicesArray,
                availableItems: itemsArray,
                notificationType: notificationType || "info",
            },
        });

        // Find eligible donors and create invitations
        const donorWhere: any = { role: "DONOR", eligible: true };
        if (bloodGroup) donorWhere.bloodGroup = bloodGroup;
        const donors = await prisma.user.findMany({ where: donorWhere, select: { id: true } });
        if (donors.length > 0) {
            await prisma.campaignInvitation.createMany({
                data: donors.map((donor) => ({ campaignId: campaign.id, donorId: donor.id, status: "PENDING" })),
            });
        }

        // Send push notifications to all users with pushToken (excluding creator)
        try {
            const usersWithTokens = await prisma.user.findMany({
                where: { pushToken: { not: null }, id: { not: req.user!.id } },
                select: { pushToken: true, name: true },
            });
            if (usersWithTokens.length > 0) {
                const expoSdk = new Expo();
                const notifications: ExpoPushMessage[] = usersWithTokens.map((u) => ({
                    to: u.pushToken!,
                    sound: "default",
                    title: `[${(notificationType || "info").toUpperCase()}] New Campaign: ${title}`,
                    body: `A new blood drive has been posted at ${locationName || "a nearby location"}. Tap for details.`,
                    data: { campaignId: campaign.id },
                }));
                const tickets = expoSdk.sendPushNotificationsAsync(notifications);
                console.log(`[Campaign] Push notifications sent to ${usersWithTokens.length} users`);
            }
        } catch (notifErr) {
            console.error("[Campaign] Push notification error:", notifErr);
            // Don't fail the campaign creation if notifications fail
        }

        // Return the campaign
        const campaignWithCount = await prisma.campaign.findUnique({
            where: { id: campaign.id },
            include: { _count: { select: { invitations: true } } },
        });
        // Invalidate dashboard cache so the new campaign shows up immediately
        invalidateCache("dashboard");
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
                        campaign: { select: { id: true, title: true, status: true, startDate: true, endDate: true, location: true } },
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
                whatsappNumber: true,
                phoneNumber: true,
                location: true,
                age: true,
                avatarUrl: true,
            },
            orderBy: { createdAt: "desc" },
        });
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load users" });
    }
});

// 11c. PUT Update User (Admin only)
router.put("/users/:id", requireAuth(), requirePermission({ user: ["set-role"] }), async (req: AuthenticatedRequest, res) => {
    try {
        const userId = typeof req.params.id === "string" ? req.params.id : "";
        const rawBody = req.body as any;
        const name = typeof rawBody.name === "string" ? rawBody.name : undefined;
        const email = typeof rawBody.email === "string" ? rawBody.email : undefined;
        const bloodGroup = typeof rawBody.bloodGroup === "string" ? rawBody.bloodGroup : undefined;
        const role = typeof rawBody.role === "string" ? rawBody.role : undefined;
        const whatsappNumber = typeof rawBody.whatsappNumber === "string" ? rawBody.whatsappNumber : undefined;
        const phoneNumber = typeof rawBody.phoneNumber === "string" ? rawBody.phoneNumber : undefined;
        const location = typeof rawBody.location === "string" ? rawBody.location : undefined;
        const age = typeof rawBody.age === "number" ? rawBody.age : undefined;

        // Prevent admin from modifying themselves
        if (userId === req.user!.id) {
            return res.status(403).json({ error: "Cannot modify your own account via this endpoint" });
        }

        // Validate role
        const validRoles = ["DONOR", "NURSE", "DOCTOR", "MANAGER", "ADMIN"];
        const validBloodGroups = ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"];

        const updateData: any = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (role && validRoles.includes(role)) updateData.role = role as any;
        if (bloodGroup && validBloodGroups.includes(bloodGroup)) updateData.bloodGroup = bloodGroup as any;
        if (whatsappNumber !== undefined) updateData.whatsappNumber = whatsappNumber || null;
        if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber || null;
        if (location !== undefined) updateData.location = location || null;
        if (age !== undefined) updateData.age = age || null;

        const user = await prisma.user.update({
            where: { id: userId },
            data: updateData,
        });
        res.json(user);
    } catch (error: any) {
        console.error(error);
        if (error.code === "P2025") return res.status(404).json({ error: "User not found" });
        res.status(500).json({ error: "Failed to update user" });
    }
});

// 11d. DELETE User (Admin only)
router.delete("/users/:id", requireAuth(), requirePermission({ user: ["delete"] }), async (req: AuthenticatedRequest, res) => {
    try {
        const userId = typeof req.params.id === "string" ? req.params.id : "";

        // Prevent admin from deleting themselves
        if (userId === req.user!.id) {
            return res.status(403).json({ error: "Cannot delete your own account" });
        }

        await prisma.user.delete({ where: { id: userId } });
        res.json({ success: true, message: "User deleted" });
    } catch (error: any) {
        console.error(error);
        if (error.code === "P2025") return res.status(404).json({ error: "User not found" });
        res.status(500).json({ error: "Failed to delete user" });
    }
});

// 11e. PUT Update own profile (any authenticated user) — includes avatar upload via Cloudinary
router.put("/users/profile", requireAuth(), (req: any, res: any, next: any) => {
    const ct = (req.headers["content-type"] || "");
    if (ct.includes("multipart/form-data")) {
        upload.single("avatar")(req, res, next);
    } else {
        next();
    }
}, async (req: AuthenticatedRequest, res) => {
    try {
        const userId = req.user!.id;
        const rawBody = req.body as any;
        const whatsappNumber = typeof rawBody.whatsappNumber === "string" ? rawBody.whatsappNumber : undefined;
        const location = typeof rawBody.location === "string" ? rawBody.location : undefined;
        const ageRaw = rawBody.age;
        const age = ageRaw ? parseInt(String(ageRaw), 10) : undefined;

        const updateData: any = {};
        if (whatsappNumber !== undefined) updateData.whatsappNumber = whatsappNumber || null;
        if (location !== undefined) updateData.location = location || null;
        if (age !== undefined && !isNaN(age)) updateData.age = age || null;

        if (req.file) {
            try {
                const uploadResult = await new Promise<any>((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { folder: "hemora-avatars", width: 300, height: 300, crop: "fill" },
                        (error: any, result: any) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    stream.end(req.file!.buffer);
                });
                updateData.avatarUrl = uploadResult.secure_url;
            } catch (err) {
                console.error("[Profile] Cloudinary avatar upload failed:", err);
            }
        }

        const updated = await prisma.user.update({
            where: { id: userId },
            data: updateData,
        });
        res.json(updated);
    } catch (error: any) {
        console.error("[Profile] Error:", error.message || error);
        res.status(500).json({ error: "Failed to update profile", detail: error.message });
    }
});

// 11a. POST Create User (admin only — creates a new user with password)
router.post("/users", requireAuth(), requirePermission({ user: ["create"] }), async (req, res) => {
    try {
        const { name, email, password, bloodGroup, role, whatsappNumber, phoneNumber, location, age } = req.body as {
            name: string;
            email: string;
            password?: string;
            bloodGroup?: string;
            role?: string;
            whatsappNumber?: string;
            phoneNumber?: string;
            location?: string;
            age?: number;
        };

        if (!name || !email) {
            return res.status(400).json({ error: "name and email are required" });
        }

        // Validate role
        const validRoles = ["DONOR", "NURSE", "DOCTOR", "MANAGER", "ADMIN"];
        const sanitizedRole = (role && validRoles.includes(role)) ? role : "DONOR";

        // Validate bloodGroup
        const validBloodGroups = ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"];
        const sanitizedBloodGroup = (bloodGroup && validBloodGroups.includes(bloodGroup)) ? bloodGroup : null;

        // Hash password if provided
        let passwordHash: string | undefined;
        if (password) {
            const { hashPassword } = await import("../lib/password.js");
            passwordHash = await hashPassword(password);
        }

        const user = await prisma.user.create({
            data: {
                name,
                email,
                role: sanitizedRole as any,
                bloodGroup: sanitizedBloodGroup as any,
                ...(passwordHash && { passwordHash }),
                ...(whatsappNumber && { whatsappNumber }),
                ...(phoneNumber && { phoneNumber }),
                ...(location && { location }),
                ...(age && { age }),
            },
            select: {
                id: true, name: true, email: true, role: true, bloodGroup: true,
                whatsappNumber: true, phoneNumber: true, location: true, age: true, avatarUrl: true,
            },
        });

        res.status(201).json(user);
    } catch (error: any) {
        console.error(error);
        if (error.code === "P2002") return res.status(409).json({ error: "A user with this email already exists" });
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

        // Weekly donation trend: count accepted invitations per day for the last 7 days
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const acceptedInvitations = await prisma.campaignInvitation.findMany({
            where: {
                status: "ACCEPTED",
                respondedAt: { gte: sevenDaysAgo },
            },
            select: { respondedAt: true },
        });
        const trendByDay: Record<string, number> = {};
        for (const inv of acceptedInvitations) {
            if (!inv.respondedAt) continue;
            const dayKey = inv.respondedAt.toISOString().slice(0, 10); // YYYY-MM-DD
            trendByDay[dayKey] = (trendByDay[dayKey] || 0) + 1;
        }
        // Build a 7-day array ordered Mon–Sun (or Sun–Sat depending on locale; use last 7 calendar days)
        const donationTrend: number[] = [];
        let totalDonationsThisWeek = 0;
        for (let i = 6; i >= 0; i--) {
            const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dayKey = day.toISOString().slice(0, 10);
            const count = trendByDay[dayKey] || 0;
            donationTrend.push(count);
            totalDonationsThisWeek += count;
        }

        // Previous week for comparison
        const prevSevenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        const prevAcceptedInvitations = await prisma.campaignInvitation.findMany({
            where: {
                status: "ACCEPTED",
                respondedAt: { gte: prevSevenDaysAgo, lt: sevenDaysAgo },
            },
            select: { respondedAt: true },
        });
        const totalDonationsPrevWeek = prevAcceptedInvitations.length;
        const trendPercentChange = totalDonationsPrevWeek > 0
            ? Math.round(((totalDonationsThisWeek - totalDonationsPrevWeek) / totalDonationsPrevWeek) * 100)
            : totalDonationsThisWeek > 0 ? 100 : 0;

        res.json({
            totalUsers,
            usersByRole,
            totalFacilities,
            totalBloodUnits,
            lowStockCount,
            requisitionsByStatus,
            totalCampaigns,
            donationTrend,
            totalDonationsThisWeek,
            totalDonationsPrevWeek,
            trendPercentChange,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load system stats" });
    }
});

// 12b. GET Dashboard Summary Counts (cached)
router.get("/dashboard-counts", requirePermission({ inventory: ["read"] }), async (_req, res) => {
    try {
        // Check cache first
        const cached = getCached<{
            totalCampaigns: number;
            activeCampaigns: number;
            totalDonors: number;
            totalRequisitions: number;
            urgentRequisitions: number;
            totalInventory: number;
            totalFacilities: number;
            totalUsers: number;
            totalNurses: number;
            totalDoctors: number;
            totalManagers: number;
        }>("dashboard-counts");
        if (cached) return res.json(cached);

        const [totalCampaigns, activeCampaigns, totalDonors, totalRequisitions, urgentRequisitions, inventory, totalFacilities, totalUsers, totalNurses, totalDoctors, totalManagers] = await Promise.all([
            prisma.campaign.count(),
            prisma.campaign.count({ where: { status: "ACTIVE" } }),
            prisma.user.count({ where: { role: "DONOR" } }),
            prisma.requisition.count(),
            prisma.requisition.count({ where: { urgency: "URGENT" } }),
            prisma.bloodInventory.findMany(),
            prisma.facility.count(),
            prisma.user.count(),
            prisma.user.count({ where: { role: "NURSE" } }),
            prisma.user.count({ where: { role: "DOCTOR" } }),
            prisma.user.count({ where: { role: "MANAGER" } }),
        ]);
        const totalInventory = inventory.reduce((sum, s) => sum + s.units, 0);

        const result = { totalCampaigns, activeCampaigns, totalDonors, totalRequisitions, urgentRequisitions, totalInventory, totalFacilities, totalUsers, totalNurses, totalDoctors, totalManagers };
        setCache("dashboard-counts", result);
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load dashboard counts" });
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

// 18. GET Search (campaigns, facilities, requisitions, users)
router.get("/search", requireAuth(), async (req: AuthenticatedRequest, res) => {
    try {
        const q = (req.query.q as string || "").trim().toLowerCase();
        const type = (req.query.type as string || "").toLowerCase();
        const role = (req.query.role as string || "").toUpperCase();
        const location = (req.query.location as string || "").trim().toLowerCase();

        if (!q && !role && !location) {
            return res.json({ campaigns: [], facilities: [], requisitions: [], users: [] });
        }

        const results: any = {};

        // Search campaigns
        if (!type || type === "campaign") {
            const campaignWhere: any = {};
            if (q) {
                campaignWhere.OR = [
                    { title: { contains: q, mode: "insensitive" } },
                    { description: { contains: q, mode: "insensitive" } },
                ];
            }
            if (location) {
                campaignWhere.location = { contains: location, mode: "insensitive" };
            }
            const campaigns = await prisma.campaign.findMany({
                where: campaignWhere,
                orderBy: { createdAt: "desc" },
                take: 20,
            });
            results.campaigns = campaigns;
        }

        // Search facilities
        if (!type || type === "facility" || type === "hospital") {
            const facilityWhere: any = {};
            if (q) {
                facilityWhere.OR = [
                    { name: { contains: q, mode: "insensitive" } },
                    { type: { contains: q, mode: "insensitive" } },
                    { address: { contains: q, mode: "insensitive" } },
                ];
            }
            if (location) {
                facilityWhere.address = { contains: location, mode: "insensitive" };
            }
            const facilities = await prisma.facility.findMany({
                where: facilityWhere,
                orderBy: { name: "asc" },
                take: 20,
            });
            results.facilities = facilities;
        }

        // Search requisitions by patient name, blood group, urgency, and facility name
        if (!type || type === "requisition") {
            // Build OR clauses — enums use equality, strings use contains
            const orClauses: any[] = [
                { patientName: { contains: q, mode: "insensitive" } },
                { patientRef: { contains: q, mode: "insensitive" } },
                { facility: { name: { contains: q, mode: "insensitive" } } },
            ];
            // Map common blood group formats to enum values (O+ → O_POS, etc.)
            const bgMap: Record<string, string> = {
                "O+": "O_POS", "O-": "O_NEG", "A+": "A_POS", "A-": "A_NEG",
                "B+": "B_POS", "B-": "B_NEG", "AB+": "AB_POS", "AB-": "AB_NEG",
            };
            const enumQ = q.toUpperCase();
            const mappedBg = bgMap[enumQ];
            if (mappedBg) {
                orClauses.push({ bloodGroup: mappedBg });
            }
            // Urgency enum values: ROUTINE, URGENT, EMERGENCY
            if (["ROUTINE", "URGENT", "EMERGENCY"].includes(enumQ)) {
                orClauses.push({ urgency: enumQ });
            }
            const requisitions = await prisma.requisition.findMany({
                where: { OR: orClauses },
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

        // Search users (ADMIN and MANAGER only)
        if ((!type || type === "user") && (req.user!.role === "ADMIN" || req.user!.role === "MANAGER")) {
            const userWhere: any = {};
            if (q) {
                userWhere.OR = [
                    { name: { contains: q, mode: "insensitive" } },
                    { email: { contains: q, mode: "insensitive" } },
                    { phone: { contains: q, mode: "insensitive" } },
                ];
            }
            if (role) {
                userWhere.role = role;
            }
            if (location) {
                userWhere.OR = [
                    { location: { contains: location, mode: "insensitive" } },
                    { facility: { address: { contains: location, mode: "insensitive" } } },
                ];
            }
            const users = await prisma.user.findMany({
                where: userWhere,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    bloodGroup: true,
                    phone: true,
                    location: true,
                    eligible: true,
                    facility: { select: { id: true, name: true, type: true, address: true } },
                },
                orderBy: { name: "asc" },
                take: 20,
            });
            results.users = users;
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

// 20. POST Join a Campaign (create or find PENDING invitation) — DONOR role only
router.post("/campaigns/:id/join", requireAuth(), async (req: AuthenticatedRequest, res) => {
    try {
        // Only DONOR role can join campaigns
        if (req.user?.role !== "DONOR") {
            return res.status(403).json({ error: "Only donors can join campaigns" });
        }

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

// 22a. DELETE Campaign (ADMIN only)
router.delete("/campaigns/:id", requirePermission({ campaign: ["create"] }), async (req, res) => {
    try {
        const campaignId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
        });

        if (!campaign) {
            return res.status(404).json({ error: "Campaign not found" });
        }

        // Delete invitations first
        await prisma.campaignInvitation.deleteMany({
            where: { campaignId },
        });

        // Delete the campaign
        await prisma.campaign.delete({
            where: { id: campaignId },
        });

        // Invalidate dashboard cache
        invalidateCache("dashboard");

        res.json({ message: "Campaign deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to delete campaign" });
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

// 24. POST Save Expo Push Token for logged-in user
router.post("/users/push-token", requireAuth(), async (req: AuthenticatedRequest, res) => {
    try {
        const { pushToken } = req.body as { pushToken?: string };
        if (!pushToken) {
            return res.status(400).json({ error: "pushToken is required" });
        }
        await prisma.user.update({
            where: { id: req.user!.id },
            data: { pushToken },
        });
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to save push token" });
    }
});

export default router;