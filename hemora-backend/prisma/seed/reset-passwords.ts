import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
}

// Service-role client can update user passwords via the Admin API
const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

const NEW_PASSWORD = "password123";

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

    for (const email of emails) {
        try {
            // First, find the user by email
            const { data: users, error: listError } = await admin.auth.admin.listUsers({});
            
            if (listError) {
                console.error(`  ❌ ${email} — failed to list users: ${listError.message}`);
                continue;
            }

            const user = users?.users?.find((u: any) => u.email === email);
            
            if (!user) {
                console.log(`  ⏭️  ${email} — user not found, skipping`);
                continue;
            }

            // Update the password
            const { data, error } = await admin.auth.admin.updateUserById(
                user.id,
                { password: NEW_PASSWORD }
            );

            if (error) {
                console.error(`  ❌ ${email} — ${error.message}`);
            } else {
                console.log(`  ✅ ${email} — password reset`);
            }
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
    });
