# Phase 11 — Integration and Testing

## Delivery Steps

### ✓ Step 1: Verify backend compilation and all endpoints
Run TypeScript compilation and verify all backend endpoints are functional.
- Run `npx tsc --noEmit` in `hemora-backend/` and confirm 0 errors.
- Start the backend server and test each endpoint group:
  - Auth: `POST /api/hemora/auth/sign-in`, `GET /api/hemora/me`
  - Inventory: `GET /api/hemora/inventory`, `PATCH /api/hemora/inventory/:bloodGroup`, `POST /api/hemora/inventory`
  - Requisitions: `GET /api/hemora/requisitions`, `GET /api/hemora/requisitions/my`, `POST /api/hemora/requisitions`, `PATCH /api/hemora/requisitions/:id/status`
  - Campaigns: `GET /api/hemora/campaigns`, `POST /api/hemora/campaigns`
  - Invitations: `PATCH /api/hemora/invitations/:id/respond`
  - Forecast: `POST /api/hemora/forecast`, `POST /api/hemora/forecast/all`, `GET /api/hemora/forecast/model-info`
  - Admin: `GET /api/hemora/users`, `GET /api/hemora/stats`, `GET /api/hemora/facilities/:id/requisitions`
  - Facilities: `GET /api/hemora/facilities`
- Report any endpoint failures.

### ✓ Step 2: Verify mobile compilation and all dashboards
Run TypeScript compilation and verify all 6 dashboards render without errors.
- Run `npx tsc --noEmit` in `hemora-mobile/` and confirm 0 errors.
- Start the Expo dev server and verify each dashboard loads:
  - Donor dashboard (`donor.tsx`) — shows profile, invitations, eligibility.
  - Bank Manager dashboard (`bank-manager.tsx`) — shows inventory, requisitions, forecasts, campaigns.
  - Doctor dashboard (`doctor.tsx`) — shows requisition creation and tracking.
  - Nurse dashboard (`nurse.tsx`) — shows requisition creation and tracking.
  - Admin dashboard (`admin.tsx`) — shows system stats, users, facilities.
  - Facility Admin dashboard (`facility-admin.tsx`) — shows staff, requisitions, usage.
- Report any rendering errors or missing data.

### ✓ Step 3: Test end-to-end workflows across all roles
Walk through the core workflows using demo accounts to verify cross-module functionality.
- **Donor workflow**: Login as donor → view profile → accept/decline campaign invitation → verify invitation status updates.
- **Bank Manager workflow**: Login as bank manager → view inventory → adjust stock → view requisitions → approve/reject → view forecast → create campaign → verify invitations sent.
- **Doctor workflow**: Login as doctor → create blood request → view request status → track approval.
- **Nurse workflow**: Login as nurse → create blood request → view request list.
- **Admin workflow**: Login as admin → view system stats → view user list → view facilities → view activity.
- **Facility Admin workflow**: Login as facility admin → view staff → view requisitions → view blood usage.
- Document any broken workflows or errors.

### ✓ Step 4: Fix any issues found during testing
Address any errors, missing data, or broken workflows discovered in Steps 1-3.
- Fix TypeScript errors, runtime errors, or missing API responses.
- Ensure all dashboards display real data for demo accounts.
- Verify the AI service is reachable from the backend (if running).
- Re-run compilation checks after fixes.

### ✓ Step 5: Produce integration test report
Summarize all test results, document passing/failing workflows, and list outstanding issues.
- Create a test report listing each workflow and its status (pass/fail).
- Document any remaining issues or limitations.
- Confirm the application is ready for Phase 12 (Demonstration Preparation).
