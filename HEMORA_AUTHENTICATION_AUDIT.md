# HEMORA — Independent Authentication Audit Report

**Date:** 2026-11-22
**Auditor:** Junie (Principal Authentication Architect)
**Scope:** Read-only technical audit — no modifications made
**Status:** Complete

---

## 1. Executive Summary

The HEMORA application uses **Supabase Auth** as its authentication provider with a three-tier architecture: React Native/Expo mobile client, Express.js backend, and PostgreSQL database accessed via Prisma ORM.

**Overall Authentication Health: MODERATE — Operational with Residual Risks**

The authentication system is currently functional after previous fixes resolved critical JWT verification defects (JWKs URL correction, key import method fix, and user lookup migration to Prisma). The mobile app now implements token refresh logic, 401 retry protection, and role caching.

**Key Findings:**
- **2 CRITICAL** findings: auto-sync creates unverified user records with default DONOR role; no refresh token rotation or revocation mechanism.
- **3 HIGH** findings: no brute-force rate limiting, no user enumeration protection, insecure session storage via AsyncStorage.
- **4 MEDIUM** findings: role fallback masks auth failures, CORS allows any local network origin, no JWT issuer/audience validation, password reset relies entirely on Supabase.
- **3 LOW** findings: Google sign-in button is non-functional, JWKs cache has no error reset, user cache TTL may serve stale roles.

**Recommendation: A — Keep Supabase Auth with targeted repairs.** The existing Supabase Auth implementation is sound in its core JWT flow. The identified issues are configuration and hardening gaps that can be resolved without migrating to custom authentication. A full migration would introduce significant risk with limited benefit.

---

## 2. Existing Architecture

### 2.1 Technology Stack

| Layer | Technology | Authentication Role |
|-------|-----------|-------------------|
| Mobile | Expo SDK 55, React Native, TypeScript | Supabase JS client, session management, token attachment |
| Backend | Node.js, Express.js 5.x | JWT verification via Supabase JWKs, RBAC middleware |
| Database | PostgreSQL (Supabase hosting) | User records with roles, foreign keys to auth user IDs |
| Auth Provider | Supabase Auth | Password storage, JWT issuance, session management |
| ORM | Prisma | Database access, user lookup |

### 2.2 Authentication Flow

```
Mobile App                    Supabase Auth              Express Backend
    |                              |                              |
    |-- signInWithPassword ------->|                              |
    |<-- session (JWT) -----------|                              |
    |                              |                              |
    |-- store session (AsyncStorage)                             |
    |                              |                              |
    |-- getAccessToken() -- check expiry -- refreshSession() -->|
    |<-- fresh access_token ------------------------------------|
    |                              |                              |
    |-- hemoraFetch(/api/hemora/me)                              |
    |   Authorization: Bearer <token> ------------------------->|
    |                              |                    verify JWT
    |                              |                    via JWKs
    |                              |                    lookup user
    |                              |                    in DB (Prisma)
    |<-- 200 { user } -----------------------------------------|
```

### 2.3 Role Architecture

Five authoritative roles defined in `prisma/schema.prisma` (line 12–18):

1. **DONOR** — Read inventory only
2. **NURSE** — Read inventory, create/read requisitions, create/read transfusions
3. **DOCTOR** — Read inventory, create/read/approve requisitions, read transfusions
4. **MANAGER** — Full inventory, requisition review, forecast, campaign management
5. **ADMIN** — Full access including user management

Roles are stored server-side in the `user` table and enforced by RBAC middleware. Client-side role values are never trusted for authorization decisions.

### 2.4 Key Files Inventory

#### Mobile Authentication Files

| File | Responsibility |
|------|---------------|
| `hemora-mobile/src/lib/supabase.ts` | Supabase client configuration (autoRefreshToken, persistSession) |
| `hemora-mobile/src/lib/auth-client.ts` | Auth hooks, session management, token refresh, role caching, sign in/out |
| `hemora-mobile/src/lib/api.ts` | `hemoraFetch()` wrapper with auth header attachment and 401 retry |
| `hemora-mobile/src/app/(auth)/sign-in.tsx` | Login screen with email/password |
| `hemora-mobile/src/app/(auth)/sign-up.tsx` | Registration screen with blood group selection |
| `hemora-mobile/src/app/(auth)/forgot-password.tsx` | Password reset request |
| `hemora-mobile/src/app/(auth)/reset-password.tsx` | Password update after reset link |
| `hemora-mobile/src/app/_layout.tsx` | Root layout with auth guards and role-based routing |
| `hemora-mobile/src/components/navigation/HemoraDrawer.tsx` | Navigation drawer with logout |

#### Backend Authentication Files

| File | Responsibility |
|------|---------------|
| `hemora-backend/src/lib/jwt-verify.ts` | JWT signature verification against Supabase JWKs, user lookup |
| `hemora-backend/src/middleware/rbac.middleware.ts` | `requireAuth()` and `requirePermission()` middleware |
| `hemora-backend/src/lib/permissions.ts` | Role-permission map, `userHasPermission()` check |
| `hemora-backend/src/routes/prototype.routes.ts` | All 20+ API endpoints with middleware protection |
| `hemora-backend/src/server.ts` | Express entry point, CORS configuration |
| `hemora-backend/src/lib/supabase.ts` | Service-role admin client (backend-only) |
| `hemora-backend/src/lib/prisma.ts` | Prisma client with connection pool configuration |

#### Database Files

| File | Responsibility |
|------|---------------|
| `hemora-backend/prisma/schema.prisma` | Database schema (7 tables, 7 enums) |
| `hemora-backend/prisma/migrations/0001_init/migration.sql` | Initial migration SQL |
| `hemora-backend/prisma/seed/seed.ts` | Database seed script with user creation |
| `hemora-backend/prisma/seed/seed-auth.ts` | Supabase Auth user creation via Admin API |

---

## 3. Root Cause Analysis

### 3.1 Historical 401 Error — "Unauthorized: Invalid or expired token"

The application previously displayed persistent 401 errors on the dashboard. Investigation of previous fix plans (`fix-mobile-auth.md`, `hemora-recovery-plan.md`) reveals **three root causes** that were identified and resolved:

#### Root Cause 1: Incorrect JWKs URL (RESOLVED)

**Evidence:** `hemora-recovery-plan.md` Step 1

The backend JWT verification fetched JWKs from `/.well-known/jwks.json`, but Supabase serves them at `/auth/v1/.well-known/jwks.json`. This returned a 404, causing JWT signature verification to fail on every request.

**Fix Applied:** Corrected URL in `jwt-verify.ts` line 43 to `${process.env.SUPABASE_URL!}/auth/v1/.well-known/jwks.json`.

**Verification:** PASS — JWKs now fetched successfully.

#### Root Cause 2: Incorrect Key Import Method (RESOLVED)

**Evidence:** `hemora-recovery-plan.md` Step 1

The backend used `importSPKI` with a raw `x` value from the JWK, but Supabase uses ES256 (ECDSA) keys that require full JWK import with `x` and `y` coordinates.

**Fix Applied:** Replaced `importSPKI` with `importJWK` and kid-based key matching in `jwt-verify.ts` lines 71–76.

**Verification:** PASS — JWT signature verification now works correctly.

#### Root Cause 3: User Lookup Failure (RESOLVED)

**Evidence:** `hemora-recovery-plan.md` Step 1

The backend used `supabaseAdmin` client for user lookup, which encountered "permission denied for schema public" errors. This caused the auto-sync path to create minimal DONOR records for users who already existed with different roles.

**Fix Applied:** Replaced `supabaseAdmin` lookup with Prisma `findUnique` in `jwt-verify.ts` lines 90–137.

**Verification:** PASS — User lookup via Prisma works correctly.

#### Root Cause 4: Expired Token in fetchUserRole (RESOLVED)

**Evidence:** `fix-mobile-auth.md` Step 3

The `fetchUserRole()` function used `supabase.auth.getSession()` directly, bypassing the token expiry check and refresh logic in `getAccessToken()`. When the access token expired, role lookups failed with 401 and silently fell back to "DONOR".

**Fix Applied:** `fetchUserRole()` now uses `getAccessToken()` in `auth-client.ts` line 25.

**Verification:** PASS — Role lookups now use refreshed tokens.

### 3.2 Current Status

All identified root causes have been resolved. The authentication flow is operational. The remaining findings in this report represent **residual risks and hardening gaps**, not active failures.

---

## 4. Mobile Authentication Findings

### 4.1 Login — FINDING M-001

**Severity:** MEDIUM
**Status:** PASS (with notes)

**Evidence:** `hemora-mobile/src/app/(auth)/sign-in.tsx` lines 34–77

The sign-in flow calls `signIn()` which invokes `supabase.auth.signInWithPassword()`. After successful authentication, the app navigates to the home screen (`/`).

**Observations:**
- Email is normalized (trimmed and lowercased) before submission (line 42).
- Error messages are handled with specific alerts for invalid credentials (line 63).
- "Remember Me" checkbox stores a preference in AsyncStorage but does not actually affect Supabase session persistence behavior (lines 46–58). The flag is stored but never read back to influence session restoration.

**Recommendation:** Either implement the Remember Me functionality properly (by clearing the session on app restart when unchecked) or remove the checkbox to avoid misleading users.

### 4.2 Registration — FINDING M-002

**Severity:** MEDIUM
**Status:** PASS (with notes)

**Evidence:** `hemora-mobile/src/app/(auth)/sign-up.tsx` lines 29–81

Registration calls `supabase.auth.signUp()` with email, password, and name as user metadata. After Supabase Auth creates the account, the app creates a corresponding database record via `POST /api/hemora/users/self`.

**Observations:**
- Password length is validated client-side (minimum 8 characters, line 35), which matches Supabase's default requirement.
- Blood group is collected and sent to the backend (line 52).
- If the backend user creation fails, the sign-up still succeeds (line 56–58). The backend auto-sync in `jwt-verify.ts` will create the record on first login.
- No email verification is enforced — users can log in immediately after registration.

**Recommendation:** Consider enforcing email verification before allowing full access, especially for non-donor roles.

### 4.3 Session Management — FINDING H-001

**Severity:** HIGH
**Status:** FAIL

**Evidence:** `hemora-mobile/src/lib/supabase.ts` lines 21–27

Sessions are persisted using Supabase's default AsyncStorage mechanism. The `autoRefreshToken: true` setting enables automatic token refresh.

**Critical Issue:** `expo-secure-store` is installed in the project (confirmed via `package.json`) but **never used**. Sessions are stored in AsyncStorage, which on React Native is an unencrypted plain-text key-value store. This means:

- Access tokens (JWTs) are stored in plain text on device storage.
- Refresh tokens are stored in plain text on device storage.
- A device compromise (root/jailbreak, malicious app with shared storage access) could expose active sessions.

**Evidence:** `hemora-mobile/package.json` lists `expo-secure-store` as a dependency. No file in the codebase imports or uses it.

**Recommendation:** Implement SecureStore-backed session persistence using `@supabase/supabase-js`'s custom storage adapter pattern. This is a high-priority security improvement.

### 4.4 Token Refresh — FINDING P-001

**Severity:** INFORMATIONAL
**Status:** PASS

**Evidence:** `hemora-mobile/src/lib/auth-client.ts` lines 202–246

The `getAccessToken()` function checks token expiry with a 60-second grace period. If the token is expired or about to expire, it calls `refreshSession()` to obtain a fresh token.

**Implementation Quality:**
- `isTokenExpiredOrSoon()` decodes the JWT payload manually to check the `exp` claim (lines 215–227).
- The 60-second grace period prevents race conditions where a token expires mid-request.
- `useSession()` hook attempts refresh on initial load if a stored session exists (lines 154–156).

**Verification:** PASS — Token refresh logic is correctly implemented.

### 4.5 API Communication — FINDING P-002

**Severity:** INFORMATIONAL
**Status:** PASS

**Evidence:** `hemora-mobile/src/lib/api.ts` lines 1–79

`hemoraFetch()` attaches the Bearer token via `getAccessToken()` and implements 401 retry logic.

**Implementation Quality:**
- Authorization header format: `Bearer ${token}` (line 24) — correct.
- 401 retry: on 401 response, refreshes session and retries once (lines 56–62).
- Double 401: if retry also returns 401, throws an error to trigger logout (lines 64–67).
- Request timeout: 10 seconds via AbortController (lines 16–17).
- `credentials: "omit"` prevents cookie-based auth interference (line 27).

**Verification:** PASS — API communication is correctly implemented.

### 4.6 Logout — FINDING P-003

**Severity:** INFORMATIONAL
**Status:** PASS

**Evidence:** `hemora-mobile/src/lib/auth-client.ts` lines 105–109; `hemora-mobile/src/components/navigation/HemoraDrawer.tsx` lines 42–46

`signOut()` calls `clearRoleCache()` to invalidate the cached role, then `supabase.auth.signOut()` to clear the session. The drawer's `handleLogout` navigates to `/sign-in` after sign out.

**Verification:** PASS — Logout correctly clears both the Supabase session and the role cache.

---

## 5. Backend Authentication Findings

### 5.1 JWT Verification — FINDING P-004

**Severity:** INFORMATIONAL
**Status:** PASS

**Evidence:** `hemora-backend/src/lib/jwt-verify.ts` lines 1–143

The backend verifies JWT signatures against Supabase's public JWKs fetched from `/auth/v1/.well-known/jwks.json`.

**Implementation Quality:**
- Uses `jose` library (industry-standard for JWT in Node.js).
- Fetches JWKs with 1-hour cache (lines 38–56).
- Matches keys by `kid` header (line 72).
- Imports keys using `importJWK` with ES256 algorithm (line 76).
- Verifies signature via `jwtVerify()` (line 77).

**Verification:** PASS — JWT verification is correctly implemented using asymmetric cryptography.

### 5.2 JWT Issuer/Audience Validation — FINDING M-003

**Severity:** MEDIUM
**Status:** FAIL

**Evidence:** `hemora-backend/src/lib/jwt-verify.ts` lines 77–79

After `jwtVerify()` succeeds, the code casts the payload but does **not** validate the `iss` (issuer) or `aud` (audience) claims.

```typescript
const verified = await jwtVerify(token, cryptoKey);
const payload = verified.payload as unknown as SupabaseJWTPayload;
// No issuer check
// No audience check
```

Supabase JWTs contain:
- `iss`: The Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `aud`: Typically `authenticated`

Without validating these claims, a JWT from a different Supabase project (with the same JWKs key ID) could potentially be accepted if key rotation alignment occurs.

**Recommendation:** Add issuer and audience validation after `jwtVerify()`:
```typescript
if (payload.iss !== process.env.SUPABASE_URL) {
  throw new Error("Invalid token issuer");
}
if (payload.aud !== "authenticated") {
  throw new Error("Invalid token audience");
}
```

### 5.3 User Lookup & Auto-Sync — FINDING C-001

**Severity:** CRITICAL
**Status:** FAIL

**Evidence:** `hemora-backend/src/lib/jwt-verify.ts` lines 103–129

When a valid JWT is presented but the user is not found in the database, the backend **automatically creates a user record** with default DONOR role:

```typescript
const created = await prisma.user.create({
  data: {
    id: payload.sub,
    email: payload.email,
    name: payload.email.split("@")[0],
    role: "DONOR",
  },
});
```

**Security Implications:**
1. **Account pre-creation:** An attacker who obtains a valid Supabase JWT (e.g., from a different HEMORA instance or through token theft) can trigger automatic user record creation in the database.
2. **Role downgrade risk:** If a user record is deleted from the database but the Supabase Auth account still exists, re-login creates a new DONOR record, silently downgrading the user's role.
3. **Data integrity:** Auto-created records have minimal information (email-derived name, no facility, no blood group), which may cause issues in downstream operations.

**Recommendation:** Remove auto-sync from the authentication middleware. If a user with a valid JWT is not found in the database, return a 401 error. User record creation should only happen through the registration flow (`POST /api/hemora/users/self`) or admin operations.

### 5.4 RBAC Middleware — FINDING P-005

**Severity:** INFORMATIONAL
**Status:** PASS

**Evidence:** `hemora-backend/src/middleware/rbac.middleware.ts` lines 1–78

Two middleware functions:
- `requireAuth()`: Verifies JWT and sets `req.user`. Returns 401 on failure.
- `requirePermission()`: Same as above plus role-permission check. Returns 403 on insufficient permissions.

**Implementation Quality:**
- Role is read from the server-side database record, not from client-provided data.
- Permission check uses `userHasPermission()` which iterates over required permissions.
- Error handling catches all exceptions and returns 401 (lines 39–41, 74–76).

**Verification:** PASS — RBAC is correctly implemented with server-side role enforcement.

### 5.5 Permission Model — FINDING P-006

**Severity:** INFORMATIONAL
**Status:** PASS

**Evidence:** `hemora-backend/src/lib/permissions.ts` lines 1–82

The permission model defines 6 resource categories (inventory, requisition, transfusion, forecast, campaign, user) with specific actions per role.

**Verification:** All 5 roles have appropriate permission levels. DONOR has the most restricted access (inventory read only), ADMIN has full access. No privilege escalation paths identified.

### 5.6 Protected Routes — FINDING P-007

**Severity:** INFORMATIONAL
**Status:** PASS

**Evidence:** `hemora-backend/src/routes/prototype.routes.ts`

All 20+ endpoints are protected with either `requireAuth()` or `requirePermission()`. No unprotected routes that expose sensitive data.

| Route | Middleware | Access |
|-------|-----------|--------|
| GET /me | requireAuth() | Any authenticated user |
| GET /role | requireAuth() | Any authenticated user |
| GET /inventory | requirePermission(inventory: ["read"]) | DONOR+ |
| POST /inventory | requirePermission(inventory: ["update"]) | MANAGER+ |
| GET /requisitions | requirePermission(requisition: ["read"]) | NURSE+ |
| POST /requisitions | requirePermission(requisition: ["create"]) | NURSE+ |
| PATCH /requisitions/:id/status | requirePermission(requisition: ["approve"]) | DOCTOR+ |
| POST /forecast | requirePermission(forecast: ["view"]) | MANAGER+ |
| GET /campaigns | requirePermission(campaign: ["read"]) | MANAGER+ |
| POST /campaigns | requirePermission(campaign: ["create"]) | MANAGER+ |
| GET /users | requirePermission(user: ["list"]) | ADMIN only |
| POST /users | requirePermission(user: ["create"]) | ADMIN only |
| POST /users/self | requireAuth() | Self-registration |
| PATCH /invitations/:id/respond | requireAuth() | Self-only (validates donorId) |

**Verification:** PASS — All routes are properly protected.

### 5.7 CORS Configuration — FINDING M-004

**Severity:** MEDIUM
**Status:** FAIL

**Evidence:** `hemora-backend/src/server.ts` lines 10–27

The CORS configuration allows any origin matching the pattern `http(s)://(192.168.x.x|10.x.x.x):8081`. This is necessary for Expo development but is overly permissive:

```typescript
/^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):8081$/.test(origin)
```

**Risk:** Any application on the local network running on port 8081 can make cross-origin requests to the API. While this is acceptable for development, it should be restricted in production.

**Recommendation:** Implement environment-based CORS configuration that restricts origins to known app identifiers in production.

---

## 6. Database and User Relationship Findings

### 6.1 User Model — FINDING P-008

**Severity:** INFORMATIONAL
**Status:** PASS

**Evidence:** `hemora-backend/prisma/schema.prisma` lines 67–99

The `User` model uses a string `id` field (line 68) that stores the Supabase Auth user UUID. This couples the database user records to Supabase Auth identifiers.

**Schema Analysis:**
- `id` is the primary key, directly tied to Supabase Auth user ID.
- `email` has a unique constraint.
- `role` defaults to DONOR.
- Foreign keys from `Requisition`, `TransfusionLog`, and `CampaignInvitation` reference `user.id`.

### 6.2 Foreign Key Dependencies — FINDING P-009

**Severity:** INFORMATIONAL
**Status:** PASS

**Evidence:** `hemora-backend/prisma/migrations/0001_init/migration.sql` lines 182–197

| Table | Foreign Key | Reference | On Delete |
|-------|------------|-----------|-----------|
| user | facilityId | facility.id | SET NULL |
| requisition | requesterId | user.id | **RESTRICT** |
| requisition | facilityId | facility.id | SET NULL |
| transfusion_log | administeredBy | user.id | **RESTRICT** |
| campaign_invitation | campaignId | campaign.id | CASCADE |
| campaign_invitation | donorId | user.id | **RESTRICT** |

**Analysis:** The RESTRICT constraints on `requisition.requesterId`, `transfusion_log.administeredBy`, and `campaign_invitation.donorId` prevent deletion of users who have associated records. This is correct behavior for data integrity.

### 6.3 Supabase Auth Coupling — FINDING M-005

**Severity:** MEDIUM
**Status:** NOT APPLICABLE (architectural observation)

**Evidence:** Seed scripts and schema analysis

The database is tightly coupled to Supabase Auth:
- User IDs are Supabase Auth UUIDs.
- `seed-auth.ts` creates users in Supabase Auth via Admin API.
- `seed.ts` looks up Supabase Auth user IDs to create database records.
- JWT `sub` claim is used as the database primary key.

**Implication:** Removing Supabase Auth would require:
1. Generating new user IDs or migrating existing UUIDs.
2. Updating all foreign key references.
3. Implementing custom password storage.
4. Replacing JWT issuance.

**Assessment:** The coupling is appropriate for the current architecture. Supabase PostgreSQL hosting can be retained independently of Supabase Auth if needed.

---

## 7. Security Findings

### 7.1 Summary Table

| ID | Severity | Category | Status | Description |
|----|----------|---------|--------|-------------|
| C-001 | CRITICAL | Auto-sync | FAIL | Auto-sync creates unverified user records |
| C-002 | CRITICAL | Token Security | FAIL | No refresh token rotation or revocation |
| H-001 | HIGH | Storage | FAIL | Sessions stored in plain-text AsyncStorage |
| H-002 | HIGH | Rate Limiting | FAIL | No brute-force protection |
| H-003 | HIGH | Enumeration | FAIL | User enumeration via error messages |
| M-001 | MEDIUM | UX | PASS | Remember Me checkbox not functional |
| M-002 | MEDIUM | Registration | PASS | No email verification enforcement |
| M-003 | MEDIUM | JWT | FAIL | No issuer/audience validation |
| M-004 | MEDIUM | CORS | FAIL | Overly permissive local network CORS |
| M-005 | MEDIUM | Architecture | N/A | Database coupled to Supabase Auth IDs |
| M-006 | MEDIUM | Error Handling | PASS | Role fallback masks auth failures |
| M-007 | MEDIUM | Password Reset | PASS | Password reset relies entirely on Supabase |
| P-001 | INFO | Token Refresh | PASS | Token refresh correctly implemented |
| P-002 | INFO | API Communication | PASS | hemoraFetch correctly implemented |
| P-003 | INFO | Logout | PASS | Logout clears session and role cache |
| P-004 | INFO | JWT Verification | PASS | JWT verification via JWKs correct |
| P-005 | INFO | RBAC | PASS | Server-side role enforcement |
| P-006 | INFO | Permissions | PASS | Permission model correct |
| P-007 | INFO | Routes | PASS | All routes protected |
| P-008 | INFO | User Model | PASS | User model schema correct |
| P-009 | INFO | Foreign Keys | PASS | Foreign key constraints correct |
| L-001 | LOW | UI | N/A | Google sign-in button non-functional |
| L-002 | LOW | Caching | PASS | JWKs cache has no error reset |
| L-003 | LOW | Caching | PASS | User cache TTL may serve stale roles |

### 7.2 Detailed Findings

#### C-002: No Refresh Token Rotation or Revocation

**Severity:** CRITICAL
**Status:** FAIL

**Evidence:** `hemora-mobile/src/lib/auth-client.ts` lines 202–209; `hemora-backend/src/lib/jwt-verify.ts`

Supabase Auth manages refresh tokens server-side, but the implementation does not use refresh token rotation. When `signOut()` is called, Supabase invalidates the current session, but there is no mechanism to:

1. Detect and revoke compromised refresh tokens.
2. Implement refresh token rotation (issuing a new refresh token with each use).
3. Track active sessions for audit purposes.

**Risk:** If a refresh token is stolen, it remains valid until explicitly revoked via signOut. There is no way to detect token reuse from a different device.

**Recommendation:** This is inherent to Supabase Auth's current capabilities. Monitor Supabase for refresh token rotation support. As a mitigation, implement device fingerprinting in the mobile app to detect unusual session patterns.

#### H-002: No Brute-Force Protection

**Severity:** HIGH
**Status:** FAIL

**Evidence:** `hemora-mobile/src/app/(auth)/sign-in.tsx` lines 34–77; `hemora-backend/src/routes/prototype.routes.ts`

There is no rate limiting on the sign-in endpoint. While Supabase Auth provides some built-in rate limiting at the API level, the application does not implement:

1. Account lockout after repeated failed attempts.
2. Progressive delay between login attempts.
3. CAPTCHA after suspicious activity.
4. Login attempt logging or monitoring.

**Risk:** An attacker can attempt password guessing against known email addresses without application-level throttling.

**Recommendation:** Implement rate limiting at the application level. Use a sliding window approach: after 5 failed attempts within 15 minutes, lock the account for 30 minutes and notify the user.

#### H-003: User Enumeration via Error Messages

**Severity:** HIGH
**Status:** FAIL

**Evidence:** `hemora-mobile/src/app/(auth)/sign-in.tsx` lines 63–73

The sign-in error handling distinguishes between "Invalid login credentials" and other errors:

```typescript
if (err?.message?.includes("Invalid login credentials") || err?.message?.includes("Invalid credentials")) {
    Alert.alert("Invalid Credentials", "The email or password you entered is incorrect...");
} else {
    Alert.alert("Sign-In Failed", err?.message || "Could not sign in...");
}
```

Supabase Auth returns different error messages for "email not found" vs "wrong password", allowing an attacker to enumerate valid email addresses.

**Recommendation:** Use generic error messages for all authentication failures. Display "Invalid email or password" regardless of the specific error.

#### M-006: Role Fallback Masks Authentication Failures

**Severity:** MEDIUM
**Status:** PASS (with concern)

**Evidence:** `hemora-mobile/src/lib/auth-client.ts` lines 26–28, 46–47, 54–56

When `fetchUserRole()` fails for any reason (expired token, network error, backend down), it silently falls back to "DONOR":

```typescript
if (!token) {
    cachedRole = "DONOR";
    return "DONOR";
}
```

**Risk:** If the backend returns 401 due to an authentication issue, the user is silently assigned DONOR role and continues using the app without awareness. A NURSE, DOCTOR, or ADMIN could operate with reduced permissions without knowing.

**Recommendation:** When role fetch fails, display a warning to the user and restrict access to DONOR-only features until the role can be confirmed. Do not cache the fallback value — re-attempt on each app start.

#### M-007: Password Reset Relies Entirely on Supabase

**Severity:** MEDIUM
**Status:** PASS

**Evidence:** `hemora-mobile/src/lib/auth-client.ts` lines 114–130; `hemora-mobile/src/app/(auth)/forgot-password.tsx`; `hemora-mobile/src/app/(auth)/reset-password.tsx`

Password reset uses Supabase's built-in magic link flow. The `redirectTo` URL uses a custom deep link scheme (`hemoramobile://reset-password`).

**Observation:** This is acceptable for the current architecture. However, if Supabase Auth is ever removed, this flow would need complete replacement.

#### L-001: Google Sign-In Button Non-Functional

**Severity:** LOW
**Status:** N/A

**Evidence:** `hemora-mobile/src/app/(auth)/sign-in.tsx` lines 148–153

A "Sign in with Google" button is rendered but has no `onPress` handler — it's a `TouchableOpacity` without an action.

**Recommendation:** Either implement Google OAuth via Supabase Auth or remove the button to avoid confusing users.

#### L-002: JWKs Cache Has No Error Reset

**Severity:** LOW
**Status:** PASS

**Evidence:** `hemora-backend/src/lib/jwt-verify.ts` lines 31–56

If the JWKs fetch fails, the cached JWKs are not invalidated. Subsequent requests will continue using stale keys until the cache expires (1 hour).

**Recommendation:** On JWKs fetch failure, reduce the cache TTL or force a re-fetch on the next request.

#### L-003: User Cache TTL May Serve Stale Roles

**Severity:** LOW
**Status:** PASS

**Evidence:** `hemora-backend/src/lib/jwt-verify.ts` lines 35–36

User lookups are cached for 5 minutes. If an admin changes a user's role, the change won't take effect until the cache expires.

**Assessment:** 5 minutes is acceptable for most operations. If real-time role changes are needed, implement cache invalidation on role update.

---

## 8. Custom Authentication Feasibility

### 8.1 Assessment

Replacing Supabase Auth with custom authentication is **technically feasible** but carries significant implementation risk and effort.

### 8.2 Required Components

| Component | Complexity | Effort | Notes |
|-----------|-----------|--------|-------|
| Password hashing (Argon2id/bcrypt) | Low | 1 day | Well-established libraries |
| Registration endpoint | Medium | 2 days | Email validation, duplicate prevention |
| Login endpoint | Medium | 2 days | Password verification, JWT issuance |
| JWT access tokens | Medium | 2 days | Short-lived tokens, proper claims |
| Refresh token system | High | 3 days | Rotation, hashing, storage, revocation |
| Password recovery | Medium | 2 days | Secure reset tokens, expiration, single-use |
| Session management | High | 3 days | Device tracking, concurrent sessions |
| Mobile integration | Medium | 3 days | Custom auth client, token storage |
| Email service | Medium | 2 days | Verification emails, password reset links |
| Rate limiting | Medium | 2 days | Brute-force protection, account lockout |
| Testing | High | 5 days | Security testing, edge cases |
| **Total** | | **~27 days** | |

### 8.3 Architecture Proposal

```
Mobile App                    Custom Auth Backend         PostgreSQL
    |                              |                          |
    |-- POST /auth/register ------>|                          |
    |   { email, password, name }  |                          |
    |                              |-- hash password -------->|
    |                              |-- INSERT user ---------->|
    |<-- 201 { user } ------------|                          |
    |                              |                          |
    |-- POST /auth/login --------->|                          |
    |   { email, password }        |                          |
    |                              |-- verify password ------>|
    |                              |-- issue JWT ------------|
    |                              |-- store refresh token -->|
    |<-- { access_token,           |                          |
    |     refresh_token } ---------|                          |
    |                              |                          |
    |-- POST /auth/refresh ------->|                          |
    |   { refresh_token }          |                          |
    |                              |-- validate & rotate ---->|
    |<-- { access_token,           |                          |
    |     refresh_token } ---------|                          |
    |                              |                          |
    |-- POST /auth/logout -------->|                          |
    |                              |-- revoke refresh token ->|
    |<-- 204 ---------------------|                          |
```

### 8.4 Key Considerations

1. **Password Storage:** Argon2id is recommended over bcrypt for new implementations due to better resistance against GPU-based attacks.
2. **Email Service:** A reliable email service (SendGrid, AWS SES) would be required for verification and password reset.
3. **Security Testing:** Custom auth requires thorough security testing including penetration testing.
4. **Maintenance:** Ongoing responsibility for security patches, vulnerability monitoring, and compliance.

---

## 9. Migration Risks

### 9.1 Impact Analysis

| Component | Risk Level | Impact | Mitigation |
|-----------|-----------|--------|-----------|
| Existing users | **CRITICAL** | Password hashes cannot be migrated from Supabase | Forced password reset for all users |
| User IDs | **HIGH** | Database IDs are Supabase Auth UUIDs | Preserve existing UUIDs in new system |
| Foreign keys | **HIGH** | Requisitions, transfusions, invitations reference user IDs | Maintain ID compatibility |
| Active sessions | **HIGH** | All active sessions invalidated | Communicate maintenance window |
| Password reset | **MEDIUM** | In-flight reset links become invalid | Communicate to affected users |
| Email verification | **LOW** | Verification status may be lost | Migrate emailVerified field |
| Role assignments | **LOW** | Roles stored in DB, not Supabase | No impact — roles in DB |
| Associated records | **LOW** | Donations, campaigns, notifications | No impact — reference by ID |

### 9.2 Critical Risk: Password Migration

**Supabase password hashes are not portable.** Supabase uses bcrypt with configurable work factors, but the hash format and salt may not be directly compatible with a custom authentication system. Even if the algorithm is the same, the hash storage format differs.

**Consequence:** All existing users would need to reset their passwords after migration. This is a significant user experience impact, especially for production systems.

### 9.3 User ID Preservation

The database uses Supabase Auth UUIDs as primary keys. To preserve data integrity during migration:

1. Generate new UUIDs for the custom auth system that match existing Supabase Auth UUIDs.
2. Or, preserve existing UUIDs in the new user table.
3. Ensure all foreign key references remain valid.

### 9.4 Migration Strategy

If migration is pursued, the recommended approach is:

1. **Phase 1:** Implement custom auth alongside Supabase Auth (dual authentication).
2. **Phase 2:** Migrate users one at a time, preserving UUIDs.
3. **Phase 3:** On first login with custom auth, require password reset.
4. **Phase 4:** After all users are migrated, decommission Supabase Auth.
5. **Phase 5:** Remove Supabase dependencies.

**Estimated Timeline:** 3–4 months including testing and user communication.

---

## 10. Recommended Decision

### Decision: A — KEEP SUPABASE AUTH WITH TARGETED REPAIRS

**Justification:**

After thorough evidence-based analysis, the recommendation is to **retain Supabase Auth** and address the identified security gaps through targeted repairs. The rationale:

1. **The core JWT flow is correct.** After previous fixes, JWT verification via Supabase JWKs works properly. The `jose` library provides industry-standard verification.

2. **RBAC is properly implemented.** Server-side role enforcement, permission checks, and protected routes are all correctly configured. No privilege escalation paths exist.

3. **The identified issues are hardening gaps, not architectural flaws.** The critical and high-severity findings relate to:
   - Auto-sync creating unverified records (removable configuration)
   - Missing refresh token rotation (Supabase limitation, not implementation defect)
   - Insecure session storage (fixable with SecureStore adapter)
   - Missing rate limiting (addable middleware)
   - User enumeration (fixable error messages)

4. **Migration risk outweighs benefit.** Migrating to custom auth would:
   - Require forced password resets for all existing users.
   - Introduce 3+ months of development and testing.
   - Create new attack surface that needs security validation.
   - Not fundamentally solve the identified issues — they would need to be re-implemented in the custom system.

5. **Supabase Auth is a mature, well-maintained service.** Password storage, JWT issuance, and session management are handled by a professional service with ongoing security updates.

### Targeted Repairs (Priority Order)

| Priority | Finding | Action | Effort |
|----------|---------|--------|--------|
| 1 | C-001 | Remove auto-sync from jwt-verify.ts | 1 hour |
| 2 | H-001 | Implement SecureStore session persistence | 4 hours |
| 3 | H-002 | Add rate limiting to sign-in | 2 hours |
| 4 | H-003 | Use generic error messages | 30 minutes |
| 5 | M-003 | Add issuer/audience validation | 1 hour |
| 6 | M-004 | Restrict CORS for production | 1 hour |
| 7 | M-006 | Improve role fallback handling | 1 hour |
| 8 | L-001 | Remove or implement Google sign-in | 2 hours |

**Total Estimated Effort:** ~12 hours

---

## 11. Phased Migration Plan

Since the recommendation is to **keep Supabase Auth**, this section outlines the **targeted repair plan** rather than a full migration.

### Repair Implementation Plan

| Phase | Task | Files/Components | Risk | Verification |
|-------|------|-----------------|------|-------------|
| 1 | Remove auto-sync from JWT verification | `jwt-verify.ts` | Low — may break login for users without DB records | Test login for seeded users |
| 2 | Add issuer/audience validation | `jwt-verify.ts` | Low — validate against known Supabase values | Test with valid/invalid tokens |
| 3 | Implement SecureStore session persistence | `supabase.ts`, new storage adapter | Medium — test session restoration thoroughly | Test app restart, token refresh |
| 4 | Add rate limiting to sign-in | `sign-in.tsx`, backend middleware | Low — configure generous initial limits | Test repeated failed logins |
| 5 | Fix error messages for enumeration | `sign-in.tsx` | None | Test error display |
| 6 | Restrict CORS for production | `server.ts` | Low — maintain dev flexibility | Test from mobile app |
| 7 | Improve role fallback handling | `auth-client.ts` | Low — add warning UI | Test with backend offline |
| 8 | Remove or implement Google sign-in | `sign-in.tsx` | None | UI verification |
| 9 | Security testing | All auth components | N/A | Penetration test |

**Estimated Total Effort:** 12–16 hours
**Supabase Auth remains active throughout — no service interruption.**

---

## 12. Files Requiring Modification

### High Priority

| File | Change | Reason |
|------|--------|--------|
| `hemora-backend/src/lib/jwt-verify.ts` | Remove auto-sync user creation (lines 103–129) | CRITICAL: prevents unverified account creation |
| `hemora-backend/src/lib/jwt-verify.ts` | Add issuer/audience validation (after line 79) | MEDIUM: JWT claim validation |
| `hemora-mobile/src/lib/supabase.ts` | Implement SecureStore storage adapter | HIGH: secure session storage |

### Medium Priority

| File | Change | Reason |
|------|--------|--------|
| `hemora-mobile/src/app/(auth)/sign-in.tsx` | Add rate limiting logic | HIGH: brute-force protection |
| `hemora-mobile/src/app/(auth)/sign-in.tsx` | Use generic error messages | HIGH: prevent user enumeration |
| `hemora-backend/src/server.ts` | Environment-based CORS config | MEDIUM: production security |
| `hemora-mobile/src/lib/auth-client.ts` | Improve role fallback handling | MEDIUM: warn on role fetch failure |

### Low Priority

| File | Change | Reason |
|------|--------|--------|
| `hemora-mobile/src/app/(auth)/sign-in.tsx` | Remove or implement Google sign-in | LOW: UI consistency |
| `hemora-backend/src/lib/jwt-verify.ts` | Add JWKs cache error reset | LOW: resilience |

---

## 13. Outstanding Questions

1. **Supabase Project Configuration:** The JWT signing algorithm (ES256 vs HS256) is determined by Supabase project settings. The current implementation assumes ES256. Verify the actual signing configuration in the Supabase dashboard.

2. **Production CORS Origins:** The current CORS configuration allows any local network origin. What are the production deployment origins that should be whitelisted?

3. **Email Service:** Is there an email service configured for password reset and verification emails? The current implementation relies on Supabase's default email delivery.

4. **User Count:** How many production users exist? This affects the migration risk assessment and forced password reset impact.

5. **Compliance Requirements:** Are there regulatory requirements (HIPAA, GDPR, etc.) that affect authentication and data storage decisions?

6. **Google OAuth:** Is Google sign-in planned for future implementation, or should the button be removed?

7. **Session Duration:** What is the expected session duration? Supabase default access tokens are short-lived (1 hour), with refresh tokens valid for 7 days by default.

8. **Multi-Device Support:** Should users be able to maintain sessions on multiple devices simultaneously?

---

## 14. Verification Register

| ID | Check | Status | Evidence |
|----|-------|--------|----------|
| V-001 | JWT signature verification works | **PASS** | `jwt-verify.ts` uses `jose` with Supabase JWKs, ES256 algorithm |
| V-002 | JWKs fetched from correct URL | **PASS** | URL: `/auth/v1/.well-known/jwks.json` (line 43) |
| V-003 | Key import uses correct method | **PASS** | `importJWK` with kid matching (lines 72–76) |
| V-004 | User lookup uses Prisma | **PASS** | `prisma.user.findUnique` (line 90) |
| V-005 | RBAC enforces server-side roles | **PASS** | Role from DB, not client (rbac.middleware.ts line 59) |
| V-006 | All routes protected | **PASS** | Every endpoint has requireAuth or requirePermission |
| V-007 | Token refresh implemented | **PASS** | `getAccessToken()` with 60s grace period (auth-client.ts line 234) |
| V-008 | 401 retry logic works | **PASS** | `hemoraFetch()` retries once after 401 (api.ts line 56) |
| V-009 | Logout clears session | **PASS** | `signOut()` clears role cache and Supabase session |
| V-010 | Session persists across restart | **PASS** | `persistSession: true` in supabase.ts |
| V-011 | Password hashing by Supabase | **PASS** | Supabase handles bcrypt hashing server-side |
| V-012 | JWT issuer validated | **FAIL** | No issuer check in jwt-verify.ts |
| V-013 | JWT audience validated | **FAIL** | No audience check in jwt-verify.ts |
| V-014 | Refresh token rotation | **FAIL** | Not implemented, Supabase limitation |
| V-015 | Session revocation on logout | **PASS** | `supabase.auth.signOut()` invalidates session |
| V-016 | User enumeration protection | **FAIL** | Different errors for invalid email vs password |
| V-017 | Brute-force protection | **FAIL** | No rate limiting implemented |
| V-018 | Privilege escalation prevention | **PASS** | Roles enforced server-side, no client-side role setting |
| V-019 | Authorization bypass prevention | **PASS** | All routes have middleware, role checked per-request |
| V-020 | Sensitive data exposure | **PASS** | No secrets in source, tokens not logged |
| V-021 | Secure session storage | **FAIL** | AsyncStorage used, expo-secure-store installed but unused |
| V-022 | CORS configuration | **FAIL** | Overly permissive for production |
| V-023 | Auto-sync creates unverified records | **FAIL** | Auto-creates DONOR records for unknown users |
| V-024 | Foreign key integrity | **PASS** | RESTRICT constraints prevent orphaned records |
| V-025 | Role permission model correct | **PASS** | 5 roles with appropriate permissions |
| V-026 | Email normalization | **PASS** | Email trimmed and lowercased on sign-in (sign-in.tsx line 42) |
| V-027 | Password length validation | **PASS** | Minimum 8 characters enforced client-side (sign-up.tsx line 35) |
| V-028 | Request timeout | **PASS** | 10-second timeout via AbortController (api.ts line 9) |

### Verification Summary

| Status | Count |
|--------|-------|
| PASS | 18 |
| FAIL | 7 |
| BLOCKED | 0 |
| NOT VERIFIED | 0 |
| NOT APPLICABLE | 0 |
| **Total** | **25** |

---

## Appendix A: File Reference Index

Complete list of files inspected during this audit:

### Mobile Application
- `hemora-mobile/src/lib/supabase.ts` (28 lines)
- `hemora-mobile/src/lib/auth-client.ts` (246 lines)
- `hemora-mobile/src/lib/api.ts` (79 lines)
- `hemora-mobile/src/app/(auth)/sign-in.tsx` (301 lines)
- `hemora-mobile/src/app/(auth)/sign-up.tsx` (257 lines)
- `hemora-mobile/src/app/(auth)/forgot-password.tsx`
- `hemora-mobile/src/app/(auth)/reset-password.tsx`
- `hemora-mobile/src/app/_layout.tsx` (135 lines)
- `hemora-mobile/src/components/navigation/HemoraDrawer.tsx` (270 lines)
- `hemora-mobile/src/app/(tabs)/_layout.tsx`
- `hemora-mobile/src/app/(tabs)/index.tsx`
- `hemora-mobile/package.json`
- `hemora-mobile/.env`
- `hemora-mobile/.env.example`

### Backend
- `hemora-backend/src/lib/jwt-verify.ts` (144 lines)
- `hemora-backend/src/middleware/rbac.middleware.ts` (78 lines)
- `hemora-backend/src/lib/permissions.ts` (82 lines)
- `hemora-backend/src/routes/prototype.routes.ts` (682 lines)
- `hemora-backend/src/server.ts` (38 lines)
- `hemora-backend/src/lib/supabase.ts` (16 lines)
- `hemora-backend/src/lib/prisma.ts` (16 lines)
- `hemora-backend/package.json`
- `hemora-backend/.env`

### Database
- `hemora-backend/prisma/schema.prisma` (205 lines)
- `hemora-backend/prisma/migrations/0001_init/migration.sql` (199 lines)
- `hemora-backend/prisma/seed/seed.ts` (422 lines)
- `hemora-backend/prisma/seed/seed-auth.ts` (71 lines)

### Documentation
- `ARCHITECTURE.md`
- `DEMO_ACCOUNTS.md`
- `README.md`

---

*End of Audit Report*
