---
sessionId: session-261121-210611-1i4l
---

# Requirements

### Overview & Goals
The HEMORA mobile app displays "Something went wrong / Unauthorized: Invalid or expired token" on the dashboard. The previous session implemented token refresh logic, but the `fetchUserRole()` function still uses raw Supabase session tokens instead of going through `getAccessToken()`, meaning role lookups can fail with expired tokens even though data fetches through `hemoraFetch()` have 401 retry protection.

### Scope

**In Scope:**
- Fix `fetchUserRole()` to use `getAccessToken()` instead of raw session tokens
- Verify the complete auth flow end-to-end
- Ensure all 5 roles (DONOR, NURSE, DOCTOR, MANAGER, ADMIN) work correctly
- Verify session persistence across app restarts

**Out of Scope:**
- Migrating to a different auth system
- Modifying production database records
- Changing the RBAC permission model
- Adding new features

### User Stories
- As a logged-in user, I want the dashboard to load without auth errors so I can use the app.
- As a returning user, I want my session to persist after restarting the app.
- As an admin, I want to access admin-only features without auth errors.

# Technical Design

### Current Implementation

**Auth Flow (after previous fixes):**
```
App starts → useSession() → refreshSession() on load → sets valid session
Dashboard mounts → hemoraFetch('/api/hemora/me') → getAccessToken() → checks expiry → refreshes if needed
If 401 → hemoraFetch retries once with refreshed token
```

**Role Fetch Flow (still broken):**
```
_index.tsx or _layout.tsx → fetchUserRole() → supabase.auth.getSession() → raw access_token
→ fetch('/api/hemora/role', { Authorization: Bearer <raw token> })
→ If token is expired, backend returns 401 → falls back to "DONOR" silently
```

**Backend JWT Verification (`jwt-verify.ts`):**
- Fetches Supabase JWKs from `/.well-known/jwks.json` (cached 1 hour)
- Verifies JWT signature using `jose` library
- Looks up user in DB by `payload.sub` (Supabase Auth UUID)
- User cache with 5-minute TTL

**RBAC Middleware (`rbac.middleware.ts`):**
- `requireAuth()`: Verifies JWT, sets `req.user`, returns 401 on failure
- `requirePermission()`: Same as above + checks role permissions

**Key Files:**
- `hemora-mobile/src/lib/auth-client.ts` — Supabase auth client, session hook, token management
- `hemora-mobile/src/lib/api.ts` — `hemoraFetch()` with 401 retry
- `hemora-mobile/src/lib/supabase.ts` — Supabase client config (`autoRefreshToken: true`, `persistSession: true`)
- `hemora-mobile/src/app/_layout.tsx` — Root layout with auth guards and role-based routing
- `hemora-mobile/src/app/index.tsx` — Splash screen with redirect logic
- `hemora-backend/src/lib/jwt-verify.ts` — Backend JWT verification via Supabase JWKs
- `hemora-backend/src/middleware/rbac.middleware.ts` — Auth and permission middleware
- `hemora-backend/src/lib/permissions.ts` — Role permission definitions
- `hemora-backend/src/routes/prototype.routes.ts` — All API endpoints

### Key Decisions
- **No new auth system**: Working exclusively with existing Supabase Auth
- **No SecureStore migration**: Supabase AsyncStorage persistence is sufficient
- **Single refresh attempt**: On 401, retry once; if it fails again, session is invalid
- **Role must come from backend**: Client-side role values are never trusted for authorization

### Proposed Changes

#### 1. Fix `fetchUserRole()` to use `getAccessToken()`
The `fetchUserRole()` function in `auth-client.ts` currently gets the access token directly from `supabase.auth.getSession()` and sends it via raw `fetch()`. This bypasses the token expiry check and refresh logic in `getAccessToken()`.

**Change:** Replace the raw `fetch()` in `fetchUserRole()` with `hemoraFetch()` so it benefits from the same 401 retry logic as all other API calls. Since `hemoraFetch()` is in `api.ts` and `fetchUserRole()` is in `auth-client.ts`, we need to avoid circular imports. The solution: use `getAccessToken()` instead of raw session tokens, and keep using raw `fetch()` but with the refreshed token.

#### 2. Verify the complete auth flow
After fixing `fetchUserRole()`, verify:
- Fresh login works for all roles
- Dashboard loads without errors
- Session persists after app restart
- Expired tokens are refreshed automatically
- Logout clears session properly

### File Changes
| File | Change |
|------|--------|
| `hemora-mobile/src/lib/auth-client.ts` | Fix `fetchUserRole()` to use `getAccessToken()` instead of raw session token |

# Delivery Steps

### ✓ Step 1: Fix token refresh in auth-client.ts (Previous Session)
Update `getAccessToken()` and `useSession()` to refresh expired tokens before using them.
- Added `refreshSession()` helper that calls `supabase.auth.refreshSession()` and returns the new session
- Added `isTokenExpiredOrSoon()` to decode JWT and check expiration with 60-second grace period
- Replaced `getAccessToken()` to refresh when the stored token is expired or about to expire
- Updated `useSession()` to attempt a session refresh on initial load if a stored session exists
- `signOut()` already clears the role cache properly

### ✓ Step 2: Add 401 retry logic to hemoraFetch in api.ts (Previous Session)
Handle 401 responses by refreshing the session and retrying the request once.
- Extracted `doFetch()` helper for reusable fetch logic
- When `hemoraFetch()` receives a 401 response, calls `refreshSession()` and retries once
- If the retry also returns 401, throws an error to signal the session is truly invalid
- Single retry attempt prevents infinite loops and race conditions

### ✓ Step 3: Fix fetchUserRole to use getAccessToken
`fetchUserRole()` must use the same token refresh path as `hemoraFetch()` so role lookups don't fail with expired tokens.
- Replace `supabase.auth.getSession()` + raw `fetch()` in `fetchUserRole()` with a call to `getAccessToken()` to get a fresh token
- Keep using raw `fetch()` to avoid circular imports with `api.ts`
- Ensure the fallback to "DONOR" only happens when the backend is truly unreachable, not when the token is expired

### ✓ Step 4: Verify end-to-end auth flow and all roles
Test the complete authentication flow to ensure all fixes work together.
- TypeScript compilation passes for both mobile and backend with zero errors
- Verified login flow: sign in → fetchUserRole() uses getAccessToken() → role fetch → dashboard redirect
- Verified session persistence: useSession() refreshes on initial load if stored session exists
- Verified all 5 roles (DONOR, NURSE, DOCTOR, MANAGER, ADMIN) have correct dashboard routes in sign-in.tsx, _layout.tsx, and index.tsx
- Verified logout clears role cache via clearRoleCache() in signOut()
- Verified hemoraFetch() 401 retry logic refreshes session and retries once before throwing
- Verified backend JWT verification uses Supabase JWKs, not hardcoded secrets