---
sessionId: session-261121-172737-t2n0
---

# Investigation Scope & Methodology

### Overview
This is a **read-only investigation** of the HEMORA login flow. The goal is to trace every stage from button press to dashboard display, identify bottlenecks with evidence, and produce a ranked list of optimization recommendations.

### Login Flow Stages to Investigate
1. **Mobile sign-in button** → `sign-in.tsx` calls `signIn()` from `auth-client.ts`
2. **Supabase auth** → `supabase.auth.signInWithPassword()` hits Supabase cloud
3. **Session establishment** → `useSession()` hook picks up the new session via `onAuthStateChange`
4. **Navigation to `/home`** → `router.replace("/home")` triggers `index.tsx` and `_layout.tsx`
5. **Role fetch** → Both `index.tsx` and `_layout.tsx` call `hemoraFetch("/api/hemora/me")` to get the user's role
6. **Redirect to dashboard** → `router.replace()` to role-specific dashboard (e.g., `/_dashboard/manager`)
7. **Dashboard data loading** → Multiple `useQuery` hooks fire in parallel

### Key Files Under Investigation

**Mobile (hemora-mobile):**
- `src/app/(auth)/sign-in.tsx` — Login button handler
- `src/lib/auth-client.ts` — `signIn()`, `useSession()`, `getAccessToken()`
- `src/lib/supabase.ts` — Supabase client config
- `src/lib/api.ts` — `hemoraFetch()` wrapper with 10s timeout
- `src/app/_layout.tsx` — Root auth guard + role fetch + redirect
- `src/app/index.tsx` — Splash screen + duplicate role fetch + redirect
- `src/app/(main)/home.tsx` — Home screen + yet another role fetch + redirect
- `src/app/(main)/_dashboard/*/index.tsx` — Dashboard data loading

**Backend (hemora-backend):**
- `src/server.ts` — Express entry, request timing middleware
- `src/lib/jwt-verify.ts` — JWT verification + Supabase user lookup
- `src/lib/supabase.ts` — Service-role Supabase admin client
- `src/lib/prisma.ts` — Prisma client with Pg adapter (no connection pool)
- `src/middleware/rbac.middleware.ts` — `requireAuth()` and `requirePermission()`
- `src/routes/prototype.routes.ts` — `/me` endpoint with heavy includes
- `prisma/schema.prisma` — Database schema and indexes

### Methodology
- Static code analysis of each stage
- Identification of redundant operations
- Analysis of sequential vs parallel execution
- Database query pattern review
- Network round-trip counting
- Configuration review (connection pooling, timeouts, caching)

# Findings & Root Causes

### Confirmed Bottlenecks

#### 1. Triple Role Fetch (Critical)
**Files:** `_layout.tsx` (line 59-75), `index.tsx` (line 32-46), `home.tsx` (line 44-58)

Three separate components each call `hemoraFetch("/api/hemora/me")` to fetch the user's role:
- `_layout.tsx` fires when `session?.user` changes
- `index.tsx` fires independently when `session?.user` changes
- `home.tsx` fires again when mounted

Each call requires: network round-trip → JWT verify → Supabase user lookup → Prisma query with heavy includes (facility, requisitions, campaignInvitations)

**Impact:** 3× the cost of a single `/me` call. The `/me` endpoint loads facility, 5 requisitions, and campaign invitations — far more than needed for a role check.

#### 2. Sequential Navigation Chain (Critical)
**Flow:** `sign-in.tsx` → `router.replace("/home")` → `index.tsx` renders → fetches role → `router.replace(targetRoute)` → `home.tsx` renders → fetches role again → `router.replace(targetRoute)` → dashboard renders

This creates a **3-screen navigation chain** where each screen must mount, fetch the role, and redirect before the next screen appears. Each step adds:
- Component mount time
- Network round-trip for `/me`
- Navigation animation

**Impact:** Instead of 1 redirect to the dashboard, there are 3 sequential redirects, each blocked by a network call.

#### 3. Heavy `/me` Endpoint for Role Check (High)
**File:** `prototype.routes.ts` (line 437-459)

The `/me` endpoint includes:
- `facility` (relation)
- `requisitions` (ordered, limited to 5)
- `campaignInvitations` (ordered, with campaign relation)

But the mobile app only needs the `role` field. This means every role check triggers a multi-table JOIN query instead of a simple single-column lookup.

**Impact:** Each `/me` call does 3-4× more database work than needed.

#### 4. No Connection Pooling in Prisma (High)
**File:** `prisma.ts` (line 9-10)

```
const adapter = new PrismaPg({ connectionString: databaseUrl });
export const prisma = new PrismaClient({ adapter });
```

The `PrismaPg` adapter creates a new pool per process but uses default pool size (typically 10). With no explicit pool configuration, each request may wait for a connection during peak load. More critically, **each new backend restart** creates a fresh pool with cold connections.

**Impact:** First request after backend start has cold connection overhead (~100-500ms).

#### 5. JWT Verification Fetches User from Supabase on Every Request (Medium)
**File:** `jwt-verify.ts` (line 77-101)

Every authenticated API call triggers:
1. JWT signature verification (fast, cached JWKs)
2. `supabaseAdmin.from("user").select(...).eq("id", payload.sub).single()` — a **separate HTTP call to Supabase** for every request

This means the `/me` endpoint alone triggers: 1 Supabase HTTP call (in middleware) + 1 Prisma query (in route handler) = 2 database lookups for the same user.

**Impact:** Every API call has an extra network round-trip to Supabase for user lookup.

#### 6. Dashboard Fires 5 Parallel Queries on Load (Medium)
**File:** `manager/index.tsx` (lines 157-184)

The manager dashboard fires 5 `useQuery` hooks simultaneously:
- `GET /api/hemora/inventory`
- `GET /api/hemora/requisitions`
- `POST /api/hemora/forecast/all` (calls AI service with 2s timeout)
- `GET /api/hemora/forecast/model-info` (calls AI service)
- `GET /api/hemora/campaigns`

Each query goes through the RBAC middleware (JWT verify + Supabase lookup + Prisma). The forecast endpoints add an additional network hop to the AI service.

**Impact:** Dashboard appears "slow" because it waits for all 5 queries, including the AI service calls.

#### 7. Supabase Auth Network Latency (Medium)
**File:** `auth-client.ts` (line 7-14)

`signInWithPassword()` makes a direct HTTP call to `https://fmvbkaliixhyssydseti.supabase.co/auth/v1/token`. This is a cloud service that adds network latency depending on the user's location relative to Supabase's servers.

**Impact:** Base latency of ~100-500ms for the auth call itself, before any backend processing.

### Potential Issues Requiring Runtime Testing

#### 8. Duplicate `useSession` Hooks
Multiple components (`sign-in.tsx`, `index.tsx`, `_layout.tsx`, `home.tsx`) each mount their own `useSession()` hook. Each hook calls `supabase.auth.getSession()` and registers an `onAuthStateChange` listener.

#### 9. `hemoraFetch` Token Fetch Overhead
Every `hemoraFetch` call awaits `getAccessToken()` which calls `supabase.auth.getSession()` — an async storage read. This adds overhead to every API call.

#### 10. AI Service Timeout Impact
The forecast endpoint has a 2-second timeout for the AI service. If the AI service is slow or unreachable, it blocks the response for 2 seconds before falling back.

### Timing Breakdown (Estimated)

| Login Stage | Estimated Duration | Confirmed |
|---|---|---|
| Button press → Supabase auth request | 50-200ms | Yes (input validation) |
| Supabase `signInWithPassword` | 200-800ms | Cloud latency |
| Session establishment (AsyncStorage) | 10-50ms | Yes |
| Navigation to index.tsx | 50-100ms | React Native nav |
| First `/me` fetch (index.tsx) | 300-800ms | JWT + Supabase + Prisma |
| Redirect to home.tsx | 50-100ms | React Native nav |
| Second `/me` fetch (home.tsx) | 300-800ms | Duplicate call |
| Redirect to dashboard | 50-100ms | React Native nav |
| Third `/me` fetch (_layout.tsx) | 300-800ms | Duplicate call |
| Dashboard 5 parallel queries | 500-2000ms | Includes AI service |
| **Total estimated** | **~2-6 seconds** | |

# Delivery Steps

### ✓ Step 1: Stage 1: Deliver Comprehensive Investigation Report
Produce a complete technical report documenting all findings from the static code analysis of the login flow. The report will cover:

- **Executive Summary**: Login is slow due to a combination of redundant role fetches (3×), a sequential 3-screen navigation chain, an over-heavy `/me` endpoint, and per-request Supabase user lookups in JWT middleware.
- **Login Flow Diagram**: Complete trace from button press through Supabase auth, session establishment, triple role fetch across `_layout.tsx` → `index.tsx` → `home.tsx`, and final dashboard loading with 5 parallel queries.
- **Confirmed Bottlenecks** (ranked by impact):
  1. Triple role fetch — 3 separate calls to `/me` from 3 different components
  2. Sequential navigation chain — 3-screen redirect chain instead of direct dashboard navigation
  3. Heavy `/me` endpoint — loads facility, requisitions, and campaign invitations when only `role` is needed
  4. No Prisma connection pooling config — cold connection overhead on first requests
  5. Per-request Supabase user lookup — every API call triggers an HTTP request to Supabase for user data
  6. Dashboard 5-query fan-out — including AI service calls with 2s timeout
  7. Supabase auth network latency — cloud-based auth adds base latency
- **Timing Breakdown Table**: Estimated durations for each stage with total ~2-6 seconds
- **Potential Issues**: Duplicate `useSession` hooks, `getAccessToken` overhead per request, AI service timeout impact
- **Recommended Solutions** (ranked by impact/risk ratio):
  1. Cache role in session metadata — eliminate redundant `/me` calls
  2. Direct dashboard navigation — skip intermediate screens after login
  3. Lightweight role endpoint — add `/api/hemora/role` returning only the role field
  4. User cache in JWT middleware — cache user lookup results with TTL
  5. Prisma connection pool config — explicit pool size and connection settings
  6. Dashboard query optimization — lazy-load non-critical data (forecast, campaigns)
  7. Parallel role + session initialization — fetch role while session establishes
- **Implementation Plan**: Specific files and changes needed for each optimization
- **Regression Tests**: How to verify each optimization doesn't break auth, permissions, or navigation
- **Performance Targets**: Realistic targets for each stage (e.g., login API <500ms, total login <2s)

# Implementation Steps

### ✓ Step 2: Add lightweight `/api/hemora/role` endpoint
Backend: Add a new endpoint that returns only the user's role field, avoiding the heavy includes of `/me`. This serves as the foundation for all other mobile-side optimizations.

### ✓ Step 3: Cache role in mobile session & eliminate triple role fetch
Mobile: Store the role in a shared cache so that `_layout.tsx`, `index.tsx`, and `home.tsx` all read from a single cached value instead of making 3 separate `/me` calls.

### ✓ Step 4: Direct dashboard navigation after login
Mobile: After successful login, navigate directly to the role-specific dashboard instead of the 3-screen redirect chain (sign-in → index → home → dashboard).

### ✓ Step 5: Add user cache in JWT middleware
Backend: Cache the Supabase user lookup result in memory with a TTL to avoid per-request HTTP calls to Supabase.

### ✓ Step 6: Configure Prisma connection pool
Backend: Set explicit pool size and connection settings in the PrismaPg adapter.

### ✓ Step 7: Optimize dashboard queries with lazy loading
Mobile: Lazy-load non-critical dashboard data (forecast, campaigns) so the dashboard appears faster.

### ✓ Step 8: Verification and regression testing
Run compilation checks and verify that all changes work together without breaking authentication, permissions, or navigation.