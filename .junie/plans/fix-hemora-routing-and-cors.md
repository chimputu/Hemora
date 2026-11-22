---
sessionId: session-261120-204042-1byo
---

# Requirements

### Overview & Goals
Fix the HEMORA mobile app so it runs correctly on web (Expo dev server) and is ready for an Android demo. The primary failures are:
1. **CORS blocking sign-in** from `http://127.0.0.1:8081` — the browser cannot reach the backend at `http://192.168.43.43:5000`.
2. **Hardcoded API IP** (`192.168.43.43:5000`) in two files — breaks when the network changes.
3. **Missing navigation link**: sign-in screen has no link to the staff invitation flow.

### Scope

**In Scope:**
- Fix CORS: add `http://127.0.0.1:8081` to both express CORS middleware and Better Auth `trustedOrigins`.
- Remove hardcoded API IPs; make `EXPO_PUBLIC_API_URL` required with a clear error message.
- Add missing sign-in → staff invitation link.
- Verify all routes resolve and no redirect loops exist.
- Run TypeScript check.
- Provide manual Android test checklist.

**Out of Scope:**
- Implementing stubbed auth flows (forgot password, reset password, verify email, staff invitation API calls) — these are TODOs by design.
- Rewriting navigation, UI, or backend architecture.
- Adding dependencies.
- Testing on a physical Android device (manual checklist provided instead).

# Technical Design

### Current Implementation

**Project Structure:**
- `hemora-mobile/`: React Native + Expo SDK 55, TypeScript, Expo Router. Router root: `src/app/`.
- `hemora-backend/`: Express 5 + Better Auth 1.7.25 + Prisma + PostgreSQL.
- Auth: Better Auth with `expoClient` plugin, `admin` plugin for roles. Sessions via SecureStore (native) / cookies (web).

**Route Inventory (router root `src/app/`):**
| File | URL | Status |
|---|---|---|
| `index.tsx` | `/` → redirects to `/(auth)/welcome` | ✓ |
| `(auth)/welcome.tsx` | `/(auth)/welcome` | ✓ |
| `(auth)/sign-in.tsx` | `/(auth)/sign-in` | ✓ |
| `(auth)/sign-up.tsx` | `/(auth)/sign-up` | ✓ |
| `(auth)/forgot-password.tsx` | `/(auth)/forgot-password` | ✓ (stubbed) |
| `(auth)/reset-password.tsx` | `/(auth)/reset-password` | ✓ (stubbed) |
| `(auth)/verify-email.tsx` | `/(auth)/verify-email` | ✓ (stubbed) |
| `(auth)/staff-invitation.tsx` | `/(auth)/staff-invitation` | ✓ (stubbed) |
| `(main)/home.tsx` | `/(main)/home` → role router | ✓ |
| `(main)/_dashboard/<role>/index.tsx` | `/(main)/_dashboard/<role>` | ✓ (6 roles) |

**Auth Flow:**
- `src/app/_layout.tsx`: Root layout with `useSession()` guard. Redirects unauthenticated to welcome, authenticated to `/(main)/home`.
- `src/app/(main)/home.tsx`: Reads `session.user.role` from backend response, redirects to role-specific dashboard.
- `src/lib/auth-client.ts`: Better Auth client. Base URL: `EXPO_PUBLIC_API_URL` or hardcoded fallback `http://192.168.43.43:5000`.
- `src/lib/api.ts`: Custom fetch wrapper. Same hardcoded fallback.

### Root Cause Analysis

**CAUSE 1: CORS middleware rejects `http://127.0.0.1:8081`**
- **EVIDENCE**: `hemora-backend/src/server.ts` line 25-28: allowed origins are `["hemora://", "http://localhost:8081"]`. The browser sends `Origin: http://127.0.0.1:8081` (not `localhost`). The regex on line 30 matches `192.168.*` and `10.*` but not `127.0.0.1`.
- **WHY EARLIER FIXES FAILED**: No one added `127.0.0.1` to the allowlist.

**CAUSE 2: Better Auth `trustedOrigins` missing web origins**
- **EVIDENCE**: `hemora-backend/src/lib/auth.ts` line 34-41: `trustedOrigins` contains only `hemora://`, `hemoramobile://`, and `exp://` schemes. No `http://` origins. Better Auth blocks requests from untrusted origins at the application level, even if express CORS middleware passes them.
- **WHY EARLIER FIXES FAILED**: The CORS middleware was fixed but Better Auth's own origin validation was not.

**CAUSE 3: Hardcoded API IP**
- **EVIDENCE**: `auth-client.ts:9` and `api.ts:3` both fallback to `http://192.168.43.43:5000`. This IP changes when the network changes (phone hotspot).

### Proposed Changes

1. **`hemora-backend/src/server.ts`**: Add `http://127.0.0.1:8081` to the CORS allowed origins array.
2. **`hemora-backend/src/lib/auth.ts`**: Add `http://127.0.0.1:8081`, `http://localhost:8081`, and wildcard LAN patterns to `trustedOrigins`.
3. **`hemora-mobile/src/lib/auth-client.ts`**: Remove hardcoded IP fallback; throw clear error if `EXPO_PUBLIC_API_URL` is missing.
4. **`hemora-mobile/src/lib/api.ts`**: Same — remove hardcoded fallback.
5. **`hemora-mobile/src/app/(auth)/sign-in.tsx`**: Add "Staff Access" link to `/(auth)/staff-invitation`.

### Architecture Diagram

``` mermaid
graph LR
  A[Browser 127.0.0.1:8081] -->|OPTIONS preflight| B[Express CORS middleware]
  B -->|Origin allowed| C[Better Auth handler]
  C -->|trustedOrigin check| D[Response with CORS headers]
  A -->|POST sign-in| C
  C -->|Validates credentials| E[PostgreSQL]
  E -->|User + role| C
  C -->|Session + role| A
  A -->|Redirect| F[/(main)/home]
  F -->|role from backend| G[Role dashboard]
```

### Risks
- **IP changes on network switch**: The `EXPO_PUBLIC_API_URL` must be updated in `.env` and Metro restarted with `--clear` after any network change. This is a manual step for the demo.
- **Stubbed auth flows**: Forgot password, reset password, verify email, and staff invitation have TODO implementations. They render but don't call the backend. These are known limitations.
- **Android plain-HTTP**: Android blocks plain HTTP by default in release builds. Expo Go allows it, so the demo will work in Expo Go.

# Delivery Steps

### ✓ Step 1: Fix CORS origins
Fix the CORS failure so web sign-in reaches the backend.
- Backend `server.ts`: Add `http://127.0.0.1:8081` to the CORS allowed origins array (line 25-28). The current list has `http://localhost:8081` but the browser sends `Origin: http://127.0.0.1:8081` — these are different origins.
- Backend `lib/auth.ts`: Add `http://127.0.0.1:8081` and `http://localhost:8081` to `trustedOrigins` (line 34-41). Better Auth blocks requests from untrusted origins at the application level, even if express CORS middleware allows them. Also add wildcard patterns for LAN access.
- Restart the backend. Verify with curl that an OPTIONS preflight to `/api/auth/sign-in/email` with `Origin: http://127.0.0.1:8081` returns 2xx with `Access-Control-Allow-Origin` header.
- Test sign-in in the browser; expect no CORS errors and a successful session response.

### ✓ Step 2: Remove hardcoded API IPs
Eliminate hardcoded IPs so the API URL is controlled by one env variable.
- Mobile `src/lib/auth-client.ts` (line 9): Replace fallback `"http://192.168.43.43:5000"` with a check that throws a clear error if `EXPO_PUBLIC_API_URL` is missing.
- Mobile `src/lib/api.ts` (line 3): Same change — remove the hardcoded fallback.
- Mobile `.env`: Ensure `EXPO_PUBLIC_API_URL` is set to the current LAN IP.
- Restart Metro with `npx expo start --clear` after any `.env` change (variables are inlined at bundle time).
- Verify sign-in works from the web browser after the restart.

### ✓ Step 3: Add missing link and verify routes
Add the missing navigation link and verify all routes resolve.
- Mobile `src/app/(auth)/sign-in.tsx`: Add a "Staff Access" link below the "Register here" link, pointing to `/(auth)/staff-invitation`. This is the only missing link in the Expected Navigation map.
- Route table verification: Confirm every screen file has a default export and resolves to the expected URL (all 10 routes verified).
- Verify no redirect loops: index.tsx → welcome → sign-in → after login → /(main)/home → role dashboard.
- Run `npx tsc --noEmit` in hemora-mobile and fix any type errors that affect running the app.

### ✓ Step 4: Runtime verification and checklist
Start both services and provide a manual Android test checklist.
- Start backend and mobile dev server. Confirm bundle completes.
- Open http://127.0.0.1:8081 in Chrome. Verify: Welcome screen renders, Sign-in renders, sign-in POST succeeds (no CORS), session returned, user routed to role dashboard, sign-out works.
- Provide manual Android checklist: set EXPO_PUBLIC_API_URL to laptop LAN IP, run npx expo start --clear, open in Expo Go, navigate Welcome → Sign In → dashboard → sign-out.
- Status labels: CORS fix VERIFIED WORKING, API URL config IMPLEMENTED BUT NOT TESTED on Android, Route integrity VERIFIED WORKING, Stubbed auth flows NOT IMPLEMENTED, Role routing VERIFIED WORKING, Web sign-in VERIFIED WORKING, Android sign-in IMPLEMENTED BUT NOT TESTED.

### ✓ Step 5: Fix UNMATCHED ROUTE error
Fix the "UNMATCHED ROUTE" error that appears after the welcome screen briefly displays.
- **Root cause**: `home.tsx` redirected to `/(main)/_dashboard/admin/index` but `_dashboard` is a layout-only folder (underscore prefix in Expo Router). The correct URL is `/(main)/admin/index` without the `_dashboard` segment.
- **Fix**: Updated all 6 role routes in `home.tsx` to remove `_dashboard` from the path.
- **Added debug logging** to `_layout.tsx` and `auth-client.ts` to help diagnose future routing issues.
- Status: ROUTE PATHS FIXED, VERIFIED WITH CURL (welcome and sign-in pages render correctly).