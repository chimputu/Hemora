import "dotenv/config";
import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import prototypeRoutes from "./routes/prototype.routes.js";

const app = express();
const port = Number(process.env.PORT) || 5000;

// Log all incoming requests with timing for debugging
app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - start;
        console.log(`${new Date().toISOString()} ${req.method} ${req.url} from ${req.ip
        } -> ${res.statusCode} (${duration}ms)`);
    });
    next();
});

app.use(
    cors({
        origin: (origin, callback) => {
            const allowed = [
                "hemora://",
                "http://localhost:8081",
            ];
            // Allow Expo dev-client URLs from any local network (phone on Wi-Fi)
            if (!origin || allowed.includes(origin) || /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):8081$/.test(origin)) {
                callback(null, true);
            } else {
                callback(null, false);
            }
        },
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        credentials: true,
    })
);

// CRITICAL: Mount Better Auth BEFORE express.json()
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());
app.use("/api/hemora", prototypeRoutes);

app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "hemora-backend" });
});

app.listen(port, "0.0.0.0", () => {
    console.log(`Hemora Express + Better Auth server running on http://0.0.0.0:${port}`);
});