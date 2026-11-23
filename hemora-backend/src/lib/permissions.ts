// Permission statements — used by RBAC middleware to check role-based access.
export const statement = {
    inventory: ["read", "update", "dispatch"],
    requisition: ["create", "read", "approve", "reject"],
    transfusion: ["create", "read"],
    forecast: ["view", "trigger"],
    campaign: ["create", "read"],
    facility: ["create", "read"],
    user: ["create", "list", "set-role", "ban", "delete"],
} as const;

type Statements = typeof statement;
type PermissionKey = keyof Statements;
type PermissionValue<T extends PermissionKey> = Statements[T][number];

/**
 * Role permission map — defines what each role can do.
 * MANAGER combines the former BANK_MANAGER and FACILITY_ADMIN permissions.
 */
export const roles: Record<string, Record<PermissionKey, PermissionValue<PermissionKey>[]>> = {
    DONOR: {
        inventory: ["read"],
        requisition: ["read"],
        transfusion: [],
        forecast: [],
        campaign: ["read"],
        facility: ["read"],
        user: [],
    },
    NURSE: {
        inventory: ["read"],
        requisition: ["create", "read"],
        transfusion: ["create", "read"],
        forecast: [],
        campaign: [],
        facility: ["read"],
        user: [],
    },
    DOCTOR: {
        inventory: ["read"],
        requisition: ["create", "read", "approve"],
        transfusion: ["read"],
        forecast: [],
        campaign: [],
        facility: ["read"],
        user: [],
    },
    MANAGER: {
        inventory: ["read", "update", "dispatch"],
        requisition: ["read", "approve", "reject"],
        transfusion: [],
        forecast: ["view", "trigger"],
        campaign: ["create", "read"],
        facility: ["create", "read"],
        user: [],
    },
    ADMIN: {
        inventory: ["read", "update", "dispatch"],
        requisition: ["create", "read", "approve", "reject"],
        transfusion: ["create", "read"],
        forecast: ["view", "trigger"],
        campaign: ["create", "read"],
        facility: ["create", "read"],
        user: ["create", "list", "set-role", "ban", "delete"],
    },
};

/**
 * Check if a user's role grants the requested permissions.
 */
export function userHasPermission(
    userRole: string | undefined | null,
    permissions: Record<PermissionKey, PermissionValue<PermissionKey>[]>
): boolean {
    if (!userRole) return false;

    const rolePerms = roles[userRole];
    if (!rolePerms) return false;

    for (const [resource, actions] of Object.entries(permissions) as [PermissionKey, PermissionValue<PermissionKey>[]][]) {
        for (const action of actions) {
            if (!rolePerms[resource].includes(action)) {
                return false;
            }
        }
    }
    return true;
}