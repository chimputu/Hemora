---
sessionId: session-261120-141227-1uak
---

# HEMORA Implementation Plan

## Overview
Implement the complete HEMORA mobile app UI based on the design documentation in `docs/design-system/`. All 13 design docs are approved and ready.

## Scope
Full implementation of all screens, components, navigation, and branding across all 6 user roles.

---

## Implementation Phases

### ✓ Step 1: Phase 1 — Design Tokens Enhancement
Enhance theme.ts with missing tokens (lightRose, display, statValue), verify all tokens match design docs.

### ✓ Step 2: Phase 2 — Core Component Library (Part 1)
Build foundational components: CampaignCard, DonationCard, BloodGroupCard, RequisitionCard, InventoryCard, NotificationItem, UserCard, FilterTabs, ProgressBar, FAB, SettingsItem, ProfileHeader, BloodGroupBadge, UrgencyBadge, RoleBadge.

### ✓ Step 3: Phase 2 — Core Component Library (Part 2)
Build remaining components: FAQItem, RequestTimeline, ScreeningForm, CollectionStep, ChartPlaceholder, PeriodSelector, PermissionToggle, StockLevelBar, ForecastCard, RecommendationCard, StaffCard, FacilityCard, BloodBankCard, InvitationCard, AuditLogItem. Layout components: ScreenLayout, ContentWrapper, SectionHeader.

### ✓ Step 4: Phase 3 — Authentication Screens
Build welcome screen, update sign-in with Google Sign-In, update sign-up, staff invitation, reset password, email verification. Update auth layout and root layout.

### * Step 5: Phase 4 — Navigation System Integration
Integrate bottom navigation and side drawer into all dashboards, create role-specific navigation configs, update main layout.

### Step 6: Phase 5 — Donor Application (Part 1)
Build donor dashboard (redesign), campaigns list, campaign details, donations list, donation details.

### Step 7: Phase 5 — Donor Application (Part 2)
Build eligibility screen, appointments screen, profile screen, notifications screen, settings screen, help & support screen.

### Step 8: Phase 6 — Doctor & Nurse Application (Part 1)
Build doctor dashboard (redesign), create blood request, blood availability, request tracking, request details.

### Step 9: Phase 6 — Doctor & Nurse Application (Part 2)
Build nurse dashboard (redesign), donor screening workflow, donation collection workflow, donation records.

### Step 10: Phase 7 — Blood Bank & Facility Application (Part 1)
Build bank manager dashboard (redesign), blood inventory, blood requests, donation management.

### Step 11: Phase 7 — Blood Bank & Facility Application (Part 2)
Build campaign management, forecasting dashboard, reports. Facility dashboard (redesign), facility requests, staff coordination.

### Step 12: Phase 8 — System Administrator Application (Part 1)
Build admin dashboard (redesign), user management, user details, staff invitations, create invitation.

### Step 13: Phase 8 — System Administrator Application (Part 2)
Build facility management, blood bank management, audit logs, reports, system configuration, access management.

### Step 14: Phase 9 — Polish, Testing & QA
Final review, fix inconsistencies, test all navigation flows, verify all screen states, ensure accessibility compliance.

---

## Dependencies
- Phase 1 (tokens) → All phases
- Phase 2 (components) → Phases 3-8
- Phase 3 (auth) → Standalone
- Phase 4 (navigation) → Phases 5-8
- Phases 5-8 are independent after phases 1-4

## Notes
- Follow design docs in `docs/design-system/` strictly
- Use existing components where they match the design
- Create new components only when needed
- Maintain TypeScript types throughout
- No backend changes - use existing API endpoints
- Mock data where API endpoints don't exist yet
