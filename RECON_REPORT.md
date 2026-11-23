# HEMORA — Reconnaissance Report

**Date:** 2026-11-23
**Scope:** Read-only technical reconnaissance — no modifications made
**Status:** Complete

---

## 1. Executive Summary

HEMORA is an academic capstone prototype for blood inventory management, AI-powered demand forecasting, and donor mobilisation, targeting hospitals and blood banks in Zambia. It is a three-tier application: an Expo React Native mobile app (frontend), an Express.js REST API (backend), and a Python FastAPI ML service (AI). The project recently migrated from Supabase Auth to custom JWT authentication (commit b92d258). The codebase is well-structured with 5 user roles, 9 database models, 47 API endpoints, and 28 reusable UI components. Three TODOs remain in the mobile app (staff invitation, email resend, facility delete). The project has 13 git commits and appears actively developed.

---

## 2. Folder Map

```
Hemora/
├── README.md                          # Project overview, setup, demo accounts
├── ARCHITECTURE.md                    # System architecture, API reference, RBAC matrix
├── DEMO_ACCOUNTS.md                   # Demo credentials and role descriptions
├── DEMO_SCENARIOS.md                  # Step-by-step demo walkthroughs
├── PRESENTATION.md                    # Capstone presentation talking points
├── RENDER_DEPLOYMENT.md               # Cloud deployment guide
├── BACKEND_INTEGRATION_DIAGNOSTIC.md  # Backend integration diagnostic report
├── HEMORA_AUTHENTICATION_AUDIT.md     # Auth audit (OUTDATED — predates custom JWT migration)
├── skills-lock.json                   # Skills lock file
│
├── hemora-backend/                    # Express.js REST API
│   ├── src/
│   │   ├── server.ts                  # Entry point, middleware, route mounting
│   │   ├── lib/
│   │   │   ├── auth-jwt.ts            # JWT generation/verification (jose, HS256)
│   │   │   ├── password.ts            # bcrypt password hashing
│   │   │   ├── token.ts               # Refresh token CRUD + rotation
│   │   │   ├── google-auth.ts         # Google ID token verification (JWKS)
│   │   │   ├── permissions.ts         # RBAC role-permission map
│   │   │   ├── prisma.ts              # Prisma client (pg adapter)
│   │   │   ├── email.ts               # Nodemailer email sending
│   │   │   └── upload.ts              # Multer file upload config
│   │   ├── middleware/
│   │   │   ├── rbac.middleware.ts     # requireAuth() + requirePermission()
│   │   │   ├── rate-limit.middleware.ts  # IP-based rate limiting
│   │   │   └── audit.middleware.ts    # Audit logging for sensitive ops
│   │   ├── routes/
│   │   │   ├── auth.routes.ts         # 8 auth endpoints (428 lines)
│   │   │   ├── google-auth.routes.ts  # Google OAuth verification
│   │   │   └── prototype.routes.ts    # 39 API endpoints (1622 lines)
│   │   ├── config/
│   │   │   └── cloudinary.ts          # Cloudinary image upload config
│   │   └── __tests__/
│   │       ├── auth.test.ts           # Auth integration tests (316 lines)
│   │       ├── distribution.test.ts   # Distribution tests
│   │       └── permissions.test.ts    # RBAC permission tests
│   ├── prisma/
│   │   ├── schema.prisma              # 9 models, 7 enums (271 lines)
│   │   ├── migrations/                # 6 migrations
│   │   └── seed/
│   │       ├── seed.ts                # Demo data seed (401 lines)
│   │       ├── seed-auth.ts           # Legacy Supabase auth seed (unused)
│   │       └── reset-passwords.ts     # Password reset utility
│   ├── package.json                   # Express 5, Prisma 7, jose, bcryptjs
│   ├── tsconfig.json
│   ├── prisma7.config.ts
│   └── .env.example
│
├── hemora-mobile/                     # Expo React Native app
│   ├── src/
│   │   ├── app/                       # Expo Router (file-based routing)
│   │   │   ├── _layout.tsx            # Root layout: auth guards, role routing, push notifications
│   │   │   ├── (auth)/                # Auth group (9 screens)
│   │   │   │   ├── sign-in.tsx
│   │   │   │   ├── sign-up.tsx
│   │   │   │   ├── forgot-password.tsx
│   │   │   │   ├── reset-password.tsx
│   │   │   │   ├── verify-email.tsx
│   │   │   │   ├── welcome.tsx
│   │   │   │   ├── staff-invitation.tsx
│   │   │   │   └── invitation-success.tsx
│   │   │   ├── (home)/                # Home group (10 screens)
│   │   │   │   ├── index.tsx          # Main dashboard (3886 lines — massive)
│   │   │   │   ├── dashboard.tsx      # Dashboard with counts/stats
│   │   │   │   ├── notifications.tsx
│   │   │   │   ├── settings.tsx
│   │   │   │   └── admin/             # Admin-only screens
│   │   │   │       ├── users.tsx
│   │   │   │       ├── facilities.tsx
│   │   │   │       ├── campaigns.tsx
│   │   │   │       ├── forecast.tsx
│   │   │   │       └── system.tsx
│   │   │   ├── campaigns/[id].tsx     # Dynamic campaign detail
│   │   │   └── facilities/[id].tsx    # Dynamic facility detail
│   │   ├── components/
│   │   │   ├── ui/                    # 28 reusable UI components
│   │   │   ├── layout/                # Screen layout, section header
│   │   │   ├── navigation/            # HemoraDrawer navigation
│   │   │   └── feedback/              # Toast, error state, skeleton, confirmation dialog
│   │   ├── lib/
│   │   │   ├── api.ts                 # hemoraFetch() — authenticated API client (89 lines)
│   │   │   ├── auth-client.ts         # signIn, signUp, signOut, session hooks (572 lines)
│   │   │   ├── auth-storage.ts        # SecureStore + AsyncStorage session persistence (224 lines)
│   │   │   ├── secure-store-adapter.ts # SecureStore adapter
│   │   │   └── permissions.ts         # Client-side permission checks
│   │   ├── constants/
│   │   │   └── theme.ts               # Design system: colors, typography, spacing (299 lines)
│   │   └── types/
│   │       └── css-module.d.ts        # CSS module type declarations
│   ├── app.json                       # Expo config (SDK 55, bundle: com.kafiswe.hemoramobile)
│   ├── package.json                   # Expo 55, React 19, TanStack Query, Zod 4
│   ├── eas.json                       # EAS Build config
│   ├── metro.config.ts                # Metro bundler config
│   ├── google-services.json           # Firebase config for push notifications
│   └── .env                           # EXPO_PUBLIC_API_URL
│
└── hemora-ai/                         # Python FastAPI ML service
    ├── main.py                        # FastAPI app: /predict, /predict/all, /model-info, /health
    ├── model.py                       # RandomForestRegressor training + prediction (117 lines)
    ├── data.py                        # Dataset loading + feature engineering
    ├── generate_dataset.py            # Synthetic dataset generator
    ├── dataset.csv                    # 3,328 records (104 weeks × 8 groups × 4 components)
    ├── requirements.txt               # fastapi, uvicorn, scikit-learn, pandas, numpy
    └── venv/                          # Python virtual environment
```

---

## 3. Tech Stack Table

| Layer | Technology | Version | Notes |
|---|---|---|---|
| **Mobile Framework** | Expo | ~55.0.32 (SDK 55) | Dev client build (expo-dev-client) |
| **Mobile UI** | React Native | 0.83.10 | With react-native-web (~0.21.0) |
| **Mobile Language** | TypeScript | ~5.9.2 | |
| **Mobile React** | React | 19.2.0 | |
| **Mobile Routing** | Expo Router | ~55.0.18 | File-based routing |
| **Mobile Navigation** | React Navigation | v7 (drawer + bottom-tabs) | HemoraDrawer component |
| **Mobile State** | TanStack Query | ^5.108.0 | Server state management |
| **Mobile Forms** | React Hook Form | ^7.92.0 | With Zod ^4.6.7 validation |
| **Mobile Auth Storage** | expo-secure-store | ~55.0.18 | With AsyncStorage fallback |
| **Mobile Animations** | React Native Reanimated | 4.2.1 | |
| **Mobile Icons** | lucide-react-native | ^1.75.0 | |
| **Mobile Maps** | react-native-maps | 1.27.2 | |
| **Mobile Push** | expo-notifications | ~55.0.27 | Firebase-backed |
| **Mobile Image Picker** | expo-image-picker | ~55.0.24 | |
| **Mobile Location** | expo-location | ~55.1.15 | |
| **Backend Framework** | Express.js | ^5.3.0 | |
| **Backend Language** | TypeScript | ^7.0.2 | ES modules |
| **Backend Auth** | jose | ^5.9.6 | Custom JWT (HS256) |
| **Backend Password** | bcryptjs | ^3.0.3 | Cost factor 12 |
| **Backend ORM** | Prisma | ^7.0.0 | With @prisma/adapter-pg |
| **Backend DB Driver** | pg | ^8.23.1 | Direct PostgreSQL connection |
| **Backend Email** | nodemailer | ^10.6.1 | SMTP (optional) |
| **Backend File Upload** | multer | ^2.5.0 | |
| **Backend Image Storage** | cloudinary | ^2.11.0 | Campaign images |
| **Backend Push** | expo-server-sdk | ^8.0.0 | Expo push notifications |
| **Backend Runtime** | Node.js | 18+ (required) | tsx for dev |
| **Database** | PostgreSQL | 14+ (required) | Local `hemora` database |
| **AI Framework** | FastAPI | 0.115.0 | |
| **AI Server** | uvicorn | 0.32.0 | |
| **AI ML** | scikit-learn | 1.5.2 | RandomForestRegressor |
| **AI Data** | pandas | 2.2.3 | |
| **AI Data** | numpy | 2.1.1 | |
| **AI Runtime** | Python | 3.9+ | |
| **Build/Dev** | tsx | ^4.23.15 | TypeScript executor |
| **Build/Dev** | esbuild | ^0.28.2 | |
| **Testing (Backend)** | Jest | ^30.5.2 | With supertest |
| **Testing (Mobile)** | Jest | ~29.7.0 | With @testing-library/react-native |
| **Linting** | ESLint | ^9.0.0 | expo lint |
| **Deployment** | EAS Build | — | expo-dev-client builds |
| **Deployment** | Render | — | Backend deployment (per RENDER_DEPLOYMENT.md) |

---

## 4. Data Model

### 4.1 Entities (9 models)

**User** (`user` table)
- `id` (String, PK, cuid), `name`, `email` (unique), `emailVerified` (Boolean)
- `role` (UserRole enum, default DONOR), `banned`, `banReason`, `banExpires`
- `bloodGroup` (BloodGroup enum, optional), `phone`, `eligible` (Boolean)
- `facilityId` (FK → Facility), `licenseNo`
- `passwordHash` (String, nullable — for custom auth)
- `emailVerificationToken`, `emailVerificationExpires`
- `passwordResetToken`, `passwordResetExpires`
- `age`, `location`, `whatsappNumber`, `phoneNumber`, `pushToken`, `avatarUrl`, `image`
- Relations: `refreshTokens[]`, `googleAccounts[]`, `notifications[]`, `campaignInvitations[]`, `requisitions[]`, `transfusions[]`, `facility?`
- Indexes: `[role]`, `[email]`, `[facilityId]`

**Facility** (`facility` table)
- `id` (String, PK, cuid), `name`, `type` (Hospital/Blood Bank/Clinic), `address`, `phone`
- Relations: `users[]`, `requisitions[]`
- Index: `[type]`

**BloodInventory** (`blood_inventory` table)
- `id` (String, PK, cuid), `bloodGroup` (enum), `component` (enum, default WHOLE_BLOOD)
- `units` (Int, default 0), `minThreshold` (Int, default 15), `expiresAt` (DateTime, nullable)
- Unique: `[bloodGroup, component]`
- Index: `[bloodGroup]`

**Requisition** (`requisition` table)
- `id` (String, PK, cuid), `requesterId` (FK → User), `patientName`, `patientRef`
- `bloodGroup`, `component` (default WHOLE_BLOOD), `unitsNeeded`, `urgency` (default ROUTINE)
- `status` (RequisitionStatus, default PENDING), `clinicalNote`
- `facilityId` (FK → Facility), `approvedBy` (String), `approvedAt`
- Indexes: `[status]`, `[requesterId]`, `[facilityId]`

**TransfusionLog** (`transfusion_log` table)
- `id` (String, PK, cuid), `administeredBy` (FK → User), `patientRef`
- `bloodGroup`, `component` (default WHOLE_BLOOD), `unitsUsed` (default 1)
- `vitalsStable` (Boolean, default true), `notes`
- Index: `[administeredBy]`

**Campaign** (`campaign` table)
- `id` (String, PK, cuid), `title`, `description`, `bloodGroup` (nullable)
- `targetUnits` (default 10), `status` (CampaignStatus, default DRAFT)
- `startDate`, `endDate`, `createdBy` (String)
- `location`, `availableItems` (String[]), `contactName`, `contactPhone`, `contactWhatsApp`
- `imageUrl`, `latitude`, `longitude`, `locationName`, `notificationType` (default "info")
- `services` (String[])
- Relations: `invitations[]`
- Index: `[status]`

**CampaignInvitation** (`campaign_invitation` table)
- `id` (String, PK, cuid), `campaignId` (FK → Campaign, cascade delete), `donorId` (FK → User)
- `status` (InvitationStatus, default PENDING), `sentAt`, `respondedAt`
- Indexes: `[campaignId]`, `[donorId]`

**Notification** (`notification` table)
- `id` (String, PK, cuid), `userId` (FK → User, cascade delete)
- `title`, `message`, `type` (NotificationType), `isRead` (Boolean, default false)
- `relatedId` (nullable)
- Indexes: `[userId]`, `[userId, isRead]`

**RefreshToken** (`refresh_token` table)
- `id` (String, PK, cuid), `userId` (FK → User, cascade delete)
- `tokenHash` (String), `createdAt`, `expiresAt`, `revokedAt` (nullable)
- Indexes: `[userId]`, `[tokenHash]`, `[expiresAt]`

**GoogleAccount** (`google_account` table)
- `id` (String, PK, cuid), `userId` (FK → User, cascade delete)
- `googleSub` (String, unique), `email`
- Index: `[userId]`

### 4.2 Enums (7)

| Enum | Values |
|---|---|
| **UserRole** | DONOR, NURSE, DOCTOR, MANAGER, ADMIN |
| **BloodGroup** | A_POS, A_NEG, B_POS, B_NEG, AB_POS, AB_NEG, O_POS, O_NEG |
| **BloodComponent** | WHOLE_BLOOD, Packed_RBC, PLASMA, PLATELETS |
| **Urgency** | ROUTINE, URGENT, EMERGENCY |
| **RequisitionStatus** | PENDING, APPROVED, DISPATCHED, REJECTED |
| **CampaignStatus** | DRAFT, ACTIVE, COMPLETED, CANCELLED |
| **InvitationStatus** | PENDING, ACCEPTED, DECLINED, EXPIRED |
| **NotificationType** | INVITATION, CAMPAIGN_JOIN, CAMPAIGN_ACCEPT, CAMPAIGN_DECLINE, REQUISITION, SYSTEM |

### 4.3 ER Summary

- **User** is the central entity, linked to Facility (belongs-to), RefreshToken (1:N), GoogleAccount (1:N), Notification (1:N), CampaignInvitation as donor (1:N), Requisition as requester (1:N), TransfusionLog as staff (1:N).
- **BloodInventory** is a standalone lookup table (unique per bloodGroup+component).
- **Requisition** links User (requester) → Facility, with optional approval by another User.
- **Campaign** → CampaignInvitation (1:N) → User (donor).
- **Notification** belongs to User.

---

## 5. API Endpoints

All endpoints are prefixed with the base URL (default `http://localhost:5000`). Auth endpoints use `/api/auth/*`; API endpoints use `/api/hemora/*`.

### 5.1 Authentication (8 endpoints) — `/api/auth/*`

| Method | Path | Auth | Role | Purpose |
|---|---|---|---|---|
| POST | `/api/auth/register` | No | — | Create account (default DONOR role), sends email verification |
| POST | `/api/auth/login` | No | — | Email/password login, returns access+refresh tokens |
| POST | `/api/auth/logout` | No | — | Revoke refresh token |
| POST | `/api/auth/refresh` | No | — | Rotate refresh token, return new access token |
| POST | `/api/auth/forgot-password` | No | — | Request password reset email |
| POST | `/api/auth/reset-password` | No | — | Reset password with token, revokes all sessions |
| POST | `/api/auth/verify-email` | No | — | Verify email address with token |
| GET | `/api/auth/me` | Yes (Bearer) | — | Get current user profile |
| POST | `/api/auth/google/verify` | No | — | Google OAuth ID token verification |

### 5.2 Inventory (3 endpoints) — `/api/hemora/*`

| Method | Path | Auth | Permission | Purpose |
|---|---|---|---|---|
| GET | `/inventory` | Yes | `inventory:read` | List all blood inventory records |
| POST | `/inventory` | Yes | `inventory:update` | Create or update inventory record (upsert) |
| PATCH | `/inventory/:bloodGroup` | Yes | `inventory:update` | Adjust stock by delta |

### 5.3 Requisitions (5 endpoints)

| Method | Path | Auth | Permission | Purpose |
|---|---|---|---|---|
| GET | `/requisitions` | Yes | `requisition:read` | List all requisitions |
| GET | `/requisitions/my` | Yes | `requisition:read` | List current user's requisitions |
| POST | `/requisitions` | Yes | `requisition:create` | Create new requisition |
| PATCH | `/requisitions/:id/status` | Yes | `requisition:approve` | Approve/dispatch/reject requisition |
| POST | `/requisitions/:id/distribute` | Yes | `requisition:approve` | Distribute blood (dispatch + deduct inventory) |

### 5.4 Forecast (3 endpoints)

| Method | Path | Auth | Permission | Purpose |
|---|---|---|---|---|
| POST | `/forecast` | Yes | `forecast:view` | Predict demand for one blood group |
| POST | `/forecast/all` | Yes | `forecast:view` | Predict demand for all blood groups |
| GET | `/forecast/model-info` | Yes | `forecast:view` | Get model performance metrics |

### 5.5 Facilities (3 endpoints)

| Method | Path | Auth | Permission | Purpose |
|---|---|---|---|---|
| GET | `/facilities` | Yes | `facility:read` | List all facilities with staff counts |
| GET | `/facilities/:id` | Yes | `facility:read` | Get facility details with users and requisitions |
| POST | `/facilities` | Yes | `facility:create` | Create new facility |

### 5.6 Campaigns (4 endpoints)

| Method | Path | Auth | Permission | Purpose |
|---|---|---|---|---|
| GET | `/campaigns` | Yes | `campaign:read` | List all campaigns |
| POST | `/campaigns` | Yes | `campaign:create` | Create campaign (with image upload via multer) |
| GET | `/campaigns/:id` | Yes | `campaign:read` | Get campaign details |
| DELETE | `/campaigns/:id` | Yes | `campaign:create` | Delete campaign |

### 5.7 Invitations (2 endpoints)

| Method | Path | Auth | Permission | Purpose |
|---|---|---|---|---|
| PATCH | `/invitations/:id/respond` | Yes | — | Accept or decline invitation |
| PATCH | `/invitations/:id/cancel` | Yes | — | Cancel invitation response |

### 5.8 Notifications (4 endpoints)

| Method | Path | Auth | Permission | Purpose |
|---|---|---|---|---|
| GET | `/notifications` | Yes | — | List user's notifications |
| PATCH | `/notifications/:id/read` | Yes | — | Mark notification as read |
| PATCH | `/notifications/read-all` | Yes | — | Mark all notifications as read |
| GET | `/notifications/unread-count` | Yes | — | Get unread notification count |

### 5.9 Users & Admin (7 endpoints)

| Method | Path | Auth | Permission | Purpose |
|---|---|---|---|---|
| GET | `/me` | Yes | — | Get current user profile (via hemora) |
| PATCH | `/me` | Yes | — | Update current user profile |
| GET | `/role` | Yes | — | Get current user role |
| GET | `/users` | Yes | `user:list` | List all users |
| PUT | `/users/:id` | Yes | `user:set-role` | Update user role |
| DELETE | `/users/:id` | Yes | `user:delete` | Delete user |
| PUT | `/users/profile` | Yes | — | Update user profile |
| POST | `/users` | Yes | `user:create` | Create user (admin) |
| POST | `/users/self` | Yes | — | Create own user record (legacy, from Supabase migration) |
| POST | `/users/push-token` | Yes | — | Register push notification token |

### 5.10 Stats & Dashboard (3 endpoints)

| Method | Path | Auth | Permission | Purpose |
|---|---|---|---|---|
| GET | `/stats` | Yes | `inventory:read` | System-wide statistics |
| GET | `/dashboard-counts` | Yes | `inventory:read` | Dashboard summary counts |
| GET | `/facilities/:id/requisitions` | Yes | `requisition:read` | Get requisitions for a facility |

### 5.11 Search (1 endpoint)

| Method | Path | Auth | Permission | Purpose |
|---|---|---|---|---|
| GET | `/search` | Yes | — | Search users, campaigns, etc. |

### 5.12 Health (1 endpoint)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | No | Backend health check |

**Total: 47 endpoints** (8 auth + 39 API)

### 5.13 AI Service Endpoints (4 endpoints) — `http://localhost:8000`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | No | Health check |
| POST | `/predict` | API Key | Predict demand for one blood group |
| POST | `/predict/all` | API Key | Predict demand for all blood groups |
| GET | `/model-info` | API Key | Model performance metrics |

---

## 6. Frontend Screens and Navigation

### 6.1 Navigation Architecture

- **Router:** Expo Router (file-based)
- **Root layout:** `src/app/_layout.tsx` — QueryClient provider, auth state management, role-based routing, push notification registration
- **Navigation pattern:** Drawer navigation (HemoraDrawer) with role-based menu items
- **Auth guard:** Root layout checks session, redirects unauthenticated users to `/(auth)`, routes authenticated users to `/(home)`

### 6.2 Screen Map

| Route | File | Auth Required | Role Access | Purpose |
|---|---|---|---|---|
| `/(auth)/welcome` | `welcome.tsx` | No | All | Welcome/onboarding screen |
| `/(auth)/sign-in` | `sign-in.tsx` | No | All | Email/password login |
| `/(auth)/sign-up` | `sign-up.tsx` | No | All | Registration with blood group |
| `/(auth)/forgot-password` | `forgot-password.tsx` | No | All | Password reset request |
| `/(auth)/reset-password` | `reset-password.tsx` | No | All | Password reset with token |
| `/(auth)/verify-email` | `verify-email.tsx` | No | All | Email verification |
| `/(auth)/staff-invitation` | `staff-invitation.tsx` | No | All | Staff invitation flow (TODO: incomplete) |
| `/(auth)/invitation-success` | `invitation-success.tsx` | No | All | Invitation success screen |
| `/(home)/index` | `index.tsx` | Yes | All | **Main dashboard** (3886 lines — all-in-one) |
| `/(home)/dashboard` | `dashboard.tsx` | Yes | All | Dashboard with counts and stats |
| `/(home)/notifications` | `notifications.tsx` | Yes | All | Notification list |
| `/(home)/settings` | `settings.tsx` | Yes | All | User settings |
| `/(home)/admin/users` | `admin/users.tsx` | Yes | ADMIN | User management |
| `/(home)/admin/facilities` | `admin/facilities.tsx` | Yes | ADMIN | Facility management |
| `/(home)/admin/campaigns` | `admin/campaigns.tsx` | Yes | ADMIN | Campaign management |
| `/(home)/admin/forecast` | `admin/forecast.tsx` | Yes | ADMIN | AI forecast view |
| `/(home)/admin/system` | `admin/system.tsx` | Yes | ADMIN | System stats and inventory |
| `/campaigns/[id]` | `campaigns/[id].tsx` | Yes | All | Campaign detail page |
| `/facilities/[id]` | `facilities/[id].tsx` | Yes | All | Facility detail page |

### 6.3 Role-Based Experience

| Role | Can See/Do |
|---|---|
| **DONOR** | View inventory, view campaigns, accept/decline invitations, view notifications |
| **NURSE** | Donor features + create/read requisitions, create/read transfusions |
| **DOCTOR** | Nurse features + approve requisitions |
| **MANAGER** | All inventory (read/update/dispatch), requisition review (approve/reject), forecast, campaign management, facility management |
| **ADMIN** | Full access including user management (create/list/set-role/ban/delete) |

### 6.4 Reusable Components (28 UI components)

- **Form:** `button`, `input`, `password-input`, `dropdown`, `date-picker`, `search-input`
- **Display:** `card`, `stat-card`, `badge`, `blood-group-badge`, `blood-group-card`, `donation-card`, `campaign-card`, `requisition-card`, `notification-item`, `user-card`, `profile-header`, `role-badge`, `urgency-badge`, `faq-item`
- **Layout:** `empty-state`, `modal`, `fab`, `filter-tabs`, `progress-bar`, `settings-item`
- **Branding:** `HemoraLogo`, `icon`
- **Animation:** `animations.tsx`

### 6.5 Theme/Design System

- **File:** `src/constants/theme.ts` (299 lines)
- **Primary color:** `#A71930` (burgundy/crimson)
- **Color tokens:** MockupColors (exact palette from design mockup), hemoraPalette (legacy), Colors.light/dark
- **Typography:** Defined in theme.ts
- **Styling approach:** Inline styles with theme constants; CSS modules supported via `global.css`

### 6.6 API Client

- **File:** `src/lib/api.ts` (89 lines)
- **Function:** `hemoraFetch<T>(path, options)` — attaches Bearer token, retries on 401 with token refresh, clears session on persistent 401
- **Base URL:** `EXPO_PUBLIC_API_URL` env var
- **Timeout:** 10 seconds per request
- **403 handling:** Returns empty array (silent fail)

### 6.7 Auth State & Token Storage

- **File:** `src/lib/auth-storage.ts` (224 lines)
- **Primary:** expo-secure-store (encrypted)
- **Fallback:** AsyncStorage (if SecureStore unavailable, e.g., Expo Go)
- **Web:** localStorage
- **Keys:** `hemora-access-token`, `hemora-refresh-token`, `hemora-user`
- **Remember Me:** Memory-only session option (tokens not persisted on app restart)

### 6.8 Route Guards

- Root `_layout.tsx` checks session on mount and after auth-group navigation
- Redirects unauthenticated users to `/(auth)`
- Uses session role to determine route (all roles → `/(home)`)
- Admin screens use `enabled: userRole === "ADMIN"` in TanStack Query to gate data fetching

### 6.9 Screen Completion Status

| Screen | Status | Notes |
|---|---|---|
| Sign-in | ✓ Complete | Email/password, remember me, rate limit handling |
| Sign-up | ✓ Complete | With blood group, phone, location, age |
| Forgot/Reset Password | ✓ Complete | |
| Verify Email | ⚠ Partial | Resend email is TODO (mocked with setTimeout) |
| Main Dashboard | ✓ Complete | 3886 lines — massive all-in-one screen |
| Notifications | ✓ Complete | List, mark read, mark all read |
| Settings | ✓ Complete | Profile edit, push token registration |
| Admin Users | ✓ Complete | List, role change, delete |
| Admin Facilities | ✓ Complete | List, create |
| Admin Campaigns | ✓ Complete | List, create with image upload |
| Admin Forecast | ✓ Complete | All-groups forecast display |
| Admin System | ✓ Complete | Stats + inventory overview |
| Campaign Detail | ✓ Complete | Join campaign, map view |
| Facility Detail | ⚠ Partial | Delete facility is TODO |
| Staff Invitation | ⚠ Partial | Account creation is TODO |

---

## 7. Auth Deep-Dive

### 7.1 Authentication Method

**Custom JWT** (CONFIRMED in code — `hemora-backend/src/lib/auth-jwt.ts`)

- **Library:** `jose` (^5.9.6)
- **Algorithm:** HS256
- **Access token expiry:** 15 minutes
- **Issuer:** `hemora`
- **Audience:** `hemora-mobile`
- **Payload:** `{ sub: userId, email, role, iss, aud, iat, exp }`
- **Secret source:** `JWT_SECRET` env var (dev default: `hemora-dev-jwt-secret-change-in-production`)

### 7.2 Password Handling

- **Library:** `bcryptjs` (^3.0.3)
- **Cost factor:** 12
- **Stored in:** `User.passwordHash` column (nullable — supports Google-only accounts)
- **Min length:** 8 characters (enforced server-side)

### 7.3 Refresh Token Flow

- **Generation:** `createRefreshToken(userId)` — SHA-256 hash stored in `RefreshToken` table
- **Rotation:** `rotateRefreshToken()` — revokes old token, creates new one on each refresh
- **Reuse detection:** If a revoked token is presented, all user sessions are invalidated
- **Expiry:** Stored in `RefreshToken.expiresAt`
- **Revocation:** `revokeRefreshToken()` sets `revokedAt` timestamp
- **Password reset:** Revokes all sessions via `revokeAllUserSessions()`

### 7.4 Google OAuth

- **Endpoint:** `POST /api/auth/google/verify`
- **Flow:** Mobile sends Google ID token → backend verifies via JWKS → creates/finds user
- **JWKS:** Fetched from Google's public key server
- **Storage:** `GoogleAccount` table links `googleSub` to `User`

### 7.5 Email Verification

- **On registration:** 24-hour verification token generated, stored in `User.emailVerificationToken`
- **Email sending:** Via nodemailer (SMTP optional — dev mode logs token to console)
- **Enforcement:** NOT enforced — users can log in without verifying email

### 7.6 Password Reset

- **Flow:** `forgot-password` → SHA-256 hashed token stored for 1 hour → `reset-password` with token
- **Security:** Token hash stored (not plaintext), all sessions revoked on reset
- **Email enumeration protection:** Always returns success message

### 7.7 Rate Limiting

- **Global:** 100 requests per 15 minutes per IP (all endpoints)
- **Auth-specific:** Additional rate limiting on login/register (via `authRateLimit()`)
- **Storage:** In-memory `Map` (not shared across instances)

### 7.8 RBAC Middleware

- **`requireAuth()`:** Verifies JWT, sets `req.user`
- **`requirePermission({ resource: [actions] })`:** Verifies JWT + checks role-permission map
- **Permission map:** 9 resources × multiple actions, 5 roles (see ARCHITECTURE.md matrix)
- **Note:** DONOR role has `requisition:read` and `campaign:read` and `facility:read` permissions in code, but the ARCHITECTURE.md matrix shows DONOR with only `inventory:read` — the code is the source of truth

### 7.9 Migration History

- **Previous:** Supabase Auth (confirmed by HEMORA_AUTHENTICATION_AUDIT.md, migration 0004)
- **Migration commit:** `b92d258` — "custom auth implementation with Google OAuth, RBAC middleware, and routing verification"
- **Migration SQL:** `0004_add_custom_auth/migration.sql` — added `passwordHash`, `emailVerificationToken`, `passwordResetToken`, `RefreshToken` table
- **Legacy files:** `seed-auth.ts` (Supabase Admin API — no longer used)

---

## 8. How to Run

### 8.1 Required Tools

| Tool | Minimum Version | Purpose |
|---|---|---|
| Node.js | 18+ | Backend runtime |
| npm | — | Package manager |
| PostgreSQL | 14+ | Database |
| Python | 3.9+ | AI service |
| Expo Go | — | Mobile testing on device |

### 8.2 Environment Variables

**Backend** (`hemora-backend/.env`):
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — JWT signing secret
- `JWT_REFRESH_SECRET` — Refresh token signing secret
- `AI_SERVICE_URL` — AI service URL (default: `http://localhost:8000`)
- `AI_SERVICE_API_KEY` — API key for AI service auth
- `GOOGLE_CLIENT_ID` — Google OAuth client ID
- `PORT` — Server port (default: 5000)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — Email (optional)
- `APP_BASE_URL` — App URL for email links (optional)
- `CORS_ORIGINS` — Production CORS origins (optional)
- `NODE_ENV` — Environment (optional)

**Mobile** (`hemora-mobile/.env`):
- `EXPO_PUBLIC_API_URL` — Backend API URL (e.g., `http://192.168.1.100:5000`)

**AI Service** (environment):
- `AI_SERVICE_API_KEY` — API key for authentication

### 8.3 Start Order

1. **PostgreSQL:** Create `hemora` database
2. **Backend:**
   ```bash
   cd hemora-backend
   npm install
   cp .env.example .env  # edit with your settings
   npx prisma generate
   npx prisma migrate dev
   npm run db:seed
   npm run dev  # starts on http://localhost:5000
   ```
3. **AI Service** (optional):
   ```bash
   cd hemora-ai
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python3 main.py  # starts on http://localhost:8000
   ```
4. **Mobile:**
   ```bash
   cd hemora-mobile
   npm install
   # .env already exists with EXPO_PUBLIC_API_URL
   npm start  # scan QR with Expo Go
   ```

### 8.4 Build/Health Checks

- **Backend health:** `GET /health` → `{ status: "ok", service: "hemora-backend" }`
- **AI health:** `GET /health` → `{ status: "ok", service: "hemora-ai" }`
- **Backend tests:** `npm test` (Jest, requires DB connection)
- **Mobile tests:** `npm test` (Jest, passWithNoTests)
- **Mobile lint:** `npm run lint` (ESLint)

---

## 9. Risks and Gaps

### 9.1 Security Concerns

| Severity | Issue | Location | Details |
|---|---|---|---|
| **HIGH** | Default JWT secrets | `auth-jwt.ts:6-7` | Dev defaults are hardcoded fallbacks. If env vars are not set, the app uses weak defaults. |
| **MEDIUM** | In-memory rate limiting | `rate-limit.middleware.ts` | Rate limit store is an in-memory `Map` — not shared across process restarts or multiple instances. |
| **MEDIUM** | Email not enforced | `auth.routes.ts` | Users can log in without verifying email. No guard blocks unverified users. |
| **MEDIUM** | 403 returns empty array | `api.ts:72-77` | Mobile silently returns `[]` on 403 instead of informing the user — masks permission errors. |
| **LOW** | `pushToken` in userSummary | `auth.routes.ts:25` | The `/me` endpoint leaks the user's push token in the response. |
| **LOW** | AI service open in dev | `main.py:31-32` | If `AI_SERVICE_API_KEY` is not set, the AI service allows unauthenticated access. |

### 9.2 Code Quality Issues

| Issue | Location | Details |
|---|---|---|
| **Massive file** | `hemora-mobile/src/app/(home)/index.tsx` | 3,886 lines — single file handles the entire dashboard for all roles. Should be split into role-specific components. |
| **Massive file** | `hemora-backend/src/routes/prototype.routes.ts` | 1,622 lines with 39 endpoints — should be split into route modules (inventory, requisitions, campaigns, etc.). |
| **TODO** | `staff-invitation.tsx:45` | Staff account creation not implemented |
| **TODO** | `verify-email.tsx:23` | Resend verification email not implemented |
| **TODO** | `facilities/[id].tsx:109` | Facility deletion not implemented |
| **Legacy code** | `seed-auth.ts` | Supabase Auth seed script — no longer used after migration |
| **Outdated doc** | `HEMORA_AUTHENTICATION_AUDIT.md` | Describes Supabase Auth architecture — project has migrated to custom JWT |
| **Comment mismatch** | `seed.ts:22` | Comment says "Argon2id" but code uses `bcrypt` |
| **Role fallback** | `auth-client.ts:39` | If role fetch fails, falls back to DONOR — could mask auth failures |

### 9.3 Missing Tests

- **Backend:** Only auth, distribution, and permissions tests exist (3 test files). No tests for inventory, requisitions, campaigns, forecast, or other endpoints.
- **Mobile:** Jest configured with `passWithNoTests` — no meaningful tests found.
- **AI:** No tests for model prediction or data pipeline.

### 9.4 Missing Error Handling

- Backend catch blocks mostly log and return generic "Internal server error" — no request IDs or correlation for debugging.
- No global error handler middleware in Express.

### 9.5 Deployment Gaps

- No Dockerfile or docker-compose for local development.
- Render deployment documented but no CI/CD pipeline visible.
- No environment-specific configuration (dev/staging/prod).

---

## 10. UNKNOWNS and Questions

1. **PostgreSQL instance:** Is there a running local PostgreSQL instance with the `hemora` database already created and migrated? The seed script requires a live DB connection.

2. **SMTP configuration:** Is email sending configured? Without SMTP, email verification and password reset tokens are only logged to the console.

3. **AI service status:** Is the AI service currently running? The backend falls back to heuristic predictions if it's offline, but the model may need retraining.

4. **Google OAuth:** Is `GOOGLE_CLIENT_ID` configured? Google sign-in appears implemented but may not work without a valid client ID.

5. **Cloudinary:** Is Cloudinary configured for campaign image uploads? The backend imports it but uploads may fail without credentials.

6. **Production deployment:** Is the app deployed anywhere? RENDER_DEPLOYMENT.md suggests Render deployment, but the status is unknown.

7. **Database state:** Has the seed script been run? The app expects demo accounts and inventory data to exist.

8. **Mobile build:** Has the app been built with EAS for production? Only dev-client builds are configured.

9. **Data privacy:** As an academic project with Zambian hospital names and phone numbers in seed data, are there any data privacy considerations?

10. **Capstone deadline:** When is the project due? This affects priority of remaining TODOs and gaps.
