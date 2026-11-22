---
sessionId: session-261122-005641-1lj2
---

# HEMORA — Comprehensive Role-Based Functional Verification, Security Audit & Penetration Testing

## Overview
This is a **read-only audit and testing plan** for the HEMORA Blood Donation and AI-Based Blood Forecasting System. The goal is to establish whether the application works correctly, securely, and consistently according to each authenticated user's assigned role.

## Scope

**In Scope:**
- Complete system discovery and architecture mapping
- Role-by-role functional testing (DONOR, NURSE, DOCTOR, MANAGER, ADMIN)
- Role permission matrix construction with evidence
- Authorised penetration testing (authentication, authorization, API security, input validation, database, mobile, AI service)
- Business logic and data integrity verification
- Frontend-backend consistency audit
- Automated test execution (existing tests, TypeScript checks, linting)
- Vulnerability register with severity classification
- Final deployment assessment

**Out of Scope:**
- Modifying application source code
- Modifying database schema
- Running destructive migrations
- Deleting or corrupting existing records
- Changing user roles or permissions
- Denial-of-service or destructive brute-force testing
- Testing against external systems without authorisation

## Methodology
1. **Stage 1**: Discover and map the complete system (mobile, backend, database, AI service)
2. **Stage 2**: Identify actual role permissions from code and documentation
3. **Stage 3**: Verify test accounts and safe test data availability
4. **Stage 4–8**: Test each role independently (DONOR, NURSE, DOCTOR, MANAGER, ADMIN)
5. **Stage 9**: Conduct controlled penetration tests
6. **Stage 10**: Test database integrity and business logic
7. **Stage 11**: Run automated tests and build checks
8. **Stage 12**: Generate comprehensive audit reports

## System Components Under Audit

### Mobile Application (hemora-mobile)
- Expo SDK 55, React Native, TypeScript
- 14 screens across auth and home groups
- Supabase Auth with SecureStore session persistence
- TanStack Query for server state
- API client with token refresh and 401 retry

### Backend (hemora-backend)
- Express.js 5.x, TypeScript
- 23 API endpoints under `/api/hemora/`
- Supabase JWT verification via JWKs (ES256)
- Custom RBAC middleware with 5 roles and 7 resource categories
- Prisma ORM with PostgreSQL
- Rate limiting (20 req/15 min per IP)
- CORS configuration (environment-based)

### Database (Supabase PostgreSQL)
- 8 models: User, Facility, BloodInventory, Requisition, TransfusionLog, Campaign, CampaignInvitation, Notification
- 7 enums: UserRole, BloodGroup, BloodComponent, Urgency, RequisitionStatus, CampaignStatus, InvitationStatus, NotificationType
- Foreign key constraints with cascade deletes
- Seeded demo data: 10 users, 4 facilities, 32 inventory records, 5 requisitions, 2 campaigns, 6 invitations

### AI Service (hemora-ai)
- Python FastAPI, Scikit-learn RandomForestRegressor
- 4 endpoints: `/health`, `/predict`, `/predict/all`, `/model-info`
- No authentication between backend and AI service
- Synthetic dataset (3,328 records)

## Test Accounts (from DEMO_ACCOUNTS.md)
| Role | Email | Password |
|---|---|---|
| ADMIN | admin@hemora.zm | Demo1234! (seed) / password123 (demo) |
| MANAGER | bankmanager@hemora.zm | same |
| DOCTOR | doctor@hemora.zm | same |
| NURSE | nurse@hemora.zm | same |
| DONOR | donor@hemora.zm | same |

# Delivery Steps

### * Step 1: System discovery — map architecture, endpoints, and permission model
Produce a complete system architecture summary and inventory of all API endpoints with their authentication and role requirements.

- Document the complete request flow: Mobile → Backend → Auth/Authorization → Database
- Map all 23 API endpoints to their required permissions from `prototype.routes.ts`
- Cross-reference endpoint permissions with role definitions in `permissions.ts`
- Document the AI service communication pattern and its lack of authentication
- Identify all mobile screens and their data sources from `hemoraFetch()` calls
- Produce architecture findings section for the audit report

**Evidence sources:** `ARCHITECTURE.md`, `prototype.routes.ts` (1011 lines), `permissions.ts`, `rbac.middleware.ts`, `jwt-verify.ts`, `server.ts`, `api.ts`, `auth-client.ts`, all `.tsx` screens, `main.py`

### Stage 2: Role-by-role functional testing — DONOR and NURSE
Test all DONOR and NURSE capabilities using authorised test accounts, verifying both allowed and denied actions.

**DONOR testing (using donor@hemora.zm):**
- Login, logout, session persistence, session expiration
- Dashboard access: profile, campaigns, requisitions, inventory, notifications, search
- Profile update via `PATCH /me`
- Campaign join via `POST /campaigns/:id/join`
- Invitation respond via `PATCH /invitations/:id/respond`
- Invitation cancel via `PATCH /invitations/:id/cancel`
- Verify DONOR **cannot**: access admin endpoints, modify inventory, create requisitions, approve requisitions, access forecasts, manage users
- Verify DONOR **cannot**: access another donor's private data

**NURSE testing (using nurse@hemora.zm):**
- Login, logout, session persistence
- Dashboard access: requisitions (create/read), inventory (read), transfusions (create/read)
- Verify NURSE **cannot**: access admin endpoints, modify inventory, approve requisitions, access forecasts, manage campaigns, manage users
- Verify NURSE **cannot**: change their own role

**Evidence:** API test results with actual HTTP status codes, mobile screen behavior, database query results

### Stage 3: Role-by-role functional testing — DOCTOR, MANAGER, and ADMIN
Test all DOCTOR, MANAGER, and ADMIN capabilities using authorised test accounts.

**DOCTOR testing (using doctor@hemora.zm):**
- Login, logout, session persistence
- Dashboard access: requisitions (create/read/approve), inventory (read), transfusions (read)
- Verify DOCTOR **cannot**: access admin endpoints, modify inventory, reject requisitions, access forecasts, manage campaigns, manage users
- Verify DOCTOR **cannot**: access another user's private profile without authorisation

**MANAGER testing (using bankmanager@hemora.zm):**
- Login, logout, session persistence
- Dashboard access: inventory (read/update/dispatch), requisitions (read/approve/reject), forecasts (view/trigger), campaigns (create/read)
- Verify MANAGER **cannot**: access admin user management, create admins, change their own role
- Verify MANAGER **cannot**: access unrestricted system administration

**ADMIN testing (using admin@hemora.zm):**
- Login, logout, session persistence
- Dashboard access: all endpoints including user management (list/create)
- Verify user list via `GET /users`
- Verify user creation via `POST /users`
- Verify system stats via `GET /stats`
- Verify ADMIN can access all resources

**Evidence:** API test results, mobile screen behavior, database query results for each role

### Stage 4: Penetration testing — authentication, authorization, and API security
Conduct controlled security tests against the development environment using OWASP ASVS and API Security Top 10.

**Authentication security:**
- Test invalid login handling (wrong password, non-existent user)
- Test expired token handling
- Test JWT signature verification (tampered tokens)
- Test JWT issuer/audience validation
- Test token expiration enforcement
- Test refresh token handling
- Test logout and session invalidation
- Test password reset security flow
- Test account enumeration (does error differ for valid/invalid email?)

**Authorization & privilege escalation:**
- Vertical: DONOR token → ADMIN endpoint (`GET /users`, `POST /users`)
- Vertical: NURSE token → MANAGER endpoint (`POST /inventory`, `POST /forecast`)
- Vertical: DOCTOR token → ADMIN endpoint (`GET /users`)
- Vertical: MANAGER token → ADMIN endpoint (`GET /users`, `POST /users`)
- Horizontal: DONOR A token → access DONOR B's notifications
- Horizontal: DONOR A token → respond to DONOR B's invitation
- Horizontal: DONOR A token → mark DONOR B's notification as read
- Role manipulation: attempt to set role in `PATCH /me` request body
- Direct API access to restricted screens without navigation

**API security:**
- Missing auth middleware: `GET /search` uses `requireAuth()` only — no role check, any authenticated user can search all requisitions including clinical notes
- Missing auth middleware: `GET /health` is public — verify this is intentional
- IDOR: `GET /campaigns/:id` returns all donor names, emails, blood groups — verify if this is privacy-compliant
- IDOR: `GET /requisitions` returns all requisitions with requester info — verify data exposure
- Excessive data exposure: `GET /campaigns` returns donor email and blood group for all invitations
- Mass assignment: `POST /users` accepts role from request body — verify only ADMIN can set roles
- Input validation: test missing required fields, invalid enums, oversized payloads
- CORS configuration: verify production vs development behavior
- Rate limiting: verify rate limit is enforced on auth endpoints

**Evidence:** HTTP request/response pairs with sanitised tokens, actual status codes, error messages

### Stage 5: Penetration testing — input validation, database, mobile, and AI service security
Complete the remaining penetration test categories.

**Input validation & injection:**
- SQL injection indicators in search endpoint (test with `' OR 1=1 --`)
- SQL injection in profile update
- Malformed JSON payloads
- Unexpected data types (string instead of number for units)
- Oversized request bodies
- Invalid identifiers (non-existent UUIDs)
- Boundary values (negative units, zero units, extremely large units)
- Missing required fields in all POST/PATCH endpoints
- Invalid enum values for bloodGroup, component, urgency, status

**Database security:**
- Inspect Prisma query safety (parameterized queries vs string interpolation)
- Verify foreign key enforcement (e.g., requisition with non-existent requesterId)
- Verify data ownership checks in notification endpoints
- Verify password hash storage (Supabase handles this, verify no plaintext)
- Check for sensitive data returned by APIs (e.g., password fields in user objects)
- Verify `POST /users/self` cannot create records for other users
- Verify `PATCH /me` cannot update another user's record

**Mobile application security:**
- Verify SecureStore is used for token storage (not AsyncStorage)
- Check for hardcoded secrets in mobile source
- Verify API base URL is from environment variables
- Check for debug logging that exposes tokens
- Test authentication bypass through navigation (direct navigation to `/` without auth)
- Verify logout clears session correctly
- Check for sensitive information in navigation parameters

**AI service security:**
- Verify AI endpoints are not publicly accessible (no auth between backend and AI)
- Test input validation on `/predict` (invalid blood groups, negative lead times)
- Test excessive request sizes
- Verify AI responses don't expose donor information
- Check error messages for internal implementation exposure
- Verify the backend-to-AI communication uses localhost/internal network

**Evidence:** Test inputs and responses, database query analysis, mobile storage inspection, AI service response analysis

### Stage 6: Business logic, data integrity, frontend-backend consistency, and automated tests
Verify business logic correctness, data relationships, frontend-backend alignment, and run existing automated tests.

**Business logic & data integrity:**
- A donor cannot create a donation record for another donor
- A user cannot manipulate their assigned role through `PATCH /me` request payload
- A blood request cannot be assigned an invalid status transition (e.g., REJECTED → APPROVED)
- Blood inventory cannot silently become negative (verify `Math.max(0, ...)` in PATCH)
- Donation records maintain valid donor relationships
- Blood units have valid blood groups and quantities
- Campaign participation references valid campaigns and users
- Notifications belong to the correct recipient
- Unauthorized updates do not modify database records
- Check for duplicate records after concurrent operations
- Check for broken foreign keys

**Frontend-backend consistency:**
- Verify every mobile screen corresponds to a real backend capability
- Verify buttons perform the intended action (not fake alerts)
- Verify forms submit valid data to the backend
- Verify data loads from actual API, not hardcoded values
- Verify loading states appear correctly
- Verify empty states appear correctly
- Verify errors are displayed correctly
- Verify successful operations persist in the database
- Verify screens refresh after updates
- Verify unauthorized screens are inaccessible via direct navigation
- Verify navigation matches the authenticated user's role
- Verify no hardcoded business data remains
- Test keyboard behavior on forms (focused inputs visible)

**Automated tests:**
- Run backend TypeScript compilation (`npx tsc --noEmit`)
- Run backend existing tests (`npm test`)
- Run mobile TypeScript compilation (`npx tsc --noEmit`)
- Run ESLint if configured
- Check Prisma client generation status
- Verify migration status (`npx prisma migrate status`)

**Evidence:** Test execution results, database state verification, mobile screen behavior, build output

### Stage 7: Generate comprehensive audit reports and final deployment assessment
Produce all four audit reports with evidence-based findings, vulnerability register, and deployment assessment.

**Reports to generate:**
1. `HEMORA_COMPREHENSIVE_SECURITY_AND_FUNCTIONAL_AUDIT.md` — Main 14-section report with:
   - Executive Summary
   - Scope and Methodology
   - Architecture Findings
   - Role-Based Functional Results (DONOR, NURSE, DOCTOR, MANAGER, ADMIN)
   - Role Permission Matrix with evidence
   - API Security Results
   - Penetration Testing Results
   - Database and Data Integrity Results
   - Mobile Security Results
   - AI Service Security Results
   - Test Execution Summary (total/planned/executed/passed/failed/blocked/not tested/pass %)
   - Vulnerability Register (prioritised with evidence and remediation)
   - Remediation Roadmap (P0–P3)
   - Final Deployment Assessment (READY/NOT READY with justification)

2. `HEMORA_ROLE_PERMISSION_MATRIX.md` — Complete permission matrix:
   - Feature/Action × Role grid
   - ALLOWED/DENIED/CONDITIONAL/UNDEFINED/NOT IMPLEMENTED for each cell
   - Evidence for each permission (mobile screen, API endpoint, middleware, DB query, test result)

3. `HEMORA_PENETRATION_TEST_RESULTS.md` — All penetration test findings:
   - Each finding with ID, title, severity, affected component, endpoint, role, preconditions, reproduction steps, expected/actual behavior, evidence, impact, remediation, OWASP category
   - Summary by severity (CRITICAL/HIGH/MEDIUM/LOW/INFORMATIONAL)

4. `HEMORA_TEST_EXECUTION_RESULTS.md` — Test execution table:
   - Test ID, description, role, expected result, actual result, status, evidence
   - Summary statistics

**Save location:** `hemora-audit/` directory in project root (new directory, no modification to existing files)

**Terminal summary:** Overall result, verified vulnerabilities by severity, role with most failures, most serious functional/security issue, blocked tests, recommended next action