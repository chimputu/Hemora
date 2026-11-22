/**
 * Integration tests for the authentication endpoints.
 * Tests the full login, registration, logout, and refresh flows
 * by importing the Express app directly.
 */

import "dotenv/config";
import request from "supertest";
import { prisma } from "../lib/prisma";
import express from "express";
import cors from "cors";
import authRoutes from "../routes/auth.routes";
import googleAuthRoutes from "../routes/google-auth.routes";
import { rateLimitStore } from "../middleware/rate-limit.middleware";

// Clear the rate limit store before each test to avoid hitting rate limits
beforeEach(() => {
    rateLimitStore.clear();
});

// Build a test-only Express app
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

app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "hemora-backend" });
});

const DEMO_PASSWORD = "Demo1234!";

describe("Authentication Endpoints", () => {

  describe("POST /api/auth/login", () => {

    it("should login with valid admin credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "admin@hemora.zm", password: DEMO_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("access_token");
      expect(res.body).toHaveProperty("refresh_token");
      expect(res.body).toHaveProperty("user");
      expect(res.body.user.role).toBe("ADMIN");
      expect(res.body.user.email).toBe("admin@hemora.zm");
    });

    it("should login with valid donor credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "donor@hemora.zm", password: DEMO_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("access_token");
      expect(res.body).toHaveProperty("refresh_token");
      expect(res.body.user.role).toBe("DONOR");
      expect(res.body.user.email).toBe("donor@hemora.zm");
    });

    it("should login with valid doctor credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "doctor@hemora.zm", password: DEMO_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe("DOCTOR");
    });

    it("should login with valid nurse credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "nurse@hemora.zm", password: DEMO_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe("NURSE");
    });

    it("should login with valid manager credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "bankmanager@hemora.zm", password: DEMO_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe("MANAGER");
    });

    it("should reject login with wrong password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "admin@hemora.zm", password: "wrongpassword" });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error");
    });

    it("should reject login with non-existent email", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "nonexistent@example.com", password: DEMO_PASSWORD });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error");
    });

    it("should reject login with missing email", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ password: DEMO_PASSWORD });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("should reject login with missing password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "admin@hemora.zm" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("should normalize email case-insensitively", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "ADMIN@HEMORA.ZM", password: DEMO_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe("admin@hemora.zm");
    });
  });

  describe("POST /api/auth/register", () => {
    const testEmail = `test-${Date.now()}@example.com`;

    it("should register a new donor account", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          email: testEmail,
          password: "password123",
          name: "Test User",
          bloodGroup: "O_POS",
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("access_token");
      expect(res.body).toHaveProperty("refresh_token");
      expect(res.body.user.role).toBe("DONOR");
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.user.name).toBe("Test User");
    });

    it("should reject registration with existing email", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          email: "admin@hemora.zm",
          password: "password123",
          name: "Duplicate User",
        });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty("error");
    });

    it("should reject registration with short password", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          email: `short-${Date.now()}@example.com`,
          password: "short",
          name: "Short Password User",
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("should reject registration with missing name", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          email: `noname-${Date.now()}@example.com`,
          password: "password123",
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("should be able to login after registration", async () => {
      // Register
      const registerEmail = `login-after-reg-${Date.now()}@example.com`;
      const registerRes = await request(app)
        .post("/api/auth/register")
        .send({
          email: registerEmail,
          password: "password123",
          name: "Login After Reg User",
        });

      expect(registerRes.status).toBe(201);

      // Login with the same credentials
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({
          email: registerEmail,
          password: "password123",
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user.email).toBe(registerEmail);
      expect(loginRes.body.user.role).toBe("DONOR");
    });

    // Cleanup: delete test users
    afterAll(async () => {
      await prisma.user.deleteMany({
        where: {
          OR: [
            { email: testEmail },
            { email: { startsWith: "login-after-reg-" } },
          ],
        },
      });
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("should refresh an access token with a valid refresh token", async () => {
      // Login to get tokens
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "donor@hemora.zm", password: DEMO_PASSWORD });

      expect(loginRes.status).toBe(200);
      const refreshToken = loginRes.body.refresh_token;

      // Refresh token
      const refreshRes = await request(app)
        .post("/api/auth/refresh")
        .send({ refresh_token: refreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body).toHaveProperty("access_token");
      expect(refreshRes.body).toHaveProperty("refresh_token");
    });

    it("should reject refresh with invalid token", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refresh_token: "invalid-token" });

      expect(res.status).toBe(401);
    });

    it("should reject refresh with missing token", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should logout successfully", async () => {
      // Login first
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "donor2@hemora.zm", password: DEMO_PASSWORD });

      expect(loginRes.status).toBe(200);
      const refreshToken = loginRes.body.refresh_token;

      // Logout
      const logoutRes = await request(app)
        .post("/api/auth/logout")
        .send({ refresh_token: refreshToken });

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);
    });

    it("should reject logout with missing refresh token", async () => {
      const res = await request(app)
        .post("/api/auth/logout")
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe("Health check", () => {
    it("should return ok status", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });
  });
});
