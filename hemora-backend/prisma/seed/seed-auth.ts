import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
}

// Service-role client can create users via the Admin API
const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

// ── Demo accounts ──
const DEMO_PASSWORD = "password123";

const users = [
    { email: "admin@hemora.zm", role: "ADMIN" },
    { email: "bankmanager@hemora.zm", role: "MANAGER" },
    { email: "facilityadmin@hemora.zm", role: "MANAGER" },
    { email: "doctor@hemora.zm", role: "DOCTOR" },
    { email: "doctor2@hemora.zm", role: "DOCTOR" },
    { email: "nurse@hemora.zm", role: "NURSE" },
    { email: "nurse2@hemora.zm", role: "NURSE" },
    { email: "donor@hemora.zm", role: "DONOR" },
    { email: "donor2@hemora.zm", role: "DONOR" },
    { email: "donor3@hemora.zm", role: "DONOR" },
];

async function main() {
    console.log("🔐 Creating Supabase Auth users...\n");

    for (const u of users) {
        try {
            const { data, error } = await admin.auth.admin.createUser({
                email: u.email,
                password: DEMO_PASSWORD,
                email_confirm: true,
                user_metadata: { role: u.role },
            });

            if (error) {
                // User may already exist — that's fine
                if (error.message.includes("already exists")) {
                    console.log(`  ⏭️  ${u.email} — already exists, skipping`);
                } else {
                    console.error(`  ❌ ${u.email} — ${error.message}`);
                }
            } else {
                console.log(`  ✅ ${u.email} — created (role: ${u.role})`);
            }
        } catch (err: any) {
            console.error(`  ❌ ${u.email} — ${err.message}`);
        }
    }

    console.log(`\n✅ Supabase Auth users setup complete!`);
    console.log(`🔑 Shared password: ${DEMO_PASSWORD}`);
}

main()
    .catch((err) => {
        console.error("❌ Auth seed failed:", err);
        process.exit(1);
    });
