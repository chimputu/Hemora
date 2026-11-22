# Hemora Backend Integration Diagnostic Report

**Generated:** 2026-11-22
**App:** Hemora — Blood Donation Platform (Zambia)
**Frontend:** React Native, Expo SDK 55.0.32, TypeScript, Expo Router 55.0.18, NativeWind
**Backend:** Express.js, Prisma ORM, PostgreSQL
**AI Service:** Python FastAPI (secondary, out of scope for auth)

---

## 1. NETWORK REACHABILITY TEST

### Environment Summary

| Parameter | Value |
|---|---|
| API base URL (mobile `.env`) | `http://192.168.43.43:5000` |
| Backend port | `5000` (from `hemora-backend/.env` → `PORT=5000`) |
| FastAPI port | `8000` (from `hemora-backend/.env` → `AI_SERVICE_URL=http://localhost:8000`) |
| Base URL configured in | `hemora-mobile/.env` → `EXPO_PUBLIC_API_URL` |
| Where consumed | `src/lib/api.ts` line 4, `src/lib/auth-client.ts` line 16 |
| Dev machine OS | Linux (Ubuntu/Debian) |
| Phone & dev machine same Wi-Fi | **Must verify** — the IP `192.168.43.43` suggests a mobile hotspot or router LAN |

### 1a. Dev Machine → Backend

```bash
# Test 1: TCP connectivity to port 5000
nc -zv 127.0.0.1 5000

# Expected (reachable): Connection to 127.0.0.1 5000 port [tcp/*] succeeded!
# ECONNREFUSED: Backend is not running
# Timeout: Firewall blocking port 5000

# Test 2: HTTP health check
curl -s http://127.0.0.1:5000/health
# Expected: {"status":"ok","service":"hemora-backend"}

# Test 3: Also test the LAN IP (same IP the phone would use)
curl -s http://192.168.43.43:5000/health
# Expected: {"status":"ok","service":"hemora-backend"}
# If this fails but 127.0.0.1 works: backend is bound to 127.0.0.1 instead of 0.0.0.0
```

**Note:** The backend binds to `0.0.0.0` (server.ts line 82), so it should be reachable from both localhost and LAN IP.

### 1b. Device → Backend

The correct target depends on the device type:

| Device Type | Use This Address | Why |
|---|---|---|
| **Android emulator** | `http://10.0.2.2:5000` | Special alias — `10.0.2.2` maps to host machine's localhost |
| **iOS simulator** | `http://localhost:5000` | Runs on the Mac, shares its network namespace |
| **Physical Android device** | `http://<your-LAN-IP>:5000` | Must use the dev machine's LAN IP (e.g., `192.168.43.43`) |
| **Physical iOS device** | `http://<your-LAN-IP>:5000` | Must use the dev machine's LAN IP |

**For physical Android device (most likely scenario):**

```bash
# From adb shell on the physical device:
adb shell ping -c 3 192.168.43.43
# Expected: 3 replies received (reachable)
# No reply: Phone and dev machine not on same network

adb shell curl -s http://192.168.43.43:5000/health
# Expected: {"status":"ok","service":"hemora-backend"}
# curl not available on shell? Use:
adb shell nc -zv 192.168.43.43 5000
# Expected: Connection to 192.168.43.43 5000 port [tcp/*] succeeded!
```

**Common failures and their meaning:**

| Symptom | Cause |
|---|---|
| `ECONNREFUSED` | Backend not running, or bound to `127.0.0.1` instead of `0.0.0.0` |
| Timeout / no response | Wrong IP, phone on different Wi-Fi, firewall blocking port 5000 |
| `Network request failed` (Metro log) | Same as above — React Native's fetch cannot resolve the address |
| Works from dev machine but not phone | Phone not on same LAN, or phone is on cellular data |

### 1c. Critical Finding — Hardcoded LAN IP

**File:** `hemora-mobile/.env` line 4
```
EXPO_PUBLIC_API_URL="http://192.168.43.43:5000"
```

This IP (`192.168.43.43`) is a **dynamic LAN IP**. If your dev machine gets a different IP (reboot, different Wi-Fi network, DHCP lease expiry), the app will silently fail to reach the backend. The `.env` file comments acknowledge this but the value is still hardcoded.

---

## 2. CONFIG AUDIT CHECKLIST

### Where a base URL, port, or API constant could hide in this Expo SDK 55 app:

| Location | File | How to Check | Would Break On |
|---|---|---|---|
| **`.env` file** | `hemora-mobile/.env` | `grep -r "EXPO_PUBLIC_API_URL" hemora-mobile/.env` | All devices if IP changes |
| **`app.json` / `app.config.ts`** | `hemora-mobile/app.json` | `grep -r "apiUrl\|api.*url\|API" hemora-mobile/app.json` | All devices if extra.apiUrl is wrong |
| **`app.config.js` / `app.config.ts`** | Not present | `ls hemora-mobile/app.config.*` | N/A — not used |
| **Hardcoded in source** | Any `.ts`/`.tsx` | `grep -rn "http://\|https://" hemora-mobile/src/ --include="*.ts" --include="*.tsx"` | All devices |
| **Constants file** | `hemora-mobile/src/constants/` | `grep -rn "api\|API\|url\|URL\|port\|PORT" hemora-mobile/src/constants/` | All devices |
| **Services directory** | Not present | `ls hemora-mobile/src/services/` | N/A |
| **`.env.local`** | May exist | `cat hemora-mobile/.env.local 2>/dev/null` | All devices if it overrides `.env` |
| **EAS build env vars** | `eas.json` | `cat hemora-mobile/eas.json` | Production builds only |

### Actual grep commands to run:

```bash
# 1. Find all EXPO_PUBLIC_API_URL references
grep -rn "EXPO_PUBLIC_API_URL" hemora-mobile/src/ --include="*.ts" --include="*.tsx"

# Result: 2 hits — src/lib/api.ts:4, src/lib/auth-client.ts:16

# 2. Find all hardcoded HTTP URLs in source
grep -rn "http://" hemora-mobile/src/ --include="*.ts" --include="*.tsx"

# 3. Find all port numbers in source
grep -rn ":[0-9]\{3,\}" hemora-mobile/src/ --include="*.ts" --include="*.tsx"

# 4. Check app.json for extra.apiUrl
grep -n "apiUrl\|api" hemora-mobile/app.json

# 5. Check for .env.local override
cat hemora-mobile/.env.local 2>/dev/null || echo "No .env.local"

# 6. Check eas.json for environment variables
cat hemora-mobile/eas.json
```

### Audit Results

| Check | Result | Risk |
|---|---|---|
| `EXPO_PUBLIC_API_URL` in `.env` | `http://192.168.43.43:5000` | **HIGH** — hardcoded LAN IP |
| `EXPO_PUBLIC_API_URL` consumed in source | 2 files: `api.ts`, `auth-client.ts` | Low — both use the same env var |
| Hardcoded HTTP URLs in source | None found (all use `API_BASE` from env) | Low |
| `app.json` extra.apiUrl | Not set | Low — relies on `.env` |
| `.env.local` override | Must verify | Medium if it exists with different IP |
| `eas.json` env vars | No env vars configured | Medium for production builds |

---

## 3. ENDPOINT CONTRACT TEST (Auth First)

### 3.1. POST /api/auth/register (Sign Up)

**Mobile app sends** (`auth-client.ts` lines 182-226):
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "bloodGroup": "O_POS"
}
```

**Backend expects** (`auth.routes.ts` lines 28-106):
```typescript
const { email, password, name, bloodGroup } = req.body;
```

**✅ Contract MATCH** — field names and types align perfectly.

**Curl test:**
```bash
curl -s -X POST http://192.168.43.43:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User","bloodGroup":"O_POS"}' | python3 -m json.tool
```

**Expected 201 response:**
```json
{
  "user": {
    "id": "uuid-string",
    "email": "test@example.com",
    "name": "Test User",
    "role": "DONOR",
    "bloodGroup": "O_POS",
    "phone": null,
    "eligible": true,
    "facilityId": null,
    "emailVerified": false
  },
  "access_token": "eyJhbGci...",
  "refresh_token": "long-random-string"
}
```

**Expected 409 response (duplicate email):**
```json
{ "error": "An account with this email already exists" }
```

### 3.2. POST /api/auth/login

**Mobile app sends** (`auth-client.ts` lines 149-177):
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Backend expects** (`auth.routes.ts` lines 109-163):
```typescript
const { email, password } = req.body;
```

**✅ Contract MATCH** — field names and types align perfectly.

**Curl test:**
```bash
curl -s -X POST http://192.168.43.43:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' | python3 -m json.tool
```

**Expected 200 response:**
```json
{
  "user": {
    "id": "uuid-string",
    "email": "test@example.com",
    "name": "Test User",
    "role": "DONOR",
    "bloodGroup": "O_POS",
    "phone": null,
    "eligible": true,
    "facilityId": null,
    "emailVerified": false
  },
  "access_token": "eyJhbGci...",
  "refresh_token": "long-random-string"
}
```

**Expected 401 response (wrong credentials):**
```json
{ "error": "Invalid email or password" }
```

### 3.3. POST /api/auth/refresh

**Mobile app sends** (`auth-client.ts` lines 100-142):
```json
{
  "refresh_token": "long-random-string"
}
```

**Backend expects** (`auth.routes.ts` lines 185-231):
```typescript
const { refresh_token } = req.body;
```

**✅ Contract MATCH** — field name `refresh_token` matches exactly.

**Curl test:**
```bash
curl -s -X POST http://192.168.43.43:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"YOUR_REFRESH_TOKEN"}' | python3 -m json.tool
```

**Expected 200 response:**
```json
{
  "access_token": "eyJhbGci...",
  "refresh_token": "new-long-random-string"
}
```

### 3.4. POST /api/auth/logout

**Mobile app sends** (`auth-client.ts` lines 231-249):
```json
{
  "refresh_token": "long-random-string"
}
```

**Backend expects** (`auth.routes.ts` lines 166-182):
```typescript
const { refresh_token } = req.body;
```

**✅ Contract MATCH.**

**Curl test:**
```bash
curl -s -X POST http://192.168.43.43:5000/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"YOUR_REFRESH_TOKEN"}' | python3 -m json.tool
```

**Expected 200 response:**
```json
{ "success": true }
```

### 3.5. POST /api/auth/forgot-password

**Mobile app sends** (`auth-client.ts` lines 254-265):
```json
{ "email": "user@example.com" }
```

**Backend expects** (`auth.routes.ts` lines 234-285):
```typescript
const { email } = req.body;
```

**✅ Contract MATCH.**

### 3.6. POST /api/auth/reset-password

**Mobile app sends** (`auth-client.ts` lines 270-289):
```json
{ "token": "reset-token-hex", "new_password": "newpassword123" }
```

**Backend expects** (`auth.routes.ts` lines 288-334):
```typescript
const { token, new_password } = req.body;
```

**✅ Contract MATCH.**

### 3.7. POST /api/auth/google/verify

**Mobile app sends** (`auth-client.ts` lines 496-509):
```json
{ "id_token": "google-id-token-jwt" }
```

**Backend expects** (`google-auth.routes.ts` — assumed):
```typescript
const { id_token } = req.body;
```

**Curl test (requires a real Google ID token):**
```bash
curl -s -X POST http://192.168.43.43:5000/api/auth/google/verify \
  -H "Content-Type: application/json" \
  -d '{"id_token":"GOOGLE_ID_TOKEN"}' | python3 -m json.tool
```

### 3.8. GET /api/hemora/role (Protected)

**Mobile app sends** (`auth-client.ts` lines 47-53):
```
GET /api/hemora/role
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Expected 200 response:**
```json
{ "role": "DONOR" }
```

### 3.9. GET /api/auth/me (Protected)

**Backend expects** (`auth.routes.ts` lines 374-416):
```
GET /api/auth/me
Authorization: Bearer <access_token>
```

**Expected 200 response:**
```json
{
  "user": {
    "id": "uuid-string",
    "email": "user@example.com",
    "name": "User Name",
    "role": "DONOR",
    "bloodGroup": "O_POS",
    "phone": null,
    "eligible": true,
    "facilityId": null,
    "emailVerified": false
  }
}
```

### 3.10. Common Mismatch Checklist

| Mismatch Type | Status | Details |
|---|---|---|
| Field name mismatch (email vs username) | ✅ **No issue** | Both sides use `email` |
| Body not JSON-stringified | ✅ **No issue** | App uses `JSON.stringify()` |
| Missing Content-Type header | ✅ **No issue** | App sets `"Content-Type": "application/json"` |
| Authorization header format | ✅ **No issue** | App uses `Bearer <token>`, backend splits on `" "` |
| Trailing slash mismatch | ✅ **No issue** | Both use no trailing slash |
| HTTP vs HTTPS | ⚠️ **Dev only** | Both use HTTP — fine for dev, needs HTTPS for production |
| CORS for native RN | ✅ **Not applicable** | CORS does NOT apply to native React Native — only to web |
| CORS for Expo web | ✅ **Configured** | Backend allows `localhost:8081` and LAN IPs on port 8081 |

---

## 4. AUTH FLOW END-TO-END

### Step 1: Sign Up

| Aspect | Details |
|---|---|
| **Network call** | `POST http://192.168.43.43:5000/api/auth/register` |
| **Headers** | `Content-Type: application/json` |
| **Body** | `{"email":"user@example.com","password":"password123","name":"John Doe","bloodGroup":"O_POS"}` |
| **Expected response** | `201 Created` with `{user, access_token, refresh_token}` |
| **Client-side effect** | `saveSession()` writes 3 keys to SecureStore: `hemora-access-token`, `hemora-refresh-token`, `hemora-user` |
| **Navigation** | `router.replace("/")` — redirects to home |
| **Most common failure** | Backend unreachable → `Network request failed` in Metro log. Confirm with `curl` to the same URL. |

### Step 2: Login

| Aspect | Details |
|---|---|
| **Network call** | `POST http://192.168.43.43:5000/api/auth/login` |
| **Headers** | `Content-Type: application/json` |
| **Body** | `{"email":"user@example.com","password":"password123"}` |
| **Expected response** | `200 OK` with `{user, access_token, refresh_token}` |
| **Client-side effect** | `saveSession()` overwrites the 3 SecureStore keys |
| **Navigation** | `router.replace("/")` — redirects to home |
| **Most common failure** | Wrong credentials → `401` → generic alert "Invalid email or password". Backend unreachable → `Network request failed`. |

### Step 3: Token Storage

| Aspect | Details |
|---|---|
| **Storage mechanism** | `expo-secure-store` (native) / `localStorage` (web) |
| **Keys** | `hemora-access-token`, `hemora-refresh-token`, `hemora-user` |
| **User data format** | `JSON.stringify({id, email, role})` |
| **Most common failure** | SecureStore unavailable on emulator without hardware-backed keystore → silent failure (catch block swallows error). Token appears saved but is not persisted. |

### Step 4: Attach Token to Subsequent Requests

| Aspect | Details |
|---|---|
| **Mechanism** | `hemoraFetch()` in `api.ts` calls `getAccessToken()` → attaches `Authorization: Bearer <token>` |
| **Auto-refresh** | If `401` received, calls `POST /api/auth/refresh` with stored refresh token, retries once |
| **Most common failure** | Token expired + refresh token also expired/revoked → `clearSession()` → user logged out silently |

### Step 5: Token Refresh

| Aspect | Details |
|---|---|
| **Network call** | `POST http://192.168.43.43:5000/api/auth/refresh` |
| **Body** | `{"refresh_token":"..."}` |
| **Expected response** | `200 OK` with `{access_token, refresh_token}` (rotated) |
| **Client-side effect** | `updateAccessToken()` and `updateRefreshToken()` update SecureStore |
| **Most common failure** | Refresh token reused (security revocation) → `401` "Session invalidated due to security concern" |

### Step 6: Logout

| Aspect | Details |
|---|---|
| **Network call** | `POST http://192.168.43.43:5000/api/auth/logout` |
| **Body** | `{"refresh_token":"..."}` |
| **Expected response** | `200 OK` with `{success: true}` |
| **Client-side effect** | `clearSession()` deletes all 3 SecureStore keys, `clearRoleCache()` resets role |
| **Most common failure** | Server unreachable → local data still cleared (graceful degradation) |

### Step 7: Role Fetch (Post-Login)

| Aspect | Details |
|---|---|
| **Network call** | `GET http://192.168.43.43:5000/api/hemora/role` |
| **Headers** | `Authorization: Bearer <token>` |
| **Expected response** | `200 OK` with `{"role":"DONOR"}` |
| **Client-side effect** | `cachedRole` set in module-level variable, used by root layout redirect |
| **Most common failure** | Backend unreachable → falls back to `"DONOR"` silently. **This masks the real issue.** |

### Full Curl Sequence (Backend-Only Validation)

```bash
#!/bin/bash
# Full auth flow test — run from dev machine

API="http://192.168.43.43:5000"

echo "=== Step 1: Health Check ==="
curl -s "$API/health" | python3 -m json.tool
echo ""

echo "=== Step 2: Register ==="
REGISTER_RESPONSE=$(curl -s -X POST "$API/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"diagnostic@test.com","password":"TestPass123","name":"Diagnostic User","bloodGroup":"O_POS"}')
echo "$REGISTER_RESPONSE" | python3 -m json.tool
echo ""

# Extract tokens
ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
REFRESH_TOKEN=$(echo "$REGISTER_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['refresh_token'])")
echo "Access token: ${ACCESS_TOKEN:0:20}..."
echo "Refresh token: ${REFRESH_TOKEN:0:20}..."
echo ""

echo "=== Step 3: Login ==="
LOGIN_RESPONSE=$(curl -s -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"diagnostic@test.com","password":"TestPass123"}')
echo "$LOGIN_RESPONSE" | python3 -m json.tool
echo ""

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['refresh_token'])")

echo "=== Step 4: Get /me (protected) ==="
curl -s "$API/api/auth/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | python3 -m json.tool
echo ""

echo "=== Step 5: Get role (protected) ==="
curl -s "$API/api/hemora/role" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | python3 -m json.tool
echo ""

echo "=== Step 6: Refresh token ==="
REFRESH_RESPONSE=$(curl -s -X POST "$API/api/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}")
echo "$REFRESH_RESPONSE" | python3 -m json.tool
echo ""

NEW_REFRESH_TOKEN=$(echo "$REFRESH_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['refresh_token'])")

echo "=== Step 7: Logout (revoke refresh token) ==="
curl -s -X POST "$API/api/auth/logout" \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$NEW_REFRESH_TOKEN\"}" | python3 -m json.tool
echo ""

echo "=== Step 8: Try refresh after logout (should fail) ==="
curl -s -X POST "$API/api/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$NEW_REFRESH_TOKEN\"}" | python3 -m json.tool
echo ""

echo "=== Done ==="
```

---

## 5. DEVICE / BUILD SPECIFICS

### What Will and Won't Fix Connectivity Issues

| Action | Fixes Network Config? | Why |
|---|---|---|
| **Restarting Metro** | ❌ No | Metro is the bundler, not the network layer. Restarting it does not change `EXPO_PUBLIC_API_URL`. |
| **`npx expo start -c`** (clear cache) | ⚠️ Partially | Clears Metro's bundler cache and forces a fresh build of JS bundle. If the `.env` file was recently changed, this **will** pick up the new value because Metro re-reads env vars. But it does NOT fix a wrong IP. |
| **Reloading app in Expo Go** | ⚠️ Partially | Reloads the JS bundle. If `.env` changed and Metro re-bundled, the new URL will be used. But Expo Go **cannot** use `expo-secure-store` reliably — see below. |
| **Rebuilding dev client** (`expo run:android`) | ✅ Yes | Produces a new APK with the current `.env` values baked in (if using config plugins). This is the correct way to test with `expo-secure-store`. |
| **Reinstalling the APK** | ✅ Yes | Same as rebuild — fresh install with current config. |

### Critical: Expo Go vs Custom Dev Client

**This app uses `expo-secure-store` as a config plugin** (`app.json` line 46). This means:

- **Expo Go CANNOT test this app's networking correctly** if the app relies on SecureStore behavior.
- Expo Go does not include custom config plugins. The `expo-secure-store` plugin modifies the native Android/iOS project to enable the keystore/keychain integration.
- **You MUST use a custom dev client** (`expo run:android` or EAS dev build) to test auth flow end-to-end.
- If you're using Expo Go right now, the `saveSession()` calls may silently fail (the catch block on line 52 of `auth-storage.ts` swallows the error), meaning tokens are never actually stored.

### How to Confirm You're Using the Right Build

```bash
# Check if you have a custom dev client built
ls hemora-mobile/android/app/build/outputs/apk/

# If empty or missing, you need to build:
cd hemora-mobile && expo run:android

# Or check what "npx expo start" offers:
npx expo start
# If it says "Q" for Expo Go and "R" for dev client, you need "R"
```

---

## 6. TOKEN HANDLING DIAGNOSTIC

### 6.1. Is the token actually written after a 200?

**File:** `auth-storage.ts` lines 33-54

The `saveSession()` function writes three keys to SecureStore. On failure, it **silently swallows the error** (line 52: `catch { /* SecureStore unavailable — silently fail */ }`).

**Check:** Add a temporary log statement:
```typescript
// In auth-storage.ts, inside saveSession():
await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.accessToken);
console.log("[auth-storage] Access token written to SecureStore");  // ADD THIS
```

**Alternative check without code change:** After login, add a log in `sign-in.tsx` after `signIn()`:
```typescript
await signIn(email.trim().toLowerCase(), password);
const stored = await import("../../lib/auth-storage").then(m => m.loadSession());
console.log("[sign-in] Session after login:", stored ? "STORED" : "NOT STORED");
```

### 6.2. Is it read on app start before the first protected request?

**File:** `auth-client.ts` lines 319-385 (`useSession` hook)

The `useSession` hook calls `loadSession()` on mount (line 367). This reads from SecureStore. If SecureStore is unavailable (Expo Go), `loadSession()` returns `null` → user appears logged out.

**Check:** Look for this log in Metro output on app start:
```
[auth-storage] Session loaded: true/false
```
(Add it to `loadSession()` if not present.)

### 6.3. Is the Authorization header being attached?

**File:** `api.ts` lines 21-27

The `doFetch()` function attaches the header:
```typescript
headers: {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
},
```

**Check:** Add a log in `doFetch()`:
```typescript
console.log("[api] Request to", path, "with token:", token ? token.slice(0, 20) + "..." : "NONE");
```

### 6.4. Is the auth context/provider re-rendering after login?

**File:** `auth-client.ts` lines 319-385

The `useSession` hook uses `useState` for `sessionData`. After `signIn()` calls `saveSession()`, the `refetchTrigger` mechanism in `_layout.tsx` (lines 41-53) detects navigation away from auth group and increments `refetchTrigger`, which triggers `loadSessionData()` again.

**⚠️ Potential issue:** There is a timing gap between `saveSession()` completing and `refetchTrigger` firing. The sign-in screen's `useSession()` hook (line 28) may not immediately reflect the new session. The `router.replace("/")` call (line 48) happens before the root layout's `useSession` re-checks.

**Check:** Look for this sequence in Metro logs:
```
[RootLayout] Navigation from auth group detected, re-checking session
[RootLayout] segments: (home) > index  isLoggedIn: true
```

### 6.5. Are protected routes guarded by a router redirect that fires before the token loads?

**File:** `_layout.tsx` lines 85-124

**⚠️ RACE CONDITION IDENTIFIED:**

The root layout's redirect logic (line 85-124) depends on two async values:
1. `session` from `useSession()` — loaded from SecureStore on mount
2. `userRole` from `fetchUserRole()` — fetched from backend after session loads

The `useEffect` at line 85 runs whenever `session`, `isPending`, `error`, `segments`, `userRole`, etc. change. The guard `if (isPending) return;` prevents redirect while session is loading. **But `userRole` is NOT gated by `isPending`.**

**Scenario:**
1. App starts → `useSession` loads session from SecureStore → `isPending` becomes `false`
2. `useEffect` fires → `isLoggedIn` is `true` → checks `inAuthGroup` → may redirect
3. `userRole` is still `undefined` because `fetchUserRole()` hasn't resolved
4. `getRouteForRole(undefined)` returns `"/"` — this happens to be correct, but the role-dependent logic is unreliable

**Worse scenario on cold start:**
1. App starts → `isPending` is `true` → redirect blocked ✓
2. `loadSession()` reads SecureStore → finds token → `isPending` becomes `false`
3. `useEffect` fires → `isLoggedIn` is `true` → NOT in auth group, in main group → no redirect ✓
4. BUT: if the user was on a protected route and the token expired, the redirect to `/welcome` won't fire until `hemoraFetch` gets a `401` and calls `clearSession()`

**Check:** Add a log to verify the timing:
```typescript
// In _layout.tsx, inside the useEffect at line 85:
console.log("[RootLayout] isPending:", isPending, "session:", !!session, "userRole:", userRole);
```

---

## 7. FASTAPI (Only If It Blocks Auth)

The AI service is **NOT involved in the auth flow**. It is only used by the backend for secondary features (blood stock prediction, etc.). Auth will work even if the AI service is down.

### Quick Reachability Check

```bash
# From dev machine:
curl -s http://localhost:8000/docs
# Expected: HTML response (Swagger UI) or connection refused if not running

# From backend (to see if backend can reach it):
# Check backend logs for AI service errors:
grep -i "ai.*service\|8000\|fastapi" hemora-backend/logs/*.log 2>/dev/null
```

**Verdict:** AI service is out of scope for auth diagnostics. Skip unless login/signup specifically logs an AI-related error.

---

## 8. PASS / FAIL MATRIX

| # | Check | Command / Action | Expected | Observed | Pass/Fail | Suspected Cause if Fail |
|---|---|---|---|---|---|---|
| 1 | Dev machine → backend reachability | `curl -s http://127.0.0.1:5000/health` | `{"status":"ok","service":"hemora-backend"}` | | | Backend not running |
| 2 | Dev machine → backend via LAN IP | `curl -s http://192.168.43.43:5000/health` | `{"status":"ok","service":"hemora-backend"}` | | | Backend bound to 127.0.0.1 only |
| 3 | Device → backend reachability | `adb shell nc -zv 192.168.43.43 5000` | `Connection succeeded` | | | Different Wi-Fi, wrong IP, firewall |
| 4 | Signup via curl | `curl -s -X POST http://192.168.43.43:5000/api/auth/register -H "Content-Type: application/json" -d '{"email":"t@t.com","password":"pass1234","name":"Test"}'` | `201` with `{user, access_token, refresh_token}` | | | Prisma/DB not running, wrong schema |
| 5 | Login via curl | `curl -s -X POST http://192.168.43.43:5000/api/auth/login -H "Content-Type: application/json" -d '{"email":"t@t.com","password":"pass1234"}'` | `200` with `{user, access_token, refresh_token}` | | | User not created, password hash mismatch |
| 6 | Signup from app | Tap "Sign up" → fill form → submit | Navigates to home screen | | | Network unreachable, SecureStore silent fail |
| 7 | Login from app | Tap "Sign in" → fill form → submit | Navigates to home screen | | | Network unreachable, wrong credentials |
| 8 | Token stored after login | Check Metro log for SecureStore write | Token written to `hemora-access-token` key | | | Expo Go instead of dev client |
| 9 | Token attached to protected request | Make any API call after login | `Authorization: Bearer <token>` in headers | | | `getAccessToken()` returns null |
| 10 | Protected request returns 200 | `hemoraFetch("/api/auth/me")` | `200` with user data | | | Token expired, wrong secret |
| 11 | Role fetch succeeds | `GET /api/hemora/role` with token | `{"role":"DONOR"}` | | | Prototype routes not mounted |
| 12 | Logout clears token | Call `signOut()` → check SecureStore | All 3 keys deleted | | | `clearSession()` not called |
| 13 | App restart preserves session | Kill app → restart → check `useSession` | Session restored from SecureStore | | | SecureStore not persistent on emulator |
| 14 | Token refresh on 401 | Expire token → make API call | Auto-refresh → retry succeeds | | | Refresh token revoked |

---

## 9. RANKED FIX LIST

### 1. Hardcoded LAN IP in `.env` (Probability: 90%)

**Symptom:** Login/signup fails with `Network request failed` or silent timeout on physical device. Works on dev machine.

**Why:** `EXPO_PUBLIC_API_URL="http://192.168.43.43:5000"` in `hemora-mobile/.env` uses a dynamic LAN IP that changes when the dev machine reconnects to Wi-Fi, reboots, or uses a different network.

**Single check:**
```bash
# On dev machine, check current IP:
ip addr show | grep "inet 192"
# Compare with the IP in .env:
grep EXPO_PUBLIC_API_URL hemora-mobile/.env
# If they differ → this is the cause
```

**Smallest fix:** Update `hemora-mobile/.env` with the current LAN IP:
```bash
# Find your IP
ip addr show | grep "inet 192" | head -1 | awk '{print $2}' | cut -d/ -f1

# Update .env with the correct IP
sed -i 's|EXPO_PUBLIC_API_URL="http://192.168.43.43:5000"|EXPO_PUBLIC_API_URL="http://<YOUR-IP>:5000"|' hemora-mobile/.env
```

**Requires rebuild?** No — restart Metro with `npx expo start -c` to pick up the new `.env` value.

---

### 2. Using Expo Go Instead of Custom Dev Client (Probability: 75%)

**Symptom:** Login appears to succeed (no error), but the app redirects back to sign-in immediately. Or protected routes return 401 even though login returned 200.

**Why:** `expo-secure-store` requires a custom dev client. In Expo Go, `SecureStore.setItemAsync()` fails silently (caught at `auth-storage.ts` line 52), so tokens are never persisted. On any navigation or reload, `loadSession()` returns `null` → user appears logged out.

**Single check:**
```bash
# In Metro log, look for:
# "Using Expo Go" → WRONG for this app
# "Using custom dev client" → CORRECT

# Or check the QR code prompt:
# If it offers "E" for Expo Go and "A/W" for Android/iOS dev client,
# you need "A" (Android dev client)
```

**Smallest fix:** Build and run the custom dev client:
```bash
cd hemora-mobile && expo run:android
```

**Requires rebuild?** Yes — `expo run:android` produces a new APK with the `expo-secure-store` plugin applied.

---

### 3. Backend Not Running or Bound to Wrong Interface (Probability: 60%)

**Symptom:** All API calls fail with `Network request failed` from both dev machine and device.

**Why:** The backend process may not be running, or it may be bound to `127.0.0.1` instead of `0.0.0.0`.

**Single check:**
```bash
# Is the backend process running?
ss -tlnp | grep 5000

# Expected output: LISTEN  0  511  0.0.0.0:5000  0.0.0.0:*  pid=node
# If 127.0.0.1:5000 → bound to localhost only (phone can't reach it)
# If no output → not running
```

**Smallest fix:**
```bash
cd hemora-backend && npm run dev
# Or however the backend is started
```

**Requires rebuild?** No.

---

### 4. Phone and Dev Machine on Different Networks (Probability: 40%)

**Symptom:** Backend is running and reachable from dev machine, but device cannot connect. `adb shell nc -zv 192.168.43.43 5000` times out.

**Why:** The phone may be on cellular data, a different Wi-Fi network, or a guest network with AP isolation.

**Single check:**
```bash
# From adb shell, check phone's IP:
adb shell ip route | grep default
# Compare the subnet with the dev machine's IP
# If dev machine is 192.168.43.x and phone is 192.168.1.x → different networks
```

**Smallest fix:** Connect phone to the same Wi-Fi network as the dev machine. Disable cellular data during testing.

**Requires rebuild?** No.

---

### 5. Root Layout Race Condition — Redirect Before Token Loads (Probability: 30%)

**Symptom:** Login succeeds (200 response, token stored), but the app flashes the home screen then immediately redirects back to sign-in/welcome.

**Why:** The root layout's `useEffect` (line 85) may fire with `isPending: false` and `session: null` if `loadSession()` hasn't completed yet. The `userRole` dependency (line 124) can also trigger an extra re-render with `undefined` role before the backend role fetch completes.

**Single check:**
```
Look for this pattern in Metro logs:
[RootLayout] segments: ... isLoggedIn: false  (immediately after login)
[RootLayout] Redirecting unauthenticated user to welcome
```

**Smallest fix:** The current code already has `if (isPending) return;` at line 86, which should prevent this. If the race still occurs, the issue is that `loadSession()` completes with `null` because SecureStore failed (see Fix #2). Fix the SecureStore issue first, then re-test.

**Requires rebuild?** No — code change only, but the root cause is likely Fix #2.

---

## APPENDIX: QUICK DIAGNOSTIC SCRIPT

Run this from your dev machine to check the most common issues:

```bash
#!/bin/bash
echo "========================================="
echo "  Hemora Backend Integration Diagnostic"
echo "========================================="
echo ""

API_IP=$(grep EXPO_PUBLIC_API_URL hemora-mobile/.env | grep -oP 'http://\K[^:]+')
API_PORT=$(grep EXPO_PUBLIC_API_URL hemora-mobile/.env | grep -oP ':\K\d+')
MY_IP=$(ip addr show | grep "inet 192" | head -1 | awk '{print $2}' | cut -d/ -f1)

echo "1. Configuration"
echo "   .env API URL IP: $API_IP"
echo "   .env API port:   $API_PORT"
echo "   Your LAN IP:     $MY_IP"
if [ "$API_IP" = "$MY_IP" ]; then
    echo "   ✅ IP matches your current LAN IP"
else
    echo "   ❌ IP MISMATCH — .env has $API_IP but your IP is $MY_IP"
fi
echo ""

echo "2. Backend Process"
if ss -tlnp 2>/dev/null | grep -q ":$API_PORT "; then
    BIND=$(ss -tlnp | grep ":$API_PORT " | awk '{print $4}' | grep -oP '\d+\.\d+\.\d+\.\d+')
    echo "   ✅ Backend listening on $BIND:$API_PORT"
    if [ "$BIND" = "127.0.0.1" ]; then
        echo "   ⚠️  Bound to localhost only — phone cannot reach it"
    fi
else
    echo "   ❌ Backend NOT running on port $API_PORT"
fi
echo ""

echo "3. Health Check (localhost)"
HEALTH=$(curl -s --max-time 5 "http://127.0.0.1:$API_PORT/health" 2>/dev/null)
if echo "$HEALTH" | grep -q '"ok"'; then
    echo "   ✅ Health check passed: $HEALTH"
else
    echo "   ❌ Health check failed"
fi
echo ""

echo "4. Health Check (LAN IP)"
HEALTH_LAN=$(curl -s --max-time 5 "http://$MY_IP:$API_PORT/health" 2>/dev/null)
if echo "$HEALTH_LAN" | grep -q '"ok"'; then
    echo "   ✅ LAN health check passed"
else
    echo "   ❌ LAN health check failed — phone will not reach backend"
fi
echo ""

echo "5. Auth Endpoints"
for ENDPOINT in "/api/auth/login" "/api/auth/register" "/api/auth/refresh" "/api/auth/logout"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 -X POST "http://127.0.0.1:$API_PORT$ENDPOINT" -H "Content-Type: application/json" -d '{}')
    if [ "$STATUS" = "200" ] || [ "$STATUS" = "400" ] || [ "$STATUS" = "401" ]; then
        echo "   ✅ POST $ENDPOINT → $STATUS (endpoint exists)"
    else
        echo "   ❌ POST $ENDPOINT → $STATUS (unexpected)"
    fi
done
echo ""

echo "6. Database"
cd hemora-backend
if npx prisma db pull --dry-run 2>&1 | grep -q "Already in sync"; then
    echo "   ✅ PostgreSQL reachable and schema in sync"
elif npx prisma db pull --dry-run 2>&1 | grep -q "P1000"; then
    echo "   ❌ Cannot connect to PostgreSQL"
else
    echo "   ⚠️  Could not determine DB status"
fi
echo ""

echo "========================================="
echo "  Diagnostic complete"
echo "========================================="
```
