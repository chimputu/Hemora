---
sessionId: session-261119-074859-1i6w
---

# Phase 6 — Blood Bank Module

## Requirements

### Overview

Phase 6 implements the **Blood Bank Module** — the second functional role-specific module. The Blood Bank Manager dashboard will display real inventory data across all 8 blood groups and 4 components, show low-stock warnings, allow stock adjustments, and display pending requisitions with approve/reject actions. All "Coming Soon" placeholders will be replaced with working functionality.

### Goals

- Connect the bank manager dashboard to real API data for inventory and requisitions.
- Display inventory levels for all blood groups and components with low-stock warnings.
- Allow the bank manager to adjust stock levels (add/remove units).
- Display pending requisitions with approve/reject actions.
- Provide clear loading, empty, and error states.

### User Stories

- As a blood bank manager, I want to see inventory levels for all blood groups so I can monitor stock.
- As a blood bank manager, I want to see low-stock warnings so I can prioritize restocking.
- As a blood bank manager, I want to adjust stock levels when blood is received or expired.
- As a blood bank manager, I want to review and approve or reject blood requisitions from hospitals.

### Scope

**In Scope:**
- Inventory overview with real data from `GET /api/hemora/inventory`.
- Inventory grid showing all 8 blood groups × 4 components (32 records).
- Low-stock warnings when units fall below `minThreshold`.
- Stock adjustment (add/remove units) via `PATCH /api/hemora/inventory/:bloodGroup`.
- Requisition list with real data from `GET /api/hemora/requisitions`.
- Approve/reject requisition via `PATCH /api/hemora/requisitions/:id/status`.
- Filter inventory by blood group.
- Filter requisitions by status (Pending, Approved, Rejected, Dispatched).

**Out of Scope:**
- AI forecasting dashboard (Phase 8).
- Campaign creation (Phase 9).
- Transfusion logging (Phase 7).
- Expiry date management beyond display (prototype uses seeded expiry dates).

## Technical Design

### Current Implementation

**Backend (`hemora-backend/src/routes/prototype.routes.ts`):**
- `GET /inventory` (line 10) — returns all BloodInventory records, requires `inventory: ["read"]` permission.
- `PATCH /inventory/:bloodGroup` (line 23) — updates units by delta for a blood group/component pair, requires `inventory: ["update"]` permission.
- `GET /requisitions` (line 49) — returns all requisitions with requester and facility details, requires `requisition: ["read"]` permission.
- `PATCH /requisitions/:id/status` (line 106) — updates requisition status (APPROVED/DISPATCHED/REJECTED), deducts stock on DISPATCHED, requires `requisition: ["approve"]` permission.

**Mobile (`hemora-mobile/src/app/(main)/_dashboard/bank-manager.tsx`):**
- 127 lines, static dashboard with hardcoded "—" placeholders.
- Shows Total Units, Low Stock, Pending Requests, and Forecast as "—".
- Three module cards: "Blood Inventory", "Requisition Approvals", "AI Forecasting" — all marked "Coming Soon".
- No API calls, no TanStack Query usage.

**Permissions (`hemora-backend/src/lib/permissions.ts`):**
- BANK_MANAGER has: `inventory: ["read", "update", "dispatch"]`, `requisition: ["read", "approve", "reject"]`, `forecast: ["view", "trigger"]`.

**Seed Data:**
- 32 BloodInventory records (8 blood groups × 4 components) with realistic stock levels.
- 5 Requisitions with various statuses (PENDING, APPROVED, REJECTED).

### Key Decisions

- Follow the Phase 5 donor dashboard pattern: TanStack Query for data fetching, `hemoraFetch` for API calls, `EmptyState` for empty/error states.
- Keep the bank manager dashboard as a single screen with sections for inventory and requisitions — no separate sub-screens for the prototype.
- Use a compact inventory grid layout showing blood group rows with component columns to fit 32 records on screen.
- Add a `POST /inventory` backend endpoint for adding new inventory records (currently only PATCH exists for updating existing records).
- Filter inventory by blood group using a horizontal scrollable pill selector.
- Filter requisitions by status using tabs.

### Proposed Changes

**Backend — New endpoint in `prototype.routes.ts`:**
- Add `POST /api/hemora/inventory` — creates a new BloodInventory record using `upsert` with the unique constraint on `[bloodGroup, component]`. Accepts `{ bloodGroup, component, units, minThreshold?, expiresAt? }`. Requires `inventory: ["update"]` permission. This allows adding stock for a blood group/component pair that doesn't exist yet.

**Mobile — Refactor `bank-manager.tsx`:**
- Replace static content with `useQuery` hooks calling `hemoraFetch("/api/hemora/inventory")` and `hemoraFetch("/api/hemora/requisitions")`.
- Display inventory summary stats: total units across all groups, low-stock count, pending requisitions count.
- Render an inventory grid with blood group rows and component columns, showing units and low-stock warnings.
- Add a blood group filter using horizontal scrollable pills.
- Add stock adjustment buttons (+/-) for each inventory cell that call the PATCH endpoint via `useMutation`.
- Render requisitions with status badges, patient info, urgency, and approve/reject buttons for PENDING requisitions.
- Add requisition status filter tabs (All, Pending, Approved, Rejected, Dispatched).
- Show `EmptyState` when no requisitions match the filter.
- Remove all "Coming Soon" badges.
- Keep the "AI Forecasting" card as a placeholder for Phase 8 (it's out of scope for Phase 6).

### Components Affected

| File | Change |
|---|---|
| `hemora-backend/src/routes/prototype.routes.ts` | Add POST `/inventory` endpoint |
| `hemora-mobile/src/app/(main)/_dashboard/bank-manager.tsx` | Full refactor: real inventory data, stock management, requisition approvals |

### Data Models

**Inventory Record (from API):**
```typescript
interface BloodInventory {
  id: string;
  bloodGroup: string; // e.g. "O_POS"
  component: string; // e.g. "WHOLE_BLOOD", "Packed_RBC", "PLASMA", "PLATELETS"
  units: number;
  minThreshold: number;
  expiresAt: string | null;
  updatedAt: string;
}
```

**Requisition Record (from API):**
```typescript
interface Requisition {
  id: string;
  requesterId: string;
  requester: { name: string; role: string; facilityId: string | null };
  patientName: string | null;
  patientRef: string | null;
  bloodGroup: string;
  component: string;
  unitsNeeded: number;
  urgency: string; // "ROUTINE", "URGENT", "EMERGENCY"
  status: string; // "PENDING", "APPROVED", "DISPATCHED", "REJECTED"
  clinicalNote: string | null;
  facilityId: string | null;
  facility: { name: string } | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}
```

## Delivery Steps

### ✓ Step 1: Add POST /inventory endpoint to backend
Add an endpoint to create or update inventory records so the bank manager can add stock for any blood group/component pair.
- Add `POST /api/hemora/inventory` to `prototype.routes.ts` in the backend.
- Accept `{ bloodGroup, component, units, minThreshold?, expiresAt? }` in the request body.
- Use Prisma `upsert` with the unique constraint `bloodGroup_component` to create or update the record.
- Return the updated inventory record.
- Require `inventory: ["update"]` permission via `requirePermission`.

### ✓ Step 2: Build bank manager dashboard with real inventory and requisition data
Replace the static bank manager dashboard with a data-driven screen connected to the API.
- Refactor `bank-manager.tsx` to fetch inventory via `useQuery` calling `hemoraFetch("/api/hemora/inventory")`.
- Fetch requisitions via `useQuery` calling `hemoraFetch("/api/hemora/requisitions")`.
- Display inventory summary stats: total units, low-stock count, and pending requisitions count.
- Render an inventory grid with blood group rows and component columns, showing units and low-stock warnings (red badge when units < minThreshold).
- Add a blood group filter using horizontal scrollable pills to filter the grid by selected blood group.
- Add stock adjustment (+/-) buttons for each inventory cell that call `PATCH /api/hemora/inventory/:bloodGroup` via `useMutation` with a confirmation dialog.
- Render requisitions with status badges, patient info, urgency level, and clinical notes.
- Add requisition status filter tabs (All, Pending, Approved, Rejected, Dispatched).
- Add Approve/Reject buttons for PENDING requisitions that call `PATCH /api/hemora/requisitions/:id/status` via `useMutation` with a confirmation dialog.
- Replace all "—" placeholders with real values or proper `EmptyState` components.
- Add loading state with a spinner and error state with a retry button.
- Remove all "Coming Soon" badges except for the AI Forecasting card (Phase 8).
- Invalidate and refetch queries after mutations to keep data fresh.