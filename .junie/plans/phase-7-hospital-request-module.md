---
sessionId: session-261119-074859-1i6w
---

# Phase 7 — Hospital Request Module

## Requirements

### Overview

Phase 7 implements the **Hospital Request Module** — enabling doctors and nurses to create blood requisitions, track their status, and view patient and clinical details. Both the doctor and nurse dashboards currently show static "Coming Soon" placeholders and will be replaced with fully functional, data-driven screens.

### Goals

- Allow doctors and nurses to create blood requisitions with patient and clinical information.
- Display a list of the user's requisitions with real-time status tracking.
- Show requisition overview stats (pending, approved, rejected counts).
- Provide urgency-based visual indicators (routine, urgent, emergency).
- Support filtering requisitions by status.

### User Stories

- As a doctor, I want to create a blood request for a patient so the blood bank can prepare the required blood.
- As a nurse, I want to track the status of blood requests so I know when blood is ready for dispatch.
- As a doctor/nurse, I want to see how many requests are pending, approved, or rejected at a glance.

### Scope

**In Scope:**
- New blood request creation form with patient name, patient reference, blood group, component, units, urgency, and clinical notes.
- "My Requisitions" list filtered by the current user, showing status, urgency, patient info, and timestamps.
- Requisition overview stats (Pending, Approved, Rejected counts).
- Status filter tabs (All, Pending, Approved, Rejected, Dispatched).
- Loading, error, and empty states.
- Both doctor and nurse dashboards get the same functionality (they share the same requisition permissions).

**Out of Scope:**
- Requisition approval/rejection (handled by bank manager in Phase 6).
- Transfusion logging (nurse functionality, deferred).
- Bulk requisition operations.
- Print/export requisition reports.

## Technical Design

### Current Implementation

**Backend (`hemora-backend/src/routes/prototype.routes.ts`):**
- `GET /requisitions` (line 87) — returns all requisitions with requester and facility included. Requires `requisition: ["read"]` permission.
- `POST /requisitions` (line 104) — creates a new requisition with `requesterId` set to `req.user.id`. Accepts bloodGroup, component, unitsNeeded, urgency, patientName, patientRef, clinicalNote, facilityId. Requires `requisition: ["create"]`.
- `PATCH /requisitions/:id/status` (line 144) — updates requisition status (APPROVED, REJECTED, DISPATCHED). Requires `requisition: ["approve"]`.
- **Missing:** No endpoint to filter requisitions by the current user ("my requisitions").

**Mobile Doctor Dashboard (`hemora-mobile/src/app/(main)/_dashboard/doctor.tsx`):**
- 110 lines, static dashboard with hardcoded "—" placeholders for stats.
- Two module cards: "New Blood Request" and "My Requests" — both marked "Coming Soon".
- No API calls, no TanStack Query usage.

**Mobile Nurse Dashboard (`hemora-mobile/src/app/(main)/_dashboard/nurse.tsx`):**
- Identical to doctor dashboard — 110 lines, same static structure.

**RBAC (`hemora-backend/src/lib/permissions.ts`):**
- DOCTOR: `requisition: ["create", "read", "approve"]`, `inventory: ["read"]`
- NURSE: `requisition: ["create", "read"]`, `inventory: ["read"]`, `transfusion: ["create", "read"]`

### Key Decisions

- Add a single `GET /requisitions/my` backend endpoint that returns only the current user's requisitions. This avoids fetching all requisitions client-side and filtering, which is inefficient and exposes other users' data.
- Share the same request creation form and request list component between doctor and nurse dashboards by keeping both dashboards structurally similar — they differ only in the role badge and hero text.
- Use TanStack Query for data fetching with automatic invalidation after mutations.
- Use a modal form for creating requisitions rather than a separate screen to keep the workflow compact.

### Proposed Changes

**Backend — New endpoint in `prototype.routes.ts`:**
- Add `GET /api/hemora/requisitions/my` — returns requisitions where `requesterId` matches `req.user.id`, ordered by `createdAt` descending, with facility included. Requires `requisition: ["read"]` permission.

**Mobile — Refactor `doctor.tsx`:**
- Fetch user's requisitions via `useQuery` calling `GET /api/hemora/requisitions/my`.
- Display requisition overview stats: pending count, approved count, rejected count.
- Add a "New Request" button that opens a modal form with fields for patient name, patient reference, blood group (pill selector), component (pill selector), units (numeric input), urgency (ROUTINE/URGENT/EMERGENCY pills), and clinical notes (multiline text input).
- Submit the form via `useMutation` calling `POST /api/hemora/requisitions`.
- Render requisitions with status badges, urgency indicators, patient info, blood group/component, units, clinical notes, and creation date.
- Add status filter tabs (All, Pending, Approved, Rejected, Dispatched).
- Replace all "—" placeholders with real values or `EmptyState` components.
- Add loading spinner, error state with retry button.
- Remove all "Coming Soon" badges.

**Mobile — Refactor `nurse.tsx`:**
- Same structure as doctor dashboard but with "NURSE" badge and "Nurse Dashboard" title.
- Same requisition creation and tracking functionality.

### Components Affected

| File | Change |
|---|---|
| `hemora-backend/src/routes/prototype.routes.ts` | Add `GET /requisitions/my` endpoint |
| `hemora-mobile/src/app/(main)/_dashboard/doctor.tsx` | Full refactor: request creation form, my requisitions list, stats |
| `hemora-mobile/src/app/(main)/_dashboard/nurse.tsx` | Full refactor: same as doctor but with nurse branding |

## Delivery Steps

### ✓ Step 1: Add GET /requisitions/my endpoint to backend
Add an endpoint to return only the current user's requisitions so doctors and nurses can track their own requests.
- Add `GET /api/hemora/requisitions/my` to `prototype.routes.ts` in the backend.
- Filter requisitions where `requesterId` equals `req.user.id`.
- Order by `createdAt` descending.
- Include the `facility` relation in the response.
- Require `requisition: ["read"]` permission via `requirePermission`.

### ✓ Step 2: Build doctor dashboard with request creation and tracking
Replace the static doctor dashboard with a data-driven screen connected to the API.
- Refactor `doctor.tsx` to fetch the user's requisitions via `useQuery` calling `hemoraFetch("/api/hemora/requisitions/my")`.
- Display requisition overview stats: pending count, approved count, and rejected count.
- Add a "New Request" button that opens a modal form with fields for patient name, patient reference, blood group (pill selector), component (pill selector), units (numeric input), urgency (ROUTINE/URGENT/EMERGENCY pills), and clinical notes (multiline text input).
- Submit the form via `useMutation` calling `POST /api/hemora/requisitions` with automatic query invalidation.
- Render requisitions with status badges, urgency indicators, patient info, blood group/component, units, clinical notes, and creation date.
- Add status filter tabs (All, Pending, Approved, Rejected, Dispatched) to filter the displayed list.
- Replace all "—" placeholders with real values or proper `EmptyState` components.
- Add loading state with a spinner and error state with a retry button.
- Remove all "Coming Soon" badges.

### ✓ Step 3: Build nurse dashboard with request creation and tracking
Replace the static nurse dashboard with the same data-driven functionality as the doctor dashboard.
- Refactor `nurse.tsx` with the same structure as the doctor dashboard but with "NURSE" badge and "Nurse Dashboard" title.
- Fetch the user's requisitions via `useQuery` calling `hemoraFetch("/api/hemora/requisitions/my")`.
- Display requisition overview stats: pending count, approved count, and rejected count.
- Add the same "New Request" modal form with all fields.
- Submit via `useMutation` calling `POST /api/hemora/requisitions`.
- Render requisitions with status badges, urgency indicators, and filtering.
- Replace all "—" placeholders with real values or `EmptyState` components.
- Add loading and error states.
- Remove all "Coming Soon" badges.
