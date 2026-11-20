# Phase 9 — Donor Mobilisation Module

## Requirements

### Overview

Phase 9 implements the **Donor Mobilisation Module** — enabling the blood bank manager to create mobilisation campaigns, send invitations to eligible donors, and track campaign effectiveness. The bank manager dashboard will replace any campaign-related placeholders with working functionality.

### Goals

- Allow the bank manager to create blood donation campaigns targeting specific blood groups.
- Automatically send invitations to eligible donors matching the target blood group.
- Display campaign list with status, invitation counts, and effectiveness metrics.
- Show campaign effectiveness stats (sent, accepted, declined invitations).

### User Stories

- As a blood bank manager, I want to create a donation campaign so I can mobilize donors for a specific blood group.
- As a blood bank manager, I want to see campaign effectiveness so I can plan future mobilization efforts.
- As a blood bank manager, I want to see which donors accepted or declined invitations.

### Scope

**In Scope:**
- Campaign creation form with title, description, target blood group, target units, start/end dates.
- Automatic invitation generation for eligible donors matching the target blood group.
- Campaign list with status badges, invitation counts, and effectiveness metrics.
- Campaign effectiveness stats: sent, accepted, declined counts.
- Campaign detail view showing invitation list with donor names and statuses.
- Loading, error, and empty states.

**Out of Scope:**
- SMS/email notification sending (prototype only creates invitation records).
- Campaign scheduling or auto-expiry.
- Donor-side campaign UI (already done in Phase 5).

## Technical Design

### Current Implementation

**Backend (`hemora-backend/src/routes/prototype.routes.ts`):**
- `GET /campaigns` (line 337) — returns all campaigns with invitations and donor details. Requires `requisition: ["read"]` permission.
- **Missing:** No endpoint to create a campaign with invitations.

**Permissions (`hemora-backend/src/lib/permissions.ts`):**
- No campaign-related permissions in the RBAC statement. BANK_MANAGER uses `requisition: ["read"]` for GET /campaigns.

**Prisma Schema:**
- `Campaign` model: title, description, bloodGroup (optional), targetUnits, status (DRAFT/ACTIVE/COMPLETED/CANCELLED), startDate, endDate, createdBy.
- `CampaignInvitation` model: campaignId, donorId, status (PENDING/ACCEPTED/DECLINED/EXPIRED), sentAt, respondedAt.

**Seed Data:**
- 2 campaigns: "O+ Blood Drive — November 2024" (targeting O_POS) and "General Donor Mobilisation — December 2024" (no specific blood group).
- Invitations created for all donors for both campaigns.

**Bank Manager Dashboard (`bank-manager.tsx`):**
- 981 lines, fully functional inventory, requisitions, and AI forecasting sections.
- No campaign management section yet.

### Key Decisions

- Add a `campaign: ["create", "read"]` permission to the RBAC statement and assign it to BANK_MANAGER and ADMIN roles.
- The POST /campaigns endpoint creates the campaign and automatically generates invitations for all eligible donors matching the target blood group (or all eligible donors if no blood group is specified).
- Use the existing GET /campaigns endpoint for fetching campaign data.
- Add a campaign section to the bank manager dashboard with a creation modal and campaign list.
- Show campaign effectiveness metrics: total invitations, accepted, pending, declined counts.

### Proposed Changes

**Backend — New endpoint in `prototype.routes.ts`:**
- Add `POST /api/hemora/campaigns` — creates a campaign and auto-generates invitations for eligible donors. Accepts `{ title, description?, bloodGroup?, targetUnits?, startDate?, endDate? }`. Sets status to ACTIVE, createdBy to req.user.id. Then finds all eligible donors (role=DONOR, eligible=true) matching the bloodGroup (or all donors if bloodGroup is null) and creates CampaignInvitation records for each.
- Require `campaign: ["create"]` permission.

**Backend — Update permissions:**
- Add `campaign: ["create", "read"]` to the RBAC statement.
- Assign `campaign: ["create", "read"]` to BANK_MANAGER and ADMIN roles.
- Update `GET /campaigns` to require `campaign: ["read"]` instead of `requisition: ["read"]`.

**Mobile — Add campaign section to `bank-manager.tsx`:**
- Add a "Donor Mobilisation" section with a "New Campaign" button.
- Add a modal form for creating campaigns with fields for title, description, target blood group (pill selector), target units, start date, and end date.
- Fetch campaigns via `useQuery` calling `GET /api/hemora/campaigns`.
- Display campaign cards with title, status badge, target blood group, target units, dates, and invitation effectiveness stats.
- Show invitation breakdown: Sent, Accepted, Pending, Declined counts.
- Add campaign status filter tabs (All, Active, Draft, Completed, Cancelled).
- Replace loading/error states with proper UI.

### Components Affected

| File | Change |
|---|---|
| `hemora-backend/src/lib/permissions.ts` | Add campaign permissions to statement and roles |
| `hemora-backend/src/routes/prototype.routes.ts` | Add POST /campaigns endpoint, update GET /campaigns permission |
| `hemora-mobile/src/app/(main)/_dashboard/bank-manager.tsx` | Add Donor Mobilisation section with campaign creation and list |

## Delivery Steps

### ✓ Step 1: Add campaign permissions and POST /campaigns endpoint
Add campaign management permissions and a backend endpoint to create campaigns with auto-invitations.
- Add `campaign: ["create", "read"]` to the RBAC statement in `permissions.ts`.
- Assign `campaign: ["create", "read"]` to BANK_MANAGER and ADMIN roles.
- Add `POST /api/hemora/campaigns` to `prototype.routes.ts` that creates a campaign and auto-generates invitations for eligible donors.
- Update `GET /campaigns` to require `campaign: ["read"]` permission.
- Verify backend TypeScript compilation passes.

### ✓ Step 2: Build Donor Mobilisation UI in bank manager dashboard
Add campaign creation and tracking to the bank manager dashboard.
- Add a "Donor Mobilisation" section to `bank-manager.tsx` with a "New Campaign" button.
- Add a modal form for creating campaigns with fields for title, description, target blood group, target units, start date, and end date.
- Fetch campaigns via `useQuery` calling `GET /api/hemora/campaigns`.
- Display campaign cards with status badges, target blood group, target units, dates, and invitation effectiveness stats (Sent, Accepted, Pending, Declined).
- Add campaign status filter tabs (All, Active, Draft, Completed, Cancelled).
- Submit the form via `useMutation` calling `POST /api/hemora/campaigns`.
- Add loading and error states.
- Verify mobile TypeScript compilation passes.
