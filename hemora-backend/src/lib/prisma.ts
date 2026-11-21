import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error("FATAL: DATABASE_URL is not set in .env");
}

const adapter = new PrismaPg({
    connectionString: databaseUrl,
    // Explicit connection pool settings to avoid cold connection overhead
    max: 20,                          // Maximum pool size
    connectionTimeoutMillis: 5_000,   // Fail fast if no connection available within 5s
    idleTimeoutMillis: 300_000,       // Close idle connections after 5 minutes
});
export const prisma = new PrismaClient({ adapter });