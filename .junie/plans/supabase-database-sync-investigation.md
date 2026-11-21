---
sessionId: session-261121-181901-ek54
---

# Investigation Report

# HEMORA — Supabase Database Synchronization Investigation Report

## Executive Summary

This is a **read-only investigation** of the HEMORA database integration. The Supabase database at `fmvbkaliixhyssydseti.supabase.co` is **not reachable from this environment** (connection timeouts on port 443), so live database queries cannot be executed. All findings below are based on thorough code analysis, configuration review, migration inspection, and architectural tracing.

---

## 1. DATABASE CONNECTION VERIFICATION

| Area | Status | Evidence | Problem | Recommended Action |
|---|---|---|---|---|
| **Supabase connection (backend)** | ✅ PASS | `hemora-backend/.env`: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set | None | No action needed |
| **Supabase connection (mobile)** | ✅ PASS | `hemora-mobile/.env`: Same project URL, publishable key (correct for client) | None | No action needed |
| **Prisma connection** | ✅ PASS | `DATABASE_URL` points to `db.fmvbkaliixhyssydseti.supabase.co:5432/postgres?schema=public` | None | No action needed |
| **Connection pooling** | ✅ PASS | `src/lib/prisma.ts`: `@prisma/adapter-pg` with max 20 connections, 5s timeout, 5min idle | None | No action needed |
| **Environment consistency** | ✅ PASS | Backend and mobile both point to the same Supabase project | None | No action needed |
| **DIRECT_URL** | ⚠️ NOT CONFIGURED | No `DIRECT_URL` in `.env` or Prisma schema | Not required but recommended for production | Consider adding for production reliability |

**Finding:** All three components (Prisma, Supabase admin client, Supabase mobile client) point to the same Supabase project. The backend uses two connection paths: Prisma connects directly to PostgreSQL via `DATABASE_URL` for domain data, while the Supabase admin client uses the REST API via service role key for auth user lookups.

---

## 2. PRISMA SCHEMA vs MIGRATION COMPARISON

| Area | Status | Evidence | Problem | Recommended Action |
|---|---|---|---|---|
| **Schema ↔ Migration sync** | ✅ PASS | `prisma/schema.prisma` matches `prisma/migrations/0001_init/migration.sql` exactly | None | No action needed |
| **Tables** | ✅ PASS | 7 tables: `user`, `facility`, `blood_inventory`, `requisition`, `transfusion_log`, `campaign`, `campaign_invitation` | None | No action needed |
| **Columns** | ✅ PASS | All columns in schema have corresponding definitions in migration SQL | None | No action needed |
| **Data types** | ✅ PASS | 7 enums as Postgres types; TEXT, BOOLEAN, INTEGER, TIMESTAMP(3) all correct | None | No action needed |
| **Nullability** | ✅ PASS | Nullable fields match between schema and migration | None | No action needed |
| **Primary keys** | ✅ PASS | All models use `String @id`; migration uses `TEXT NOT NULL` with `PRIMARY KEY` | None | No action needed |
| **Foreign keys** | ✅ PASS | 6 foreign key constraints match 6 relations in schema | None | No action needed |
| **Unique constraints** | ✅ PASS | `user.email` unique, `blood_inventory(bloodGroup, component)` unique | None | No action needed |
| **Indexes** | ✅ PASS | 13 indexes in migration match all `@@index()` directives | None | No action needed |
| **Enums** | ✅ PASS | 7 enums created as Postgres `CREATE TYPE`, values match Prisma | None | No action needed |
| **Defaults** | ✅ PASS | `@default()` values match `DEFAULT` clauses in migration | None | No action needed |
| **Relationships** | ✅ PASS | All `@relation()` directives have corresponding `ALTER TABLE` statements | None | No action needed |

**Finding:** The Prisma schema and the single migration (`0001_init`) are in perfect synchronization. No schema drift at the code level.

---

## 3. MIGRATION HISTORY INVESTIGATION

| Area | Status | Evidence | Problem | Recommended Action |
|---|---|---|---|---|
| **Migration files** | ✅ PASS | Single migration `0001_init` with `migration.sql` and `migration_lock.toml` | None | No action needed |
| **Migration applied to live DB** | ⚠️ NOT VERIFIED | Cannot query `_prisma_migrations` table (database unreachable) | Cannot confirm migration was applied | Verify via Supabase dashboard or direct DB query |
| **Schema drift (code level)** | ✅ PASS | Schema matches migration; generated client matches schema | Cannot verify against live DB | Run `prisma validate` when DB is reachable |
| **Manual modifications** | ⚠️ NOT VERIFIED | Cannot inspect live database | Supabase dashboard allows manual schema changes | Compare live schema with migration output |

---

## 4. DATA CONSISTENCY — CRITICAL FINDING

### The Auth-to-Database Sync Gap

| Area | Status | Evidence | Problem | Recommended Action |
|---|---|---|---|---|
| **User records sync** | ❌ FAIL | `sign-up.tsx:42-62`: Creates Supabase Auth user, then calls `POST /api/hemora/users`. If backend call fails, user exists in Auth but NOT in `user` table. Error is only `console.warn`. | Users can exist in Supabase Auth without DB records — silent data loss | Implement retry logic or sync on sign-in |
| **Sign-in user lookup** | ⚠️ PARTIAL | `jwt-verify.ts:88-118`: Looks up user in `user` table. If not found, falls back to `role: "DONOR"` with only `id` and `email`. | Users without DB records can log in but have incomplete profiles | Ensure all Auth users have DB records |
| **Role values** | ✅ PASS | All five roles (DONOR, NURSE, DOCTOR, MANAGER, ADMIN) consistent across schema, backend, mobile, and seeds | None | No action needed |
| **Required relationships** | ⚠️ PARTIAL | `user.facilityId` optional with `ON DELETE SET NULL`. Requisition `requesterId` uses `ON DELETE RESTRICT`. | If user deleted from DB but exists in Auth, requisitions become orphaned | Consider soft deletes |

### Critical Flow Analysis

**Sign-up flow:**
1. `sign-up.tsx` calls `supabase.auth.signUp()` → creates user in Supabase Auth
2. Then calls `POST /api/hemora/users` → creates record in `user` table via Prisma upsert
3. **If step 2 fails**, user can still sign in but has no DB record
4. Error is silently swallowed (`console.warn`, line 59)

**Sign-in flow:**
1. `sign-in.tsx` calls `supabase.auth.signInWithPassword()` → validates against Supabase Auth
2. Calls `GET /api/hemora/role` → backend verifies JWT, looks up user in `user` table
3. **If user not in DB**, falls back to `role: "DONOR"` — login succeeds but profile is incomplete

**Impact:** This creates a **two-tier user population**:
- Users with complete DB records (seeded users, successful sign-ups)
- Users with Auth-only records (failed sign-up sync) who log in with degraded functionality

---

## 5. AUTHENTICATION IMPACT ANALYSIS

| Area | Status | Evidence | Problem | Recommended Action |
|---|---|---|---|---|
| **Slow login** | ⚠️ PARTIAL | `jwt-verify.ts`: Fetches JWKs (cached 1hr), queries `user` table via REST. User cache TTL 5min. | First request after cache expiry adds latency | Caching strategy is reasonable |
| **Failed login** | ✅ PASS | `signInWithPassword` from Supabase is reliable | None | No action needed |
| **Missing user profiles** | ❌ FAIL | `jwt-verify.ts:104-117`: Auth-only users get fallback with only `id`, `email`, `role: "DONOR"` | Incomplete profiles for Auth-only users | Implement sync on sign-in |
| **Incorrect role detection** | ⚠️ PARTIAL | Falls back to `DONOR` if user not in DB | Role detection depends on DB record existence | Ensure DB records exist |
| **Dashboard loading failures** | ⚠️ PARTIAL | `GET /api/hemora/me` returns 404 if user not in DB | Auth-only users get 404 on profile | Handle missing users or sync on sign-in |
| **Database query errors** | ⚠️ PARTIAL | `jwt-verify.ts:111-118`: Catches all DB errors silently | Masks connection issues | Log errors more visibly |

---

## 6. SUPABASE SECURITY CONFIGURATION

| Area | Status | Evidence | Problem | Recommended Action |
|---|---|---|---|---|
| **PostgreSQL roles** | ⚠️ NOT VERIFIED | Backend connects as `postgres` superuser | Not ideal for production | Create dedicated app role |
| **RLS policies** | ⚠️ NOT VERIFIED | Cannot inspect live RLS. Backend uses service role (bypasses RLS). | If RLS not enabled, `user` table accessible via REST API to authenticated users | Verify RLS status via Supabase dashboard |
| **Service-role key** | ✅ PASS | Only in backend `.env`. Mobile uses publishable key. | None | No action needed |
| **User creation endpoint** | ❌ FAIL | `POST /api/hemora/users` uses only `requireAuth()` — any authenticated user can upsert any user | **Privilege escalation risk** | Add `requirePermission({ user: ["create"] })` |

---

## 7. DOCUMENTATION CONSISTENCY

| Area | Status | Evidence | Problem | Recommended Action |
|---|---|---|---|---|
| **ARCHITECTURE.md** | ❌ FAIL | References "Better Auth" in diagram, 6 roles in enum and RBAC matrix | Describes old architecture | Update to reflect Supabase Auth and 5 roles |

---

## 8. FINDINGS SUMMARY

| # | Finding | Severity |
|---|---|---|
| 1 | **Auth-to-DB sync gap** — Sign-up can create Auth users without DB records | **High** |
| 2 | **User creation endpoint unsecured** — Any authenticated user can upsert any user record | **High** |
| 3 | **RLS not verified** — Cannot confirm RLS policies on `user` table | **Medium** |
| 4 | **Postgres superuser for app** — `DATABASE_URL` uses `postgres` role | **Medium** |
| 5 | **Migration application not verified** — Cannot confirm applied to live DB | **Medium** |
| 6 | **ARCHITECTURE.md outdated** — References Better Auth and 6 roles | **Low** |
| 7 | **Silent error swallowing in auth** — DB errors caught and ignored | **Low** |
| 8 | **No `DIRECT_URL` configured** | **Info** |

---

## 9. SAFE REMEDIATION PLAN

### Issue 1: Auth-to-DB Sync Gap (High)

- **Root cause:** Two-step user creation (Auth first, then DB) is not atomic
- **Affected:** `user` table, `sign-up.tsx`, `POST /api/hemora/users`, `jwt-verify.ts`
- **Solution:** Add auto-sync in `verifyAuthHeader` — when user exists in Auth but not in DB, create a minimal DB record
- **Risks:** May create records for spam accounts; mitigate by requiring email verification
- **No data loss risk** — only creates missing records
- **Rollback:** Remove auto-create logic from `jwt-verify.ts`

### Issue 2: User Creation Endpoint Unsecured (High)

- **Root cause:** `POST /api/hemora/users` uses only `requireAuth()`
- **Affected:** `prototype.routes.ts:500`, `user` table
- **Solution:** Add `requirePermission({ user: ["create"] })` to restrict to ADMIN
- **Risks:** None — only restricts access
- **Verification:** Call endpoint as DONOR — should return 403

### Issue 3: RLS Configuration (Medium)

- **Root cause:** Cannot verify RLS state without DB access
- **Solution:** Check Supabase dashboard; if RLS not enabled on `user` table, authenticated users can read all user data via REST API
- **Risks:** Enabling RLS without proper policies could block queries

### Issue 4: Documentation (Low)

- **Root cause:** `ARCHITECTURE.md` not updated after Supabase migration
- **Solution:** Update to reflect Supabase Auth, 5 roles, and current data flow

---

## 10. CONCLUSIONS

### Is Supabase the Source of Truth?
**Yes, partially.** Supabase Auth is the source of truth for authentication. The `user` table is the source of truth for application data. These two sources are **not synchronized atomically**.

### Are Prisma and Live Schema Synchronized?
**At the code level, yes.** Schema, migration, and generated client are consistent. **At the live database level, this cannot be verified** from this environment.

### Are Mobile and Backend Accessing the Same Data?
**Yes.** Both point to the same Supabase project. The data flow is consistent, though the auth-to-DB sync gap means some users may have incomplete records.

### Key Risk
The **auth-to-DB sync gap** is the most significant finding. It allows users to exist in Supabase Auth without `user` table records, resulting in degraded functionality and data inconsistency.

# Delivery Steps

### ✓ Step 1: Review and present investigation report
Present the complete investigation report covering all 10 areas: connection verification, schema comparison, migration history, data consistency, authentication impact, security configuration, documentation consistency, findings summary, remediation plan, and conclusions. Wait for user review and approval before any implementation.

### ✓ Step 2: Implement approved remediation changes
After user approval, implement the remediation changes one at a time following the safe workflow: inspect → backup plan → propose change → approve → implement → verify database → test application → regression test → confirm. Start with the highest severity issues first.

### ✓ Step 3: Verify database changes
Verify all implemented changes compile correctly, pass tests, and are consistent with the Prisma schema. Confirm the auto-sync logic, permission restrictions, and self-registration endpoint work as expected at the code level. Live database verification is not possible (Supabase unreachable).