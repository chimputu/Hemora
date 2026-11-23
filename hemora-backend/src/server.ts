import "dotenv/config";
import express from "express";
import cors from "cors";
import { rateLimit } from "./middleware/rate-limit.middleware.js";
import { auditLogger } from "./middleware/audit.middleware.js";
import prototypeRoutes from "./routes/prototype.routes.js";
import authRoutes from "./routes/auth.routes.js";
import googleAuthRoutes from "./routes/google-auth.routes.js";

// Cloudinary is configured via src/config/cloudinary.ts

const app = express();
const port = Number(process.env.PORT) || 5000;

// Global rate limiting: 100 requests per 15 minutes per IP
// Protects against brute-force and abuse on all API endpoints
// Increased from 20 to 100 to allow normal multi-endpoint usage
app.use(rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 100 }));

// CORS configuration: environment-based origin restriction
const isProduction = process.env.NODE_ENV === "production";

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin) {
                // Requests without an Origin header (e.g., mobile apps, curl) are allowed
                callback(null, true);
                return;
            }

            const allowed = [
                "hemora://",
                "http://localhost:8081",
                "http://127.0.0.1:8081",
            ];

            if (allowed.includes(origin)) {
                callback(null, true);
                return;
            }

            if (isProduction) {
                // In production, only allow explicitly configured origins
                const productionOrigins = (process.env.CORS_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean);
                if (productionOrigins.includes(origin)) {
                    callback(null, true);
                    return;
                }
                callback(null, false);
                return;
            }

            // In development, allow Expo dev-client URLs from local network (phone on Wi-Fi)
            if (/^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):8081$/.test(origin)) {
                callback(null, true);
                return;
            }

            callback(null, false);
        },
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        credentials: true,
    })
);

app.use(express.json({ limit: "1mb" }));

// Auth routes (public — registration, login, etc.)
app.use("/api/auth", authRoutes);

// Google OAuth routes (public — Google Sign-In verification)
app.use("/api/auth", googleAuthRoutes);

// Audit logging for sensitive operations (user management, inventory changes, etc.)
app.use("/api/hemora", auditLogger());

app.use("/api/hemora", prototypeRoutes);

app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "hemora-backend" });
});

app.listen(port, "0.0.0.0", () => {
    console.log(`Hemora backend server running on http://0.0.0.0:${port}`);
    console.log(`Auth endpoints: http://0.0.0.0:${port}/api/auth`);
    console.log(`API endpoints: http://0.0.0.0:${port}/api/hemora`);
});