/**
 * Integration tests for the blood distribution endpoint.
 * Tests the full distribution flow: admin logs in, creates a requisition
 * with inventory, and distributes blood to a facility.
 */

import "dotenv/config";
import request from "supertest";
import { prisma } from "../lib/prisma";
import express from "express";
import cors from "cors";
import authRoutes from "../routes/auth.routes";
import googleAuthRoutes from "../routes/google-auth.routes";
import prototypeRoutes from "../routes/prototype.routes";
import { rateLimitStore } from "../middleware/rate-limit.middleware";

// Clear the rate limit store before each test to avoid hitting rate limits
beforeEach(() => {
    rateLimitStore.clear();
});

// Build a test-only Express app with both auth and prototype routes
const app = express();

app.use(
    cors({
        origin: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        credentials: true,
    })
);

app.use(express.json({ limit: "1mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/auth", googleAuthRoutes);
app.use("/api/hemora", prototypeRoutes);

app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "hemora-backend" });
});

const DEMO_PASSWORD = "Demo1234!";

describe("Blood Distribution Endpoint", () => {
    let adminToken: string;
    let donorToken: string;

    beforeAll(async () => {
        // Login as admin to get a valid token
        const adminRes = await request(app)
            .post("/api/auth/login")
            .send({ email: "admin@hemora.zm", password: DEMO_PASSWORD });
        adminToken = adminRes.body.access_token;

        // Login as donor to get a token without distribution permissions
        const donorRes = await request(app)
            .post("/api/auth/login")
            .send({ email: "donor@hemora.zm", password: DEMO_PASSWORD });
        donorToken = donorRes.body.access_token;
    });

    describe("POST /api/hemora/requisitions/:id/distribute", () => {
        let requisitionId: string;
        let inventoryId: string;

        // Seed a requisition and matching inventory before each test
        beforeEach(async () => {
            // Create a blood inventory record for the test
            const inventory = await prisma.bloodInventory.upsert({
                where: {
                    bloodGroup_component: {
                        bloodGroup: "O_POS",
                        component: "WHOLE_BLOOD",
                    },
                },
                create: {
                    bloodGroup: "O_POS",
                    component: "WHOLE_BLOOD",
                    units: 50,
                    minThreshold: 10,
                },
                update: {
                    units: 50,
                },
            });
            inventoryId = inventory.id;

            // Create a requisition for the admin to distribute
            const adminRes = await request(app)
                .post("/api/auth/login")
                .send({ email: "admin@hemora.zm", password: DEMO_PASSWORD });
            const adminUser = adminRes.body.user;

            const requisition = await prisma.requisition.create({
                data: {
                    bloodGroup: "O_POS",
                    component: "WHOLE_BLOOD",
                    unitsNeeded: 5,
                    urgency: "ROUTINE",
                    requesterId: adminUser.id,
                },
            });
            requisitionId = requisition.id;
        });

        // Clean up test data after each test
        afterEach(async () => {
            await prisma.requisition.deleteMany({
                where: { id: requisitionId },
            });
            // Reset inventory to avoid affecting other tests (use upsert in case it was deleted)
            await prisma.bloodInventory.upsert({
                where: {
                    bloodGroup_component: {
                        bloodGroup: "O_POS",
                        component: "WHOLE_BLOOD",
                    },
                },
                create: {
                    bloodGroup: "O_POS",
                    component: "WHOLE_BLOOD",
                    units: 50,
                    minThreshold: 10,
                },
                update: {
                    units: 50,
                },
            });
        });

        it("should successfully distribute blood with sufficient inventory", async () => {
            const res = await request(app)
                .post(`/api/hemora/requisitions/${requisitionId}/distribute`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("message");
            expect(res.body.message).toBe("Blood distributed successfully");
            expect(res.body).toHaveProperty("requisition");
            expect(res.body.requisition.status).toBe("DISPATCHED");
        });

        it("should deduct the correct number of units from inventory", async () => {
            await request(app)
                .post(`/api/hemora/requisitions/${requisitionId}/distribute`)
                .set("Authorization", `Bearer ${adminToken}`);

            const updatedInventory = await prisma.bloodInventory.findUnique({
                where: { id: inventoryId },
            });

            expect(updatedInventory).not.toBeNull();
            expect(updatedInventory!.units).toBe(45); // 50 - 5 = 45
        });

        it("should set approvedBy and approvedAt on successful distribution", async () => {
            await request(app)
                .post(`/api/hemora/requisitions/${requisitionId}/distribute`)
                .set("Authorization", `Bearer ${adminToken}`);

            const updatedRequisition = await prisma.requisition.findUnique({
                where: { id: requisitionId },
            });

            expect(updatedRequisition).not.toBeNull();
            expect(updatedRequisition!.status).toBe("DISPATCHED");
            expect(updatedRequisition!.approvedBy).not.toBeNull();
            expect(updatedRequisition!.approvedAt).not.toBeNull();
        });

        it("should reject distribution when inventory is insufficient", async () => {
            // Set inventory to 0 units
            await prisma.bloodInventory.update({
                where: { id: inventoryId },
                data: { units: 0 },
            });

            const res = await request(app)
                .post(`/api/hemora/requisitions/${requisitionId}/distribute`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("error");
            expect(res.body.error).toContain("Insufficient");
        });

        it("should reject distribution when inventory record does not exist", async () => {
            // Delete the inventory record
            await prisma.bloodInventory.delete({
                where: { id: inventoryId },
            });

            const res = await request(app)
                .post(`/api/hemora/requisitions/${requisitionId}/distribute`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("error");
            expect(res.body.error).toContain("Insufficient");
        });

        it("should reject distribution of an already dispatched requisition", async () => {
            // First distribution succeeds
            const firstRes = await request(app)
                .post(`/api/hemora/requisitions/${requisitionId}/distribute`)
                .set("Authorization", `Bearer ${adminToken}`);
            expect(firstRes.status).toBe(200);

            // Second distribution should fail
            const secondRes = await request(app)
                .post(`/api/hemora/requisitions/${requisitionId}/distribute`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(secondRes.status).toBe(400);
            expect(secondRes.body).toHaveProperty("error");
            expect(secondRes.body.error).toContain("already been dispatched");
        });

        it("should reject distribution when requisition is not found", async () => {
            const fakeId = "00000000-0000-0000-0000-000000000000";
            const res = await request(app)
                .post(`/api/hemora/requisitions/${fakeId}/distribute`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("error");
            expect(res.body.error).toContain("Requisition not found");
        });

        it("should reject distribution without authentication", async () => {
            const res = await request(app)
                .post(`/api/hemora/requisitions/${requisitionId}/distribute`);

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty("error");
        });

        it("should reject distribution with invalid token", async () => {
            const res = await request(app)
                .post(`/api/hemora/requisitions/${requisitionId}/distribute`)
                .set("Authorization", "Bearer invalid-token-12345");

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty("error");
        });

        it("should reject distribution for users without requisition:approve permission", async () => {
            const res = await request(app)
                .post(`/api/hemora/requisitions/${requisitionId}/distribute`)
                .set("Authorization", `Bearer ${donorToken}`);

            expect(res.status).toBe(403);
            expect(res.body).toHaveProperty("error");
            expect(res.body.error).toContain("Forbidden");
        });
    });

    describe("Distribution with PATCH /requisitions/:id/status (DISPATCHED)", () => {
        let requisitionId: string;
        let inventoryId: string;

        beforeEach(async () => {
            const inventory = await prisma.bloodInventory.upsert({
                where: {
                    bloodGroup_component: {
                        bloodGroup: "A_POS",
                        component: "Packed_RBC",
                    },
                },
                create: {
                    bloodGroup: "A_POS",
                    component: "Packed_RBC",
                    units: 30,
                    minThreshold: 5,
                },
                update: {
                    units: 30,
                },
            });
            inventoryId = inventory.id;

            const adminRes = await request(app)
                .post("/api/auth/login")
                .send({ email: "admin@hemora.zm", password: DEMO_PASSWORD });
            const adminUser = adminRes.body.user;

            const requisition = await prisma.requisition.create({
                data: {
                    bloodGroup: "A_POS",
                    component: "Packed_RBC",
                    unitsNeeded: 3,
                    urgency: "URGENT",
                    requesterId: adminUser.id,
                },
            });
            requisitionId = requisition.id;
        });

        afterEach(async () => {
            await prisma.requisition.deleteMany({
                where: { id: requisitionId },
            });
            // Reset inventory using upsert in case it was deleted
            await prisma.bloodInventory.upsert({
                where: {
                    bloodGroup_component: {
                        bloodGroup: "A_POS",
                        component: "Packed_RBC",
                    },
                },
                create: {
                    bloodGroup: "A_POS",
                    component: "Packed_RBC",
                    units: 30,
                    minThreshold: 5,
                },
                update: {
                    units: 30,
                },
            });
        });

        it("should also deduct inventory when using PATCH status to DISPATCHED", async () => {
            // Get a fresh token for this test
            const adminRes = await request(app)
                .post("/api/auth/login")
                .send({ email: "admin@hemora.zm", password: DEMO_PASSWORD });
            const token = adminRes.body.access_token;

            const res = await request(app)
                .patch(`/api/hemora/requisitions/${requisitionId}/status`)
                .set("Authorization", `Bearer ${token}`)
                .send({ status: "DISPATCHED" });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe("DISPATCHED");

            const updatedInventory = await prisma.bloodInventory.findUnique({
                where: { id: inventoryId },
            });
            expect(updatedInventory!.units).toBe(27); // 30 - 3 = 27
        });

        it("should reject PATCH DISPATCHED when inventory is insufficient", async () => {
            await prisma.bloodInventory.update({
                where: { id: inventoryId },
                data: { units: 1 },
            });

            // Get a fresh token for this test
            const adminRes = await request(app)
                .post("/api/auth/login")
                .send({ email: "admin@hemora.zm", password: DEMO_PASSWORD });
            const token = adminRes.body.access_token;

            const res = await request(app)
                .patch(`/api/hemora/requisitions/${requisitionId}/status`)
                .set("Authorization", `Bearer ${token}`)
                .send({ status: "DISPATCHED" });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("error");
            expect(res.body.error).toContain("Insufficient");
        });

        it("should set approvedBy and approvedAt when PATCH status to APPROVED", async () => {
            const adminRes = await request(app)
                .post("/api/auth/login")
                .send({ email: "admin@hemora.zm", password: DEMO_PASSWORD });
            const token = adminRes.body.access_token;

            const res = await request(app)
                .patch(`/api/hemora/requisitions/${requisitionId}/status`)
                .set("Authorization", `Bearer ${token}`)
                .send({ status: "APPROVED" });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe("APPROVED");

            const updatedRequisition = await prisma.requisition.findUnique({
                where: { id: requisitionId },
            });
            expect(updatedRequisition!.approvedBy).not.toBeNull();
            expect(updatedRequisition!.approvedAt).not.toBeNull();
        });

        it("should NOT deduct inventory when PATCH status to a non-DISPATCHED status", async () => {
            const adminRes = await request(app)
                .post("/api/auth/login")
                .send({ email: "admin@hemora.zm", password: DEMO_PASSWORD });
            const token = adminRes.body.access_token;

            const res = await request(app)
                .patch(`/api/hemora/requisitions/${requisitionId}/status`)
                .set("Authorization", `Bearer ${token}`)
                .send({ status: "APPROVED" });

            expect(res.status).toBe(200);

            const updatedInventory = await prisma.bloodInventory.findUnique({
                where: { id: inventoryId },
            });
            expect(updatedInventory!.units).toBe(30); // unchanged
        });

        it("should reject PATCH DISPATCHED on an already dispatched requisition", async () => {
            const adminRes = await request(app)
                .post("/api/auth/login")
                .send({ email: "admin@hemora.zm", password: DEMO_PASSWORD });
            const token = adminRes.body.access_token;

            // First dispatch succeeds
            const firstRes = await request(app)
                .patch(`/api/hemora/requisitions/${requisitionId}/status`)
                .set("Authorization", `Bearer ${token}`)
                .send({ status: "DISPATCHED" });
            expect(firstRes.status).toBe(200);

            // Second dispatch should not deduct again (the PATCH endpoint checks record.status !== "DISPATCHED")
            const secondRes = await request(app)
                .patch(`/api/hemora/requisitions/${requisitionId}/status`)
                .set("Authorization", `Bearer ${token}`)
                .send({ status: "DISPATCHED" });
            expect(secondRes.status).toBe(200);

            // Inventory should still be 27 (30 - 3), not 24
            const updatedInventory = await prisma.bloodInventory.findUnique({
                where: { id: inventoryId },
            });
            expect(updatedInventory!.units).toBe(27);
        });

        it("should reject PATCH DISPATCHED without authentication", async () => {
            const res = await request(app)
                .patch(`/api/hemora/requisitions/${requisitionId}/status`)
                .send({ status: "DISPATCHED" });

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty("error");
        });

        it("should reject PATCH DISPATCHED for users without requisition:approve permission", async () => {
            const res = await request(app)
                .patch(`/api/hemora/requisitions/${requisitionId}/status`)
                .set("Authorization", `Bearer ${donorToken}`)
                .send({ status: "DISPATCHED" });

            expect(res.status).toBe(403);
            expect(res.body).toHaveProperty("error");
            expect(res.body.error).toContain("Forbidden");
        });
    });

    describe("Distribution edge cases", () => {
        let requisitionId: string;
        let inventoryId: string;

        beforeEach(async () => {
            const inventory = await prisma.bloodInventory.upsert({
                where: {
                    bloodGroup_component: {
                        bloodGroup: "B_NEG",
                        component: "PLASMA",
                    },
                },
                create: {
                    bloodGroup: "B_NEG",
                    component: "PLASMA",
                    units: 10,
                    minThreshold: 2,
                },
                update: {
                    units: 10,
                },
            });
            inventoryId = inventory.id;

            const adminRes = await request(app)
                .post("/api/auth/login")
                .send({ email: "admin@hemora.zm", password: DEMO_PASSWORD });
            const adminUser = adminRes.body.user;

            const requisition = await prisma.requisition.create({
                data: {
                    bloodGroup: "B_NEG",
                    component: "PLASMA",
                    unitsNeeded: 10,
                    urgency: "EMERGENCY",
                    requesterId: adminUser.id,
                },
            });
            requisitionId = requisition.id;
        });

        afterEach(async () => {
            await prisma.requisition.deleteMany({
                where: { id: requisitionId },
            });
            await prisma.bloodInventory.upsert({
                where: {
                    bloodGroup_component: {
                        bloodGroup: "B_NEG",
                        component: "PLASMA",
                    },
                },
                create: {
                    bloodGroup: "B_NEG",
                    component: "PLASMA",
                    units: 10,
                    minThreshold: 2,
                },
                update: {
                    units: 10,
                },
            });
        });

        it("should distribute when stock exactly equals units needed", async () => {
            const res = await request(app)
                .post(`/api/hemora/requisitions/${requisitionId}/distribute`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.message).toBe("Blood distributed successfully");

            const updatedInventory = await prisma.bloodInventory.findUnique({
                where: { id: inventoryId },
            });
            expect(updatedInventory!.units).toBe(0);
        });

        it("should reject distribution when stock is one unit less than needed", async () => {
            await prisma.bloodInventory.update({
                where: { id: inventoryId },
                data: { units: 9 },
            });

            const res = await request(app)
                .post(`/api/hemora/requisitions/${requisitionId}/distribute`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("error");
            expect(res.body.error).toContain("Insufficient");
        });

        it("should return the correct blood group and component in the response", async () => {
            const res = await request(app)
                .post(`/api/hemora/requisitions/${requisitionId}/distribute`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.requisition.bloodGroup).toBe("B_NEG");
            expect(res.body.requisition.component).toBe("PLASMA");
        });
    });

    describe("PATCH /requisitions/:id/status - additional statuses", () => {
        let requisitionId: string;
        let inventoryId: string;

        beforeEach(async () => {
            const inventory = await prisma.bloodInventory.upsert({
                where: {
                    bloodGroup_component: {
                        bloodGroup: "AB_POS",
                        component: "WHOLE_BLOOD",
                    },
                },
                create: {
                    bloodGroup: "AB_POS",
                    component: "WHOLE_BLOOD",
                    units: 20,
                    minThreshold: 5,
                },
                update: {
                    units: 20,
                },
            });
            inventoryId = inventory.id;

            const adminRes = await request(app)
                .post("/api/auth/login")
                .send({ email: "admin@hemora.zm", password: DEMO_PASSWORD });
            const adminUser = adminRes.body.user;

            const requisition = await prisma.requisition.create({
                data: {
                    bloodGroup: "AB_POS",
                    component: "WHOLE_BLOOD",
                    unitsNeeded: 2,
                    urgency: "ROUTINE",
                    requesterId: adminUser.id,
                },
            });
            requisitionId = requisition.id;
        });

        afterEach(async () => {
            await prisma.requisition.deleteMany({
                where: { id: requisitionId },
            });
            await prisma.bloodInventory.upsert({
                where: {
                    bloodGroup_component: {
                        bloodGroup: "AB_POS",
                        component: "WHOLE_BLOOD",
                    },
                },
                create: {
                    bloodGroup: "AB_POS",
                    component: "WHOLE_BLOOD",
                    units: 20,
                    minThreshold: 5,
                },
                update: {
                    units: 20,
                },
            });
        });

        it("should handle PATCH status to REJECTED without deducting inventory", async () => {
            const adminRes = await request(app)
                .post("/api/auth/login")
                .send({ email: "admin@hemora.zm", password: DEMO_PASSWORD });
            const token = adminRes.body.access_token;

            const res = await request(app)
                .patch(`/api/hemora/requisitions/${requisitionId}/status`)
                .set("Authorization", `Bearer ${token}`)
                .send({ status: "REJECTED" });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe("REJECTED");

            const updatedInventory = await prisma.bloodInventory.findUnique({
                where: { id: inventoryId },
            });
            expect(updatedInventory!.units).toBe(20); // unchanged
        });

        it("should handle PATCH status to PENDING without deducting inventory", async () => {
            const adminRes = await request(app)
                .post("/api/auth/login")
                .send({ email: "admin@hemora.zm", password: DEMO_PASSWORD });
            const token = adminRes.body.access_token;

            const res = await request(app)
                .patch(`/api/hemora/requisitions/${requisitionId}/status`)
                .set("Authorization", `Bearer ${token}`)
                .send({ status: "PENDING" });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe("PENDING");

            const updatedInventory = await prisma.bloodInventory.findUnique({
                where: { id: inventoryId },
            });
            expect(updatedInventory!.units).toBe(20); // unchanged
        });

        it("should reject PATCH status when requisition is not found", async () => {
            const adminRes = await request(app)
                .post("/api/auth/login")
                .send({ email: "admin@hemora.zm", password: DEMO_PASSWORD });
            const token = adminRes.body.access_token;

            const fakeId = "00000000-0000-0000-0000-000000000000";
            const res = await request(app)
                .patch(`/api/hemora/requisitions/${fakeId}/status`)
                .set("Authorization", `Bearer ${token}`)
                .send({ status: "APPROVED" });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("error");
            expect(res.body.error).toContain("Requisition not found");
        });

        it("should not set approvedBy/approvedAt for non-APPROVED statuses", async () => {
            const adminRes = await request(app)
                .post("/api/auth/login")
                .send({ email: "admin@hemora.zm", password: DEMO_PASSWORD });
            const token = adminRes.body.access_token;

            const res = await request(app)
                .patch(`/api/hemora/requisitions/${requisitionId}/status`)
                .set("Authorization", `Bearer ${token}`)
                .send({ status: "REJECTED" });

            expect(res.status).toBe(200);

            const updatedRequisition = await prisma.requisition.findUnique({
                where: { id: requisitionId },
            });
            expect(updatedRequisition!.approvedBy).toBeNull();
            expect(updatedRequisition!.approvedAt).toBeNull();
        });
    });

    describe("Distribution with different urgency levels", () => {
        let requisitionId: string;
        let inventoryId: string;

        beforeEach(async () => {
            const inventory = await prisma.bloodInventory.upsert({
                where: {
                    bloodGroup_component: {
                        bloodGroup: "O_NEG",
                        component: "WHOLE_BLOOD",
                    },
                },
                create: {
                    bloodGroup: "O_NEG",
                    component: "WHOLE_BLOOD",
                    units: 15,
                    minThreshold: 3,
                },
                update: {
                    units: 15,
                },
            });
            inventoryId = inventory.id;

            const adminRes = await request(app)
                .post("/api/auth/login")
                .send({ email: "admin@hemora.zm", password: DEMO_PASSWORD });
            const adminUser = adminRes.body.user;

            const requisition = await prisma.requisition.create({
                data: {
                    bloodGroup: "O_NEG",
                    component: "WHOLE_BLOOD",
                    unitsNeeded: 4,
                    urgency: "ROUTINE",
                    requesterId: adminUser.id,
                },
            });
            requisitionId = requisition.id;
        });

        afterEach(async () => {
            await prisma.requisition.deleteMany({
                where: { id: requisitionId },
            });
            await prisma.bloodInventory.upsert({
                where: {
                    bloodGroup_component: {
                        bloodGroup: "O_NEG",
                        component: "WHOLE_BLOOD",
                    },
                },
                create: {
                    bloodGroup: "O_NEG",
                    component: "WHOLE_BLOOD",
                    units: 15,
                    minThreshold: 3,
                },
                update: {
                    units: 15,
                },
            });
        });

        it("should distribute for ROUTINE urgency", async () => {
            const res = await request(app)
                .post(`/api/hemora/requisitions/${requisitionId}/distribute`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.requisition.status).toBe("DISPATCHED");
        });

        it("should distribute for URGENT urgency", async () => {
            // Update requisition to URGENT
            await prisma.requisition.update({
                where: { id: requisitionId },
                data: { urgency: "URGENT" },
            });

            const res = await request(app)
                .post(`/api/hemora/requisitions/${requisitionId}/distribute`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.requisition.status).toBe("DISPATCHED");
        });

        it("should distribute for EMERGENCY urgency", async () => {
            // Update requisition to EMERGENCY
            await prisma.requisition.update({
                where: { id: requisitionId },
                data: { urgency: "EMERGENCY" },
            });

            const res = await request(app)
                .post(`/api/hemora/requisitions/${requisitionId}/distribute`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.requisition.status).toBe("DISPATCHED");
        });
    });
});
