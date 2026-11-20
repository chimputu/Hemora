# Phase 10 — Administration and Reporting

## Delivery Steps

### ✓ Step 1: Add admin and facility-admin endpoints to backend
Add three new backend endpoints to support administration and reporting features.
- Add `GET /api/hemora/users` to `prototype.routes.ts` that returns all users with selected fields (id, name, email, role, bloodGroup, facilityId, eligible, createdAt), ordered by createdAt descending. Requires `user: ["list"]` permission.
- Add `GET /api/hemora/stats` that returns aggregated system statistics: totalUsers, usersByRole (count per role), totalFacilities, totalBloodUnits, lowStockCount, requisitionsByStatus (count per status), and totalCampaigns. Requires `inventory: ["read"]` permission.
- Add `GET /api/hemora/facilities/:id/requisitions` that returns requisitions filtered by facilityId, ordered by createdAt descending, with requester info included. Requires `requisition: ["read"]` permission.
- Verify backend TypeScript compilation passes.

### ✓ Step 2: Build admin dashboard with system stats, user list, and facility overview
Replace the static admin dashboard with a data-driven screen connected to the API.
- Refactor `admin.tsx` to fetch system stats via `useQuery` calling `GET /api/hemora/stats`.
- Display real stats: total users, facilities, blood units, and low-stock alerts.
- Fetch all users via `useQuery` calling `GET /api/hemora/users` and display a user list with role badges, email, blood group, and facility info.
- Add role filter pills to filter the user list.
- Fetch facilities via `useQuery` calling `GET /api/hemora/facilities` and display facility cards with name, type, address, phone, and staff count.
- Show recent system activity (latest requisitions from `GET /api/hemora/requisitions`).
- Replace all "—" placeholders with real values or EmptyState components.
- Add loading spinner, error state with retry button.
- Remove all "Coming Soon" badges.
- Verify mobile TypeScript compilation passes.

### ✓ Step 3: Build facility admin dashboard with staff, requisitions, and usage reports
Replace the static facility admin dashboard with a data-driven screen connected to the API.
- Refactor `facility-admin.tsx` to fetch the current user's facility from `GET /api/hemora/me`.
- Fetch facility requisitions via `useQuery` calling `GET /api/hemora/facilities/:id/requisitions`.
- Display facility overview stats: staff count, active requests, and total blood usage (units requested).
- Fetch all users via `useQuery` calling `GET /api/hemora/users` and filter by facility to display a staff list with role badges.
- Display requisition history with status badges, patient info, urgency, blood group/component, units, and dates.
- Add requisition status filter tabs (All, Pending, Approved, Rejected, Dispatched).
- Display blood usage summary showing total units requested per blood group.
- Replace all "—" placeholders with real values or EmptyState components.
- Add loading and error states.
- Remove all "Coming Soon" badges.
- Verify mobile TypeScript compilation passes.
