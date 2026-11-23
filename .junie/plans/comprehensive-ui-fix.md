---
sessionId: session-261122-172243-3cl8
---

# Hemora RBAC Emergency Triage — Implementation Plan

## Implementation Steps

### ✓ Step 1: Role-aware tab visibility and content filtering
Add role-based tab visibility and conditional content rendering in the home dashboard.

### ✓ Step 2: Create admin screens
Create 5 admin screens: users, forecast, campaigns, facilities, system.

### ✓ Step 3: Update drawer navigation for ADMIN
Change ADMIN drawer items to navigate to actual screens instead of switching tabs.

### ✓ Step 4: Add route guards in root layout
Prevent non-ADMIN users from accessing admin routes.

### ✓ Step 5: Handle 403 errors gracefully in API client
Return empty data instead of throwing when role lacks permission.

### ✓ Step 6: Fix RBAC role normalization and routing deadlock
Normalize roles to uppercase everywhere, remove justSignedOut routing deadlock, fix drawer subtitle, and fix welcome carousel shadow.

### ✓ Step 7: Add WhatsApp, Location, Age to registration and Admin Forecast
Add whatsappNumber, location, age fields to Prisma schema, backend registration, frontend sign-up form, and "Mobilise via WhatsApp" button in Admin Forecast view.

### ✓ Phase 1: Database Schema
Added phoneNumber, pushToken to User model. Added 11 fields to Campaign model (imageUrl, locationName, lat/long, contact info, services, availableItems, notificationType).

### ✓ Phase 2: Backend API
Configured Cloudinary and multer, installed expo-server-sdk, updated campaign creation with image upload and auto push notifications, added push-token endpoint.

### ✓ Phase 3: Frontend Registration
Added Phone Number input to sign-up form and updated signUp() function.

### ✓ Phase 4: Frontend Campaign Creation (Admin Form)
Built campaign creation modal with image picker, GPS, contact fields, notification type selector, and FormData submission.

### ✓ Phase 5: Push Notifications (Frontend)
Added push notification registration in root layout, token saved to backend on login.

### ✓ Phase 6: Campaign Details UI
Added Cloudinary image display, MapView with marker, clickable phone/WhatsApp links, bulleted service/item lists, notification type badge.

### ✓ Step 8: Notification badge, Admin graphs, and Dashboard sidebar label
Added unread notification badge on bell icon (already implemented), zero-dependency AdminGraphsView with blood inventory bar chart and donations trend card, changed all drawer "Home" labels to "Dashboard" with grid icon.

---

**Date:** 2026-11-22
**Scope:** Read-only audit of Role-Based Access Control across frontend and backend. No files modified.

---

## 1. FRONTEND AUDIT: What is currently breaking role-based rendering and navigation?

### Finding 1.1: All roles see the identical home dashboard

- **File:** `hemora-mobile/src/app/(home)/index.tsx` (1420 lines)
- **Issue:** The `HomeScreen` component renders the same 4 tabs (home, donations, requests, profile) for ALL roles. There is no conditional rendering based on `userRole`. A DONOR sees the same inventory, requisitions, and campaign data as an ADMIN.
- **Root cause:** The `activeTab` state and tab content components (`DonationsTabContent`, `RequestsTabContent`, `ProfileTabContent`) are not filtered by role. The `userRole` is fetched (line 121-125) but only used for the display name (line 142-149) — not for controlling what content is visible.
- **Impact:** DONORs can see blood inventory, all requisitions, and campaign data they shouldn't access. ADMINs see the same limited view as DONORs — no admin-specific screens.

### Finding 1.2: Drawer menu items only switch tabs, not navigate to screens

- **File:** `hemora-mobile/src/components/navigation/HemoraDrawer.tsx` (lines 99-106)
- **Issue:** The `handleMenuItemPress` function calls `onTabChange(tab)` which only changes the `activeTab` state in the home screen. It does NOT use `router.push()` to navigate to separate screens.
- **Code snippet:**
  ```typescript
  const handleMenuItemPress = (item: { tab?: string; action?: string }) => {
    onClose();
    if (item.tab && onTabChange) {
      onTabChange(item.tab);  // Only switches tabs, no navigation
    } else if (item.action === 'help') {
      // Help action — no navigation needed yet
    }
  };
  ```
- **Impact:** Admin menu items like "Users", "Facilities", "System Overview" all map to `tab: 'home'` — clicking them just switches to the home tab with no visible change. They are effectively dead links.

### Finding 1.3: No admin screens exist

- **Files searched:** All `.tsx` files in `hemora-mobile/src/app/`
- **Existing screens:**
  - `(auth)/welcome.tsx`, `sign-in.tsx`, `sign-up.tsx`, `forgot-password.tsx`, `reset-password.tsx`, `verify-email.tsx`, `staff-invitation.tsx`, `invitation-success.tsx`
  - `(home)/index.tsx`, `notifications.tsx`
  - `campaigns/[id].tsx`
- **Missing screens:** `/admin/users`, `/admin/forecast`, `/admin/campaigns`, `/admin/facilities`, `/admin/system-overview`
- **Impact:** Even if the drawer tried to navigate to these routes, Expo Router would show a "not found" error because the files don't exist.

### Finding 1.4: No route guards prevent role escalation

- **File:** `hemora-mobile/src/app/_layout.tsx` (lines 8-16)
- **Issue:** The `roleRouteMap` sends ALL roles to `/(home)`. There is no check preventing a DONOR from manually navigating to an admin route if one existed.
- **Code snippet:**
  ```typescript
  const roleRouteMap: Record<string, string> = {
      ADMIN: "/(home)",
      MANAGER: "/(home)",
      DOCTOR: "/(home)",
      NURSE: "/(home)",
      DONOR: "/(home)",
  };
  ```
- **Impact:** No frontend protection against role escalation. If admin screens were created, any authenticated user could navigate to them.

### Finding 1.5: Dashboard fetches all data regardless of role

- **File:** `hemora-mobile/src/app/(home)/index.tsx` (lines 100-140)
- **Issue:** The home screen fetches inventory, requisitions, campaigns, and stats for ALL roles. It relies on the backend returning 403 errors for unauthorized roles, but these errors are not handled gracefully — they would cause the `useQuery` to fail and show an error state.
- **Impact:** DONORs make unnecessary API calls for data they can't access. If the backend returns 403, the query fails and the screen shows an error.

---

## 2. BACKEND AUDIT: Are the API routes currently secure?

### Finding 2.1: Backend RBAC is well-implemented ✅

- **File:** `hemora-backend/src/middleware/rbac.middleware.ts`
- **Status:** The `requireAuth()` and `requirePermission()` middlewares correctly validate JWT tokens and check role permissions.
- **File:** `hemora-backend/src/lib/permissions.ts`
- **Status:** The role-permission matrix is comprehensive and correctly defines what each role can do.

### Finding 2.2: All API routes have appropriate guards ✅

- **File:** `hemora-backend/src/routes/prototype.routes.ts`
- **Protected routes audit:**

| Route | Guard | Correct? |
|---|---|---|
| `GET /inventory` | `requirePermission({ inventory: ["read"] })` | ✅ All roles can read |
| `POST /inventory` | `requirePermission({ inventory: ["update"] })` | ✅ Only MANAGER, ADMIN |
| `PATCH /inventory/:bg` | `requirePermission({ inventory: ["update"] })` | ✅ Only MANAGER, ADMIN |
| `GET /requisitions` | `requirePermission({ requisition: ["read"] })` | ✅ All roles can read |
| `POST /requisitions` | `requirePermission({ requisition: ["create"] })` | ✅ NURSE, DOCTOR only |
| `PATCH /requisitions/:id/status` | `requirePermission({ requisition: ["approve"] })` | ✅ DOCTOR, MANAGER, ADMIN |
| `POST /forecast` | `requirePermission({ forecast: ["view"] })` | ✅ Only MANAGER, ADMIN |
| `GET /users` | `requirePermission({ user: ["list"] })` | ✅ Only ADMIN |
| `POST /users` | `requirePermission({ user: ["create"] })` | ✅ Only ADMIN |
| `GET /campaigns` | `requirePermission({ campaign: ["read"] })` | ✅ DONOR, MANAGER, ADMIN |
| `POST /campaigns` | `requirePermission({ campaign: ["create"] })` | ✅ MANAGER, ADMIN |
| `GET /me` | `requireAuth()` | ✅ Any authenticated user |
| `GET /role` | `requireAuth()` | ✅ Any authenticated user |
| `GET /notifications` | `requireAuth()` | ✅ Any authenticated user |
| `GET /stats` | `requirePermission({ inventory: ["read"] })` | ✅ All roles can read |

### Finding 2.3: Auth routes are secure ✅

- **File:** `hemora-backend/src/routes/auth.routes.ts`
- **Status:** Login/register have rate limiting. Password hashing uses bcrypt. JWT tokens include role. Refresh token rotation is implemented. Session revocation works.

### Finding 2.4: No SQL injection vulnerabilities ✅

- **Finding:** All database queries use Prisma's type-safe API. No `queryRaw` or template literal SQL found.

### Finding 2.5: No routes missing role guards ✅

- **Finding:** Every route in `prototype.routes.ts` has either `requireAuth()` or `requirePermission()`. No unprotected endpoints expose sensitive data.

---

## 3. PROPOSED FIXES

### Fix 1: Add role-aware tab visibility in the home dashboard

**File:** `hemora-mobile/src/app/(home)/index.tsx`

Add a role-based filter that controls which tabs are visible in the bottom tab bar and which content renders in the ScrollView.

```typescript
// After fetching userRole, define visible tabs based on role
const visibleTabs = useMemo((): TabType[] => {
  if (!userRole) return ["home", "donations", "requests", "profile"];
  switch (userRole) {
    case "DONOR":
      return ["home", "donations", "profile"];
    case "NURSE":
      return ["home", "requests", "profile"];
    case "DOCTOR":
      return ["home", "requests", "profile"];
    case "MANAGER":
      return ["home", "donations", "requests", "profile"];
    case "ADMIN":
      return ["home", "donations", "requests", "profile"];
    default:
      return ["home", "donations", "requests", "profile"];
  }
}, [userRole]);

// Filter bottom tab bar to show only visible tabs
{visibleTabs.includes("home") && <TabButton ... />}
{visibleTabs.includes("donations") && <TabButton ... />}
{visibleTabs.includes("requests") && <TabButton ... />}
{visibleTabs.includes("profile") && <TabButton ... />}
```

### Fix 2: Add role-aware content filtering in the home dashboard

**File:** `hemora-mobile/src/app/(home)/index.tsx`

Conditionally render sections based on role:

```typescript
{activeTab === "home" && (
  <>
    <Text style={styles.greeting}>Hello, {firstName} 👋</Text>
    <View style={styles.searchBar}>...</View>
    
    {/* Campaigns — visible to DONOR, MANAGER, ADMIN */}
    {(userRole === "DONOR" || userRole === "MANAGER" || userRole === "ADMIN") && (
      <CampaignCarousel campaigns={...} />
    )}
    
    {/* Upcoming Donations — visible to DONOR only */}
    {userRole === "DONOR" && (
      <UpcomingDonationsSection donations={upcomingDonations} />
    )}
    
    {/* Requests — visible to NURSE, DOCTOR, MANAGER, ADMIN */}
    {(userRole === "NURSE" || userRole === "DOCTOR" || userRole === "MANAGER" || userRole === "ADMIN") && (
      <RequestsSection requisitions={...} />
    )}
  </>
)}
```

### Fix 3: Create admin screens for missing routes

**New files to create:**

1. `hemora-mobile/src/app/(home)/admin/users.tsx` — User management list
2. `hemora-mobile/src/app/(home)/admin/forecast.tsx` — Blood demand forecast
3. `hemora-mobile/src/app/(home)/admin/campaigns.tsx` — Campaign management
4. `hemora-mobile/src/app/(home)/admin/facilities.tsx` — Facility overview
5. `hemora-mobile/src/app/(home)/admin/system.tsx` — System statistics

Each screen should:
- Use the existing design system (MockupColors, Ionicons, shared components)
- Fetch data from the corresponding API endpoint via `hemoraFetch`
- Include a route guard that redirects non-ADMIN users back to home

```typescript
// Example route guard pattern for admin screens
useEffect(() => {
  if (userRole && userRole !== "ADMIN") {
    router.replace("/(home)");
  }
}, [userRole]);
```

### Fix 4: Update drawer to navigate to actual screens for ADMIN

**File:** `hemora-mobile/src/components/navigation/HemoraDrawer.tsx`

Change ADMIN menu items to use `router.push()` instead of `onTabChange()`:

```typescript
case 'ADMIN':
  return [
    { icon: 'people-outline' as const, label: 'Users', route: '/(home)/admin/users' },
    { icon: 'business-outline' as const, label: 'Facilities', route: '/(home)/admin/facilities' },
    { icon: 'pulse-outline' as const, label: 'System Overview', route: '/(home)/admin/system' },
    { icon: 'analytics-outline' as const, label: 'Forecast', route: '/(home)/admin/forecast' },
    { icon: 'flash-outline' as const, label: 'Campaigns', route: '/(home)/admin/campaigns' },
    { icon: 'person-outline' as const, label: 'My Profile', tab: 'profile' },
  ];
```

Update `handleMenuItemPress`:
```typescript
const handleMenuItemPress = (item: { tab?: string; route?: string; action?: string }) => {
  onClose();
  if (item.route) {
    router.push(item.route as any);  // Navigate to actual screen
  } else if (item.tab && onTabChange) {
    onTabChange(item.tab);  // Switch tab for non-admin items
  }
};
```

### Fix 5: Add frontend route guard in root layout

**File:** `hemora-mobile/src/app/_layout.tsx`

Add a check in the redirect logic to prevent non-ADMIN users from accessing admin routes:

```typescript
// In the redirect useEffect, after the isLoggedIn check:
const isAdminRoute = currentPath.includes('/admin/');
if (isAdminRoute && userRole && userRole !== 'ADMIN') {
  console.log("[RootLayout] Non-admin user accessing admin route, redirecting to home");
  router.replace("/(home)");
  return;
}
```

### Fix 6: Handle 403 errors gracefully in the API client

**File:** `hemora-mobile/src/lib/api.ts`

Add 403 handling to prevent unhandled errors when a role tries to access a protected endpoint:

```typescript
if (response.status === 403) {
  // Role doesn't have permission — return empty data instead of throwing
  // The frontend should handle empty data gracefully
  console.warn(`[api] 403 Forbidden for ${path} — insufficient role permissions`);
  return { data: [] } as T;  // Return empty array/object
}
```

---

## 4. ROLE VERIFICATION MATRIX

| Feature | DONOR | NURSE | DOCTOR | MANAGER | ADMIN |
|---|---|---|---|---|---|
| **Dashboard Home** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Search** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Campaign Carousel** | ✅ view | ❌ | ❌ | ✅ view+create | ✅ view+create |
| **Upcoming Donations** | ✅ view+cancel | ❌ | ❌ | ❌ | ❌ |
| **Blood Requests** | ❌ | ✅ view+create | ✅ view+create+approve | ✅ view+approve | ✅ view+all |
| **Blood Inventory** | ✅ view | ✅ view | ✅ view | ✅ view+update | ✅ view+update |
| **Donations Tab** | ✅ | ❌ | ❌ | ✅ | ✅ |
| **Requests Tab** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Profile Tab** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Notifications** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Forecast** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **User Management** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Facility Management** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **System Statistics** | ✅ basic | ✅ basic | ✅ basic | ✅ basic | ✅ full |
| **Campaign Management** | ❌ | ❌ | ❌ | ✅ | ✅ |

### Current State vs Desired State

| Aspect | Current | Desired |
|---|---|---|
| Tab visibility | All 4 tabs for all roles | Role-filtered tabs |
| Drawer navigation | Tab switching only | Screen navigation for ADMIN |
| Admin screens | None exist | 5 dedicated screens |
| Route guards | None | Layout-level + screen-level |
| API 403 handling | Throws error | Graceful empty data |
| Backend RBAC | ✅ Complete | No changes needed |

---

## 5. SUMMARY AND RECOMMENDATIONS

### Immediate Actions for Tomorrow's Presentation

1. **Restart the backend server** — clears the rate limit store (no code change needed)
2. **Verify laptop IP matches `.env`** — run `ip a` to confirm `192.168.43.43`
3. **Apply Fix 1 & 2** — role-aware tab/content visibility in the home dashboard (smallest diff, biggest visual impact)
4. **Apply Fix 4** — update drawer to navigate to actual screens for ADMIN
5. **Apply Fix 3** — create basic admin screens (users, forecast, campaigns, facilities, system)
6. **Apply Fix 5** — add route guard in root layout

### What NOT to Change

- **Backend RBAC** — already correct, do not touch
- **Auth routes** — already secure with rate limiting, JWT, refresh rotation
- **Permissions matrix** — comprehensive and correct
- **Database schema** — no changes needed
- **Welcome screen** — already redesigned

### Security Assessment

| Area | Status | Risk |
|---|---|---|
| JWT secrets | ⚠️ Dev defaults | Low for demo, critical for production |
| SQL injection | ✅ None | Prisma parameterized queries |
| Auth middleware | ✅ Working | Token validation on all routes |
| Rate limiting | ✅ Active | 100 req/15min in dev mode |
| Password hashing | ✅ bcrypt | Properly implemented |
| Refresh token rotation | ✅ Working | Session security maintained |
| CORS | ✅ Configured | Environment-based origins |
| Role escalation (frontend) | ❌ No guards | Easy to fix with route guards |
| Role escalation (backend) | ✅ Protected | All routes have permission checks |

**Bottom line:** The backend is secure. The frontend needs role-aware rendering, admin screens, and route guards. The fixes are localized and can be implemented without refactoring working code.
---

## Campaign Lifecycle & Donor Contact System — 6-Phase Implementation Plan

**Date:** 2026-11-22
**Scope:** Complete campaign creation (with image upload, GPS, contacts), campaign details (with map, clickable links), push notifications, and enhanced registration.

### Current State Investigation

**Already done (from previous work):**
- User model has `whatsappNumber`, `location`, `age` ✅
- Sign-up form has WhatsApp, Location, Age inputs ✅
- Backend `/auth/register` accepts these fields ✅
- All required frontend packages installed: `expo-notifications`, `expo-device`, `expo-constants`, `expo-location`, `expo-image-picker`, `react-native-maps` ✅
- Backend has `cloudinary` and `multer` packages installed ✅
- Expo project ID available: `b881d9d9-9058-478d-ade0-b891e0f065c9` ✅

**Missing:**
- User model: `phoneNumber`, `pushToken` fields
- Campaign model: 11 new fields (imageUrl, locationName, latitude, longitude, contactName, contactPhone, contactWhatsApp, services[], availableItems[], notificationType)
- Backend: Cloudinary config in .env, expo-server-sdk package, push-token endpoint, campaign image upload, auto-notification on campaign create
- Frontend: Phone Number input in sign-up, full campaign creation form in admin, push notification registration in layout, campaign details with map/contacts

### Phase 1: Database Schema (The Foundation)

**Files:** `hemora-backend/prisma/schema.prisma`

**User model** — add 2 fields:
```
  phoneNumber    String?
  pushToken      String?
```

**Campaign model** — add 11 fields:
```
  imageUrl         String?
  locationName     String?
  latitude         Float?
  longitude        Float?
  contactName      String?
  contactPhone     String?
  contactWhatsApp  String?
  services         String[]  @default([])
  availableItems   String[]  @default([])
  notificationType String    @default("info")
```

**Post-change:** Run `npx prisma db push` to apply without data loss.

### Phase 2: Backend API (Express, Cloudinary & Notifications)

**Files:** `hemora-backend/.env`, `hemora-backend/src/server.ts`, `hemora-backend/src/routes/auth.routes.ts`, `hemora-backend/src/routes/prototype.routes.ts`

**Actions:**
1. Add Cloudinary env vars to `.env` (CLOUDINARY_CLOUD_NAME, API_KEY, API_SECRET)
2. Install `expo-server-sdk` in backend
3. Configure cloudinary + multer in `server.ts`
4. Update `POST /auth/register` to accept `phoneNumber`
5. Create `POST /api/users/push-token` — saves pushToken to logged-in user
6. Update `POST /campaigns` — accept multipart/form-data with image upload to Cloudinary, save all new fields
7. After campaign creation: fetch all users with pushToken (excluding creator), send categorized push notification via expo-server-sdk

### Phase 3: Frontend Registration

**Files:** `hemora-mobile/src/app/(auth)/sign-up.tsx`, `hemora-mobile/src/lib/auth-client.ts`

**Actions:**
1. Add Phone Number input field to sign-up form
2. Update `signUp()` function to include `phoneNumber`

### Phase 4: Frontend Campaign Creation (Admin Form)

**Files:** `hemora-mobile/src/app/(home)/index.tsx`

**Actions:**
1. Replace "Create New Campaign" button with modal form
2. Fields: Title, Description, Date, Location, Contact info, Services, Items, notificationType selector
3. Image picker (expo-image-picker), GPS button (expo-location)
4. Submit as FormData to backend

### Phase 5: Push Notifications (Frontend Registration)

**Files:** `hemora-mobile/src/app/_layout.tsx`

**Actions:**
1. Create push notification registration helper
2. Request permissions, get ExpoPushToken, send to backend on login
3. Configure notification handler for foreground

### Phase 6: Campaign Details UI

**Files:** `hemora-mobile/src/app/campaigns/[id].tsx`

**Actions:**
1. Display Cloudinary image
2. MapView with Marker at campaign coordinates
3. Clickable Phone (tel:) and WhatsApp (whatsapp://) links
4. Bulleted lists for services and availableItems
5. NotificationType badge

---

**Execution Order:** Phase 1 → 2 → 3 → 4 → 5 → 6 (each phase approved before next)
