---
sessionId: session-261118-184404-gs19
---

# Phase 0 — Technical Audit

## PHASE 0 — REPOSITORY INSPECTION & TECHNICAL AUDIT

### Overview

This is a comprehensive audit of the existing HEMORA repository. No files were modified during this phase.

---

### 1. PROJECT STRUCTURE

```
Hemora/
├── hemora-backend/          # Express + Better Auth + Prisma backend
└── hemora-mobile/           # Expo SDK 55 + React Native + TypeScript mobile app
```

**No Python AI service directory exists yet.** This will need to be created in Phase 8.

---

### 2. BACKEND (`hemora-backend/`)

#### Configuration
- **`package.json`**: Node.js ES modules (`"type": "module"`), Express 5.3.0, Better Auth 1.7.25, Prisma 7.10.1, pg 8.23.1
- **`tsconfig.json`**: Target ES2022, module NodeNext, strict mode, output to `dist/`, source in `src/`
- **`.env`**: Database URL configured (`postgresql://postgres@localhost:5432/hemora_db`), Better Auth secret set, AI service URL set to `http://localhost:8000`, port 5000
- **`prisma7.config.ts`**: Points to `prisma/schema.prisma`, migrations in `prisma/migrations/`

#### Source Files
- **`src/server.ts`** (31 lines): Express server with CORS, Better Auth handler at `/api/auth/*`, prototype routes at `/api/hemora/`, health check at `/health`
- **`src/lib/auth.ts`** (42 lines): Better Auth config with Prisma adapter (PostgreSQL), email+password auth, Expo plugin, Admin plugin with RBAC, additional user fields (bloodGroup, facility, licenseNo)
- **`src/lib/prisma.ts`** (10 lines): PrismaClient with Pg adapter
- **`src/lib/permissions.ts`** (39 lines): Access control statements and 5 roles (DONOR, NURSE, DOCTOR, BANK_MANAGER, ADMIN)
- **`src/middleware/rbac.middleware.ts`** (47 lines): `requirePermission()` middleware for route-level authorization
- **`src/routes/prototype.routes.ts`** (175 lines): 6 prototype endpoints:
  - `GET /inventory` — blood inventory (auto-seeds if empty)
  - `PATCH /inventory/:bloodGroup` — update stock
  - `GET /requisitions` — list requisitions
  - `POST /requisitions` — create requisition
  - `PATCH /requisitions/:id/status` — approve/dispatch/reject (atomic stock deduction)
  - `POST /forecast` — proxy to FastAPI or fallback heuristic

#### Prisma Schema (`prisma/schema.prisma`)
- **Enums**: BloodGroup (8 types), Urgency (ROUTINE/URGENT/EMERGENCY), RequisitionStatus (PENDING/APPROVED/DISPATCHED/REJECTED)
- **Models**: User, Session, Account, Verification, BloodInventory, Requisition, TransfusionLog
- Client generated to `src/generated/prisma/`

#### ⚠️ Issues Found
1. **No `start` or `build` script** in `package.json` — only a placeholder `test` script. The server cannot be started with `npm start`.
2. **Wrong dependencies in backend**: `expo`, `react-native-reanimated`, `react-native-worklets` are listed as backend dependencies — these belong only in the mobile app.
3. **Missing `FACILITY_ADMIN` role**: The task requires 6 roles (System Administrator, Blood Bank Manager, Facility Administrator, Doctor, Nurse, Blood Donor), but only 5 roles exist (ADMIN, BANK_MANAGER, DOCTOR, NURSE, DONOR). FACILITY_ADMIN is missing.
4. **No seed script**: No database seeding for demonstration accounts.
5. **No Python AI service**: The `/forecast` endpoint has a fallback heuristic but no actual FastAPI service exists.

---

### 3. MOBILE APP (`hemora-mobile/`)

#### Configuration
- **`package.json`**: Expo ~55.0.32, React 19.2.0, React Native 0.83.10, Expo Router ~55.0.18, Better Auth client, react-native-reanimated 4.2.1
- **`app.json`**: App named "hemora-mobile", package `com.kafiswe.hemoramobile`, EAS project ID configured, React Compiler enabled
- **`tsconfig.json`**: Extends `expo/tsconfig.base`, strict mode, path aliases `@/*` → `./src/*`
- **`.env`**: `EXPO_PUBLIC_API_URL="http://192.168.43.43"` (missing port — should be `:5000`)
- **`AGENTS.md`**: Development guidelines for Expo/React Native

#### Source Files
- **`src/app/_layout.tsx`** (38 lines): Root layout with session-based auth guard — redirects to sign-in if not authenticated, to home if already logged in
- **`src/app/(auth)/_layout.tsx`** (10 lines): Auth stack navigator
- **`src/app/(auth)/sign-in.tsx`** (101 lines): Sign-in screen with email/password, uses `signIn.email()` from Better Auth client
- **`src/app/(auth)/sign-up.tsx`** (142 lines): Donor registration with blood group selection, uses `signUp.email()`
- **`src/app/index.tsx`** (99 lines): **Expo boilerplate welcome screen** — not a HEMORA dashboard
- **`src/app/explore.tsx`** (182 lines): **Expo boilerplate explore screen** — not HEMORA content
- **`src/lib/auth-client.ts`** (22 lines): Better Auth client with Expo plugin, SecureStore, Admin plugin
- **`src/lib/api.ts`** (27 lines): `hemoraFetch()` helper with cookie-based auth
- **`src/lib/permissions.ts`** (39 lines): Mirrors backend permissions (DONOR, NURSE, DOCTOR, BANK_MANAGER, ADMIN)
- **`src/constants/theme.ts`** (66 lines): Generic Expo theme (light/dark) — **not the HEMORA color palette**
- **`src/components/`**: Boilerplate components (animated-icon, themed-text, themed-view, collapsible, app-tabs, etc.)

#### ⚠️ Issues Found
1. **Home screen is Expo boilerplate**: `index.tsx` shows "Welcome to Expo" — no HEMORA dashboard.
2. **Explore screen is boilerplate**: `explore.tsx` is the default Expo template.
3. **Color palette not implemented**: The HEMORA palette (#A71930 primary, etc.) is not in `theme.ts` — current colors are generic Expo defaults.
4. **Missing required packages**: No `lucide-react-native`, `react-hook-form`, `zod`, or `@tanstack/react-query` installed.
5. **`EXPO_PUBLIC_API_URL` missing port**: Set to `http://192.168.43.43` without `:5000`.
6. **No role-based dashboards**: Only auth screens exist; no dashboards for any of the 6 roles.
7. **No donor module, inventory module, request module, or forecasting UI**.
8. **FACILITY_ADMIN role missing** from permissions (same as backend).

---

### 4. DATABASE

- **PostgreSQL 18** running on `localhost:5432`
- **Database `hemora_db`** exists with schema `public`
- **8 tables migrated**: user, session, account, verification, blood_inventory, requisition, transfusion_log, _prisma_migrations
- **All tables are empty** — no seeded users, no inventory data, no requisitions
- Schema matches the Prisma models

---

### 5. WHAT'S MISSING (Gap Analysis)

| Requirement | Status |
|---|---|
| Backend server entry point | ✅ Exists (`src/server.ts`) |
| Backend start script | ❌ Missing |
| Better Auth integration | ✅ Configured |
| Prisma schema | ✅ Complete |
| Database tables | ✅ Migrated |
| Seeded demo accounts | ❌ Missing |
| Seeded inventory data | ❌ Missing |
| RBAC middleware | ✅ Working |
| 6 user roles | ❌ Only 5 (missing FACILITY_ADMIN) |
| Mobile auth screens | ✅ Basic sign-in/sign-up |
| Mobile HEMORA color palette | ❌ Not implemented |
| Mobile role-based dashboards | ❌ All missing |
| Donor module (mobile) | ❌ Missing |
| Blood inventory module (mobile) | ❌ Missing |
| Blood request module (mobile) | ❌ Missing |
| AI forecasting UI (mobile) | ❌ Missing |
| Donor mobilisation module | ❌ Missing |
| Facility management module | ❌ Missing |
| Admin dashboard | ❌ Missing |
| Python AI service | ❌ Not created |
| Lucide icons | ❌ Not installed |
| React Hook Form + Zod | ❌ Not installed |
| TanStack Query | ❌ Not installed |
| Password visibility toggle | ❌ Not implemented |
| Password recovery | ❌ Not implemented |
| Logout functionality | ❌ Not implemented |

---

### 6. RECOMMENDATIONS FOR PHASE 1

1. **Fix backend `package.json`**: Add `start` and `build` scripts, remove mobile-only dependencies (`expo`, `react-native-reanimated`, `react-native-worklets`).
2. **Fix mobile `.env`**: Append `:5000` to `EXPO_PUBLIC_API_URL`.
3. **Verify both apps can run**: Start the backend with `npx tsx src/server.ts` and the mobile app with `npx expo start`.
4. **Confirm PostgreSQL connectivity** from the backend (already verified — database exists and is accessible).

# Delivery Steps

### ✓ Step 1: Inspect backend codebase and configuration
Review all backend files: package.json, tsconfig.json, .env, Prisma schema, server entry point, auth config, permissions, middleware, and routes. Identify issues and gaps.

### ✓ Step 2: Inspect mobile app codebase and configuration
Review all mobile app files: package.json, app.json, tsconfig.json, .env, auth client, API helper, permissions, theme, screens, layouts, and components. Identify issues and gaps.

### ✓ Step 3: Verify database and produce audit report
Check PostgreSQL connectivity, verify database and tables exist, check for seeded data, then compile the full Phase 0 technical audit with findings, issues, and recommendations.

---

## PHASE 1 — FOUNDATION

### ✓ Step 4: Fix backend package.json
Remove mobile-only dependencies (expo, react-native-reanimated, react-native-worklets), add start/build/dev scripts, and reinstall cleaned dependencies.

### ✓ Step 5: Fix mobile .env
Append :5000 to EXPO_PUBLIC_API_URL so the mobile app connects to the backend correctly.

### ✓ Step 6: Verify both apps can run
Start the backend server and confirm the health check endpoint responds. Start the Expo dev server and confirm it serves the mobile app.

### ✓ Step 7: Submit Phase 1 completion report
Report work completed, files modified, tests executed, and request approval to proceed to Phase 2.

---

## PHASE 2 — UI DESIGN SYSTEM

### ✓ Step 8: Install missing mobile packages
Install lucide-react-native, react-hook-form, zod, and @tanstack/react-query in the mobile app.

### ✓ Step 9: Implement HEMORA color palette and typography
Replace generic Expo theme with HEMORA color palette (#A71930 primary, etc.) and professional typography.

### ✓ Step 10: Create reusable components
Create Button, Input, Card, Badge, Icon wrapper, and other shared components with proper styling.

### ✓ Step 11: Set up animations
Configure React Native Reanimated for smooth transitions and micro-interactions.

### ✓ Step 12: Submit Phase 2 completion report
Report work completed and request approval to proceed to Phase 3.

---

## PHASE 3 — AUTHENTICATION

### ✓ Step 13: Implement password visibility toggle
Add show/hide password toggle to sign-in and sign-up screens using the Icon component.

### ✓ Step 14: Implement logout functionality
Add logout button and signOut() call in the root layout or a settings screen.

### ✓ Step 15: Implement password recovery
Add forgot password screen with email submission.

### ✓ Step 16: Create role-based navigation
Redirect users to role-specific dashboards after login based on their user role.

### ✓ Step 17: Create placeholder dashboards for all 6 roles
Create basic dashboard screens for ADMIN, BANK_MANAGER, FACILITY_ADMIN, DOCTOR, NURSE, and DONOR.

### ✓ Step 18: Add FACILITY_ADMIN role
Add the missing FACILITY_ADMIN role to backend and mobile permissions.

### ✓ Step 19: Submit Phase 3 completion report
Report work completed and request approval to proceed to Phase 4.

---

## PHASE 4 — DATABASE AND ROLES

### * Step 20: Enhance Prisma schema
Add missing models (Facility, Staff, Campaign, CampaignInvitation, TransfusionLog enhancements), update User model with role enum, and ensure all relationships are correct.

### Step 21: Create database migration
Run Prisma migration to apply schema changes to PostgreSQL.

### Step 22: Create seed script
Write a comprehensive seed script with demonstration accounts for all 6 roles, sample inventory data, sample requisitions, and sample facility data.

### Step 23: Run seed script and verify
Execute the seed script, verify all demo accounts and data are present in the database.

### Step 24: Update backend auth config
Ensure Better Auth recognizes all 6 roles and maps them correctly.

### Step 25: Submit Phase 4 completion report
Report work completed and request approval to proceed to Phase 5.