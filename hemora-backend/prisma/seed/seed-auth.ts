import { PrismaClient, UserRole } from "../../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error("FATAL: DATABASE_URL is not set in .env");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

// ── Demo accounts ──
const DEMO_PASSWORD = "Demo1234!";

const users = [
    { email: "admin@hemora.zm", role: UserRole.ADMIN, name: "System Administrator" },
    { email: "bankmanager@hemora.zm", role: UserRole.MANAGER, name: "Mulenga Banda" },
    { email: "facilityadmin@hemora.zm", role: UserRole.MANAGER, name: "Thandiwe Phiri" },
    { email: "doctor@hemora.zm", role: UserRole.DOCTOR, name: "Dr. Chanda Mwale" },
    { email: "doctor2@hemora.zm", role: UserRole.DOCTOR, name: "Dr. Namunda Zulu" },
    { email: "nurse@hemora.zm", role: UserRole.NURSE, name: "Grace Tembo" },
    { email: "nurse2@hemora.zm", role: UserRole.NURSE, name: "Luyando Musonda" },
    { email: "donor@hemora.zm", role: UserRole.DONOR, name: "Bwalya Mutale" },
    { email: "donor2@hemora.zm", role: UserRole.DONOR, name: "Chilufya Sikazwe" },
    { email: "donor3@hemora.zm", role: UserRole.DONOR, name: "Mutinta Kapembwa" },
];

async function main() {
    console.log("🔐 Creating demo auth users via Prisma...\n");

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

    for (const u of users) {
        try {
            const user = await prisma.user.upsert({
                where: { email: u.email },
                update: { passwordHash },
                create: {
                    email: u.email,
                    name: u.name,
                    role: u.role,
                    emailVerified: true,
                    passwordHash,
                    banned: false,
                },
            });
            console.log(`  ✅ ${u.email} — ${user.id} (role: ${u.role})`);
        } catch (err: any) {
            console.error(`  ❌ ${u.email} — ${err.message}`);
        }
    }

    console.log(`\n✅ Demo auth users setup complete!`);
    console.log(`🔑 Shared password: ${DEMO_PASSWORD}`);
}

main()
    .catch((err) => {
        console.error("❌ Auth seed failed:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
