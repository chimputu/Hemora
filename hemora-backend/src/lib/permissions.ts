import { createAccessControl } from "better-auth/plugins/access";

export const statement = {
    inventory: ["read", "update", "dispatch"],
    requisition: ["create", "read", "approve", "reject"],
    transfusion: ["create", "read"],
    forecast: ["view", "trigger"],
    campaign: ["create", "read"],
    user: ["create", "list", "set-role", "ban", "delete"],
} as const;

export const ac = createAccessControl(statement);

export const roles = {
    DONOR: ac.newRole({
        inventory: ["read"],
    }),
    NURSE: ac.newRole({
        inventory: ["read"],
        requisition: ["create", "read"],
        transfusion: ["create", "read"],
    }),
    DOCTOR: ac.newRole({
        inventory: ["read"],
        requisition: ["create", "read", "approve"],
        transfusion: ["read"],
    }),
    BANK_MANAGER: ac.newRole({
        inventory: ["read", "update", "dispatch"],
        requisition: ["read", "approve", "reject"],
        forecast: ["view", "trigger"],
        campaign: ["create", "read"],
    }),
    FACILITY_ADMIN: ac.newRole({
        inventory: ["read"],
        requisition: ["create", "read", "approve"],
        transfusion: ["read"],
        forecast: ["view"],
    }),
    ADMIN: ac.newRole({
        inventory: ["read", "update", "dispatch"],
        requisition: ["create", "read", "approve", "reject"],
        transfusion: ["create", "read"],
        forecast: ["view", "trigger"],
        campaign: ["create", "read"],
        user: ["create", "list", "set-role", "ban", "delete"],
    }),
};