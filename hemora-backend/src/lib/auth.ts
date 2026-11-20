import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { expo } from "@better-auth/expo";
import { admin } from "better-auth/plugins";
import { prisma } from "./prisma.js";
import { ac, roles } from "./permissions.js";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
    },
    plugins: [
        expo(),
        admin({
            ac,
            roles,
            defaultRole: "DONOR",
            adminRoles: ["ADMIN", "BANK_MANAGER", "FACILITY_ADMIN"],
        }),
    ],
    user: {
        additionalFields: {
            bloodGroup: { type: "string", required: false },
            facilityId: { type: "string", required: false },
            licenseNo: { type: "string", required: false },
            phone: { type: "string", required: false },
            lastDonation: { type: "string", required: false },
            eligible: { type: "boolean", required: false },
        },
    },
    trustedOrigins: [
        "hemora://",
        "hemora://*",
        "hemoramobile://",
        "hemoramobile://*",
        "exp://192.168.*.*:8081",
        "exp://10.*.*.*:8081",
    ],
    advanced: {
        database: {
            joins: true,
        },
    },
});