---
sessionId: session-261121-143546-sjbh
---

# Phase 1 — Inspection Report

### Overview

Read-only inspection of the HEMORA project's Supabase integration. The project has undergone a **partial migration** from its original architecture (Better Auth + local PostgreSQL) to Supabase Auth + Supabase PostgreSQL. Several critical gaps and inconsistencies were found.

---

### Current Architecture State

| Component | Status | Notes |
|---|---|---|
| `hemora-mobile` | Supabase Auth configured | Uses `supabase-js` for auth; sends JWT Bearer tokens to Express |
| `hemora-backend` | Partially migrated | Prisma uses `@prisma/adapter-pg` → Supabase DB; JWT verification via Supabase JWKs |
| `hemora-ai` | Unchanged | Python FastAPI, no database dependency |
| Supabase Project | `fmvbkaliixhyssydseti` | Both mobile and backend point to same project |

---

### Supabase Configuration Findings

**Backend (`hemora-backend/.env`):**
- ✅ `SUPABASE_URL` — set to `https://fmvbkaliixhyssydseti.supabase.co`
- ✅ `SUPABASE_SERVICE_ROLE_KEY` — present
- ✅ `DATABASE_URL` — points to `db.fmvbkaliixhyssydseti.supabase.co:5432/postgres?schema=public`
- ✅ `.env` properly gitignored

**Mobile (`hemora-mobile/.env`):**
- ✅ `EXPO_PUBLIC_SUPABASE_URL` — same Supabase project
- ✅ `EXPO_PUBLIC_SUPABASE_KEY` — anon/public key (appropriate for client)
- ✅ `EXPO_PUBLIC_API_URL` — points to Express backend
- ⚠️ `.env` **NOT** in mobile's `.gitignore` — risk of accidental commit

---

### Database Connection

**Finding: Database unreachable from this machine (IPv6-only DNS)**

- `db.fmvbkaliixhyssydseti.supabase.co` **only resolves to IPv6** (`2a05:d014:913:8601:0:8a89:1efe:ec12`)
- No IPv4 (A) record for the `db.` subdomain
- Main Supabase domain resolves to IPv4 and REST API is reachable (returns 401)
- Prisma: initial connect succeeds, queries fail with `ENETUNREACH`
- **This is a network infrastructure issue, not a configuration error**

**Prisma (`prisma/schema.prisma`):**
- ✅ `provider = "postgresql"` — correct
- ✅ No hardcoded `url` — loaded from `DATABASE_URL` at runtime
- ✅ 7 domain models: User, Facility, BloodInventory, Requisition, TransfusionLog, Campaign, CampaignInvitation
- ✅ 5 roles in `UserRole` enum: DONOR, NURSE, DOCTOR, MANAGER, ADMIN
- ✅ Migration `0001_init` exists and matches schema

---

### Authentication Architecture

**Mobile (Supabase Auth):**
- ✅ `src/lib/supabase.ts` — client with `autoRefreshToken: true`
- ✅ `src/lib/auth-client.ts` — wraps `signIn`, `signUp`, `signOut`, `resetPassword`
- ✅ `useSession()` hook — tracks auth state
- ✅ `getAccessToken()` — retrieves token for API calls

**Backend (JWT Verification):**
- ✅ `src/lib/jwt-verify.ts` — verifies Supabase JWTs against JWKs
- ✅ JWKs cached for 1 hour
- ✅ Falls back to DONOR role if user not in DB
- ⚠️ User lookup uses `supabaseAdmin` (service role) via REST — works but adds latency
- ⚠️ `src/lib/auth.ts` referenced in ARCHITECTURE.md **does not exist**

**Critical Gap — No Better Auth:**
- ❌ `better-auth` **not in backend's `package.json`**
- ❌ Seed imports `hashPassword` from `better-auth/crypto` — will fail
- ❌ Seed references `prisma.account` model — does not exist in schema
- ❌ Backend test mocks `better-auth/plugins/access` — module doesn't exist

---

### Role-Based Access Control

**Backend (`src/lib/permissions.ts`):** ✅ 5 roles, 6 resource categories
**Mobile (`src/lib/permissions.ts`):** ✅ Same 5 roles

**Inconsistencies:**
- ❌ Seed uses `UserRole.BANK_MANAGER` and `UserRole.FACILITY_ADMIN` — not in schema
- ❌ Backend test expects 6 roles including BANK_MANAGER, FACILITY_ADMIN
- ❌ Mobile has `bank-manager` and `facility-admin` dashboards but no routing for them
- ❌ README documents 6 roles

---

### Test Status

**Backend:** ❌ FAILS — cannot find module `better-auth/plugins/access`
**Mobile:** ❌ FAILS — `statement` not exported from `@/lib/permissions`

---

### Security Findings

| Finding | Severity | Location |
|---|---|---|
| `.env` not in mobile `.gitignore` | Medium | `hemora-mobile/.gitignore` |
| Service role key in backend `.env` | Low (acceptable) | Backend-only, proper pattern |
| RLS policies unverifiable | Info | No DB connection |
| `/api/hemora/users` POST has no auth | **High** | `prototype.routes.ts:485` |
| No input validation on user creation | Medium | `prototype.routes.ts:485-520` |

---

### Issues Summary

| # | Issue | Severity |
|---|---|---|
| 1 | Database unreachable (IPv6-only DNS) | High — Infrastructure |
| 2 | `.env` not gitignored in mobile | Medium — Security |
| 3 | Seed references non-existent roles | High — Implementation |
| 4 | Seed references non-existent `prisma.account` | High — Implementation |
| 5 | Seed imports from missing `better-auth` | High — Implementation |
| 6 | Backend test references missing `better-auth` | Medium — Testing |
| 7 | Backend test expects 6 roles, schema has 5 | Medium — Testing |
| 8 | Mobile test imports non-existent `statement` | Medium — Testing |
| 9 | `/api/hemora/users` POST unauthenticated | High — Security |
| 10 | ARCHITECTURE.md references non-existent `auth.ts` | Low — Documentation |
| 11 | Mobile has `bank-manager` dashboard, no routing | Low — Implementation |
| 12 | RLS policies cannot be verified | Info — Verification |

# Technical Design

### Key Decisions

1. **Preserve Supabase Auth** — Mobile uses Supabase Auth; backend verifies JWTs via JWKs. Correct pattern, will be kept.
2. **Do NOT introduce Supabase Auth on backend** — Backend uses JWT verification via `jose` + Supabase JWKs. Keeps Express as API gateway.
3. **Keep Prisma + `@prisma/adapter-pg`** — Direct pg connection via `DATABASE_URL` is correct for Supabase PostgreSQL.
4. **Resolve to 5 roles** — Schema, backend permissions, and mobile permissions agree on 5 roles. Seed, tests, and README are outliers.
5. **Database connectivity** — IPv6-only DNS is a network constraint. Configuration is correct; works on IPv6-capable networks.

### Proposed Changes

**Stage 1: Security + Seed Script**
- Add `.env` to `hemora-mobile/.gitignore`
- Remove `better-auth/crypto` import from seed
- Remove `prisma.account.upsert()` calls — Supabase manages auth
- Replace `BANK_MANAGER` → `MANAGER`, `FACILITY_ADMIN` → `MANAGER` in seed

**Stage 2: Fix Tests**
- Remove `better-auth` mock from backend test
- Update backend test to expect 5 roles
- Fix mobile test to remove `statement` import
- Run `npm test` in both modules

**Stage 3: Secure Endpoint + Docs**
- Add `requirePermission({ user: ["create"] })` to POST `/users`
- Update `ARCHITECTURE.md` — remove `auth.ts` reference
- Update `README.md` — reflect Supabase config and 5 roles

### Architecture Diagram

```mermaid
graph LR
  A[Mobile Sign-In] --> B[Supabase JS Client]
  B --> C[useSession hook]
  C --> D[hemoraFetch + Bearer]
  D --> E[Express Routes]
  E --> F[RBAC Middleware]
  F --> G[jwt-verify + JWKs]
  G --> H[Supabase Auth JWKs]
  F --> I[Prisma Client]
  I --> J[@prisma/adapter-pg]
  J --> K[Supabase PostgreSQL]
```

### Risks

1. **IPv6-only database DNS** — Cannot verify DB operations from this machine. Configuration is correct but untestable here.
2. **RLS policies** — Cannot verify without DB connection. Backend uses service role which bypasses RLS.
3. **User creation endpoint** — Currently unauthenticated. Will be secured.

# Delivery Steps

### ✓ Step 1: Fix security and seed script
Add `.env` to mobile `.gitignore` and fix the seed script to work with Supabase Auth.
- Add `.env` line to `hemora-mobile/.gitignore`
- Remove `better-auth/crypto` import from `hemora-backend/prisma/seed/seed.ts`
- Remove all `prisma.account.upsert()` calls — Supabase manages auth accounts natively
- Replace `UserRole.BANK_MANAGER` with `UserRole.MANAGER` in seed data
- Replace `UserRole.FACILITY_ADMIN` with `UserRole.MANAGER` in seed data
- Verify seed script compiles without errors

### ✓ Step 2: Fix backend and mobile tests
Update both test suites to match the current codebase and verify they pass.
- Remove `jest.mock("better-auth/plugins/access", ...)` from `hemora-backend/src/__tests__/permissions.test.ts`
- Update backend test to expect 5 roles (remove BANK_MANAGER and FACILITY_ADMIN)
- Fix mobile test `hemora-mobile/__tests__/route-mapping.test.ts` to remove `statement` import
- Update mobile test to use `roles` and `hasPermission()` from the actual mobile permissions module
- Run `npm test` in both hemora-backend and hemora-mobile and verify all tests pass

### ✓ Step 3: Secure endpoint and update documentation
Add authentication to the user creation endpoint and update all documentation.
- Add `requireAuth()` to POST `/api/hemora/users` in `prototype.routes.ts`
- Update `ARCHITECTURE.md` to remove reference to non-existent `src/lib/auth.ts` and reflect Supabase Auth
- Update `README.md` setup section to reflect Supabase configuration
- Update role documentation in README to reflect 5 roles
- Run final regression: `npm test` in both backend and mobile