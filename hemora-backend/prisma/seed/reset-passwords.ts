import { PrismaClient } from "../../src/generated/prisma";
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

const NEW_PASSWORD = "Demo1234!";

const emails = [
    "admin@hemora.zm",
    "bankmanager@hemora.zm",
    "facilityadmin@hemora.zm",
    "doctor@hemora.zm",
    "doctor2@hemora.zm",
    "nurse@hemora.zm",
    "nurse2@hemora.zm",
    "donor@hemora.zm",
    "donor2@hemora.zm",
    "donor3@hemora.zm",
];

async function main() {
    console.log("🔐 Resetting demo account passwords to:", NEW_PASSWORD, "\n");

    const passwordHash = await bcrypt.hash(NEW_PASSWORD, 12);

    for (const email of emails) {
        try {
            const user = await prisma.user.findUnique({ where: { email } });

            if (!user) {
                console.log(`  ⏭️  ${email} — user not found, skipping`);
                continue;
            }

            await prisma.user.update({
                where: { email },
                data: { passwordHash },
            });

            console.log(`  ✅ ${email} — password reset`);
        } catch (err: any) {
            console.error(`  ❌ ${email} — ${err.message}`);
        }
    }

    console.log(`\n✅ Password reset complete!`);
    console.log(`🔑 New shared password: ${NEW_PASSWORD}`);
}

main()
    .catch((err) => {
        console.error("❌ Password reset failed:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
