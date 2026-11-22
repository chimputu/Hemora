---
sessionId: session-261122-014144-10nq
---

# System Architecture & Scope

## System Architecture Summary

HEMORA is a three-tier blood donation and AI-based forecasting system:

```
Mobile App (Expo/React Native) → Backend API (Express.js) → PostgreSQL (Supabase)
                                              ↓
                                      AI Service (FastAPI/Python)
```

### Components Discovered

| Component | Technology | Key Files |
|---|---|---|
| **Mobile App** | Expo SDK 55, React Native, TypeScript | `hemora-mobile/src/lib/api.ts`, `auth-client.ts`, `supabase.ts` |
| **Backend API** | Express.js 5, TypeScript, Prisma 7 | `hemora-backend/src/server.ts`, `prototype.routes.ts`, `rbac.middleware.ts` |
| **Database** | PostgreSQL (Supabase), Prisma ORM | `prisma/schema.prisma` — 7 models: User, Facility, BloodInventory, Requisition, TransfusionLog, Campaign, CampaignInvitation, Notification |
| **AI Service** | FastAPI, Python, Scikit-learn | `hemora-ai/main.py` — `/predict`, `/predict/all`, `/model-info`, `/health` |
| **Authentication** | Supabase Auth (JWT via JWKs) | `jwt-verify.ts`, `supabase.ts` (service role client) |

### API Endpoints Mapped (23 endpoints)

| Method | Path | Permission | Auth Required |
|---|---|---|---|
| GET | `/inventory` | `inventory:read` | Yes |
| POST | `/inventory` | `inventory:update` | Yes |
| PATCH | `/inventory/:bloodGroup` | `inventory:update` | Yes |
| GET | `/requisitions` | `requisition:read` | Yes |
| GET | `/requisitions/my` | `requisition:read` | Yes |
| POST | `/requisitions` | `requisition:create` | Yes |
| PATCH | `/requisitions/:id/status` | `requisition:approve` | Yes |
| POST | `/forecast` | `forecast:view` | Yes |
| POST | `/forecast/all` | `forecast:view` | Yes |
| GET | `/forecast/model-info` | `forecast:view` | Yes |
| GET | `/facilities` | `inventory:read` | Yes |
| GET | `/campaigns` | `campaign:read` | Yes |
| POST | `/campaigns` | `campaign:create` | Yes |
| GET | `/campaigns/:id` | `campaign:read` | Yes |
| GET | `/me` | any authenticated | Yes |
| GET | `/role` | any authenticated | Yes |
| GET | `/users` | `user:list` | Yes |
| POST | `/users` | `user:create` | Yes |
| POST | `/users/self` | any authenticated | Yes |
| GET | `/stats` | `inventory:read` | Yes |
| GET | `/facilities/:id/requisitions` | `requisition:read` | Yes |
| PATCH | `/invitations/:id/respond` | any authenticated | Yes |
| GET | `/notifications` | any authenticated | Yes |
| PATCH | `/notifications/:id/read` | any authenticated | Yes |
| PATCH | `/notifications/read-all` | any authenticated | Yes |
| GET | `/search` | any authenticated | Yes |
| PATCH | `/me` | any authenticated | Yes |
| POST | `/campaigns/:id/join` | any authenticated | Yes |
| PATCH | `/invitations/:id/cancel` | any authenticated | Yes |
| GET | `/notifications/unread-count` | any authenticated | Yes |
| GET | `/health` | none | No |

### Role Permission Map (from `permissions.ts`)

| Resource/Action | DONOR | NURSE | DOCTOR | MANAGER | ADMIN |
|---|---|---|---|---|---|
| inventory:read | ✓ | ✓ | ✓ | ✓ | ✓ |
| inventory:update | | | | ✓ | ✓ |
| inventory:dispatch | | | | ✓ | ✓ |
| requisition:create | | ✓ | ✓ | | ✓ |
| requisition:read | ✓ | ✓ | ✓ | ✓ | ✓ |
| requisition:approve | | | ✓ | ✓ | ✓ |
| requisition:reject | | | | ✓ | ✓ |
| transfusion:create | | ✓ | | | ✓ |
| transfusion:read | | ✓ | ✓ | | ✓ |
| forecast:view | | | | ✓ | ✓ |
| forecast:trigger | | | | ✓ | ✓ |
| campaign:create | | | | ✓ | ✓ |
| campaign:read | ✓ | | | ✓ | ✓ |
| user:create | | | | | ✓ |
| user:list | | | | | ✓ |
| user:set-role | | | | | ✓ |
| user:ban | | | | | ✓ |
| user:delete | | | | | ✓ |

### Test Accounts (from `seed.ts`)

| Email | Role | Facility |
|---|---|---|
| admin@hemora.zm | ADMIN | — |
| bankmanager@hemora.zm | MANAGER | National Blood Transfusion Service |
| facilityadmin@hemora.zm | MANAGER | Kafue General Hospital |
| doctor@hemora.zm | DOCTOR | Kafue General Hospital |
| doctor2@hemora.zm | DOCTOR | Ubongo Hospital |
| nurse@hemora.zm | NURSE | Kafue General Hospital |
| nurse2@hemora.zm | NURSE | Ubongo Hospital |
| donor@hemora.zm | DONOR | — |
| donor2@hemora.zm | DONOR | — |
| donor3@hemora.zm | DONOR | — |

Demo password for all: `Demo1234!`

## Scope

**In Scope:**
- Complete backend API security and functional audit (hemora-backend)
- Mobile app security review (hemora-mobile source code inspection)
- AI service security review (hemora-ai source code inspection)
- Database schema and data integrity analysis
- Role-based access control verification
- Penetration testing of the development/test environment
- Automated test execution and build checks
- Report generation

**Out of Scope:**
- Modifying source code, database schema, or user data
- Testing against production environments
- Denial-of-service or destructive testing
- Testing external systems without explicit authorization
- Mobile app UI/UX testing on physical devices (source code review only for mobile)

# Delivery Steps

### ✓ Step 1: Stage 1 — System Discovery and Architecture Mapping
Map the complete system architecture, enumerate all API endpoints, and document the authentication/authorization flow.
- Inspect and catalog all 23+ API endpoints in `prototype.routes.ts` with their permission requirements
- Document the Supabase Auth → JWT verification → RBAC middleware chain (`jwt-verify.ts`, `rbac.middleware.ts`, `permissions.ts`)
- Map the Prisma schema models, relationships, and constraints from `schema.prisma`
- Document the AI service endpoints from `hemora-ai/main.py` and their backend integration
- Review mobile app auth client (`auth-client.ts`, `api.ts`, `supabase.ts`) for token handling
- Verify the seed data and test accounts from `seed.ts`
- Produce architecture summary with complete endpoint inventory

### ✓ Step 2: Stage 2 — Role Permission Analysis and Static Security Review
Analyze the role permission matrix and perform static code review for security issues.
- Verify `permissions.ts` role definitions against the five authoritative roles (DONOR, NURSE, DOCTOR, MANAGER, ADMIN)
- Check every API endpoint for correct permission middleware usage — identify endpoints missing RBAC protection
- Review `jwt-verify.ts` for JWT validation completeness (issuer, audience, signature, expiration)
- Inspect `rbac.middleware.ts` for proper 401/403 response handling
- Check for banned user enforcement in the auth middleware
- Review CORS configuration in `server.ts` for misconfiguration
- Assess rate limiting in `rate-limit.middleware.ts` (global 20/15min, auth-specific limits)
- Check for sensitive data exposure in API responses (e.g., campaign donor emails exposed to all readers)
- Review AI service for missing authentication between backend and AI service
- Identify mass assignment vulnerabilities in `POST /users` and `PATCH /me`
- Document all static findings with file references and line numbers

### ✓ Step 3: Stage 3 — Backend API Functional and Security Testing
Execute controlled API tests against the running backend using test accounts for each role.
- Start the backend server and verify `/health` endpoint
- Authenticate as each of the 5 roles using Supabase Auth and obtain JWT tokens
- Test each protected endpoint with each role's token to verify ALLOWED/DENIED outcomes
- Test vertical privilege escalation: DONOR token → ADMIN endpoints, NURSE → MANAGER endpoints, etc.
- Test horizontal privilege escalation: donor1 accessing donor2's data via `/me`, `/notifications`
- Test IDOR: access another user's requisitions, notifications, invitations
- Test input validation: malformed JSON, missing required fields, invalid enum values, oversized payloads
- Test SQL injection indicators in search endpoint and string fields
- Test role manipulation: attempt to change role via `PATCH /me` or `POST /users/self`
- Test session handling: expired tokens, invalid tokens, missing Authorization header
- Test the `/health` endpoint is truly unauthenticated
- Record all test results in structured test execution table

### ✓ Step 4: Stage 4 — Database Integrity and Business Logic Testing
Verify data integrity constraints, ownership checks, and business logic correctness.
- Verify foreign key constraints on all relationships (User↔Requisition, User↔Notification, Campaign↔Invitation, etc.)
- Test that blood inventory cannot go negative (PATCH /inventory with negative delta)
- Test requisition status transitions: PENDING→APPROVED→DISPATCHED, and invalid transitions
- Test that DISPATCHED status correctly decrements inventory in a transaction
- Test that a donor cannot create a requisition for another donor
- Test that users cannot manipulate their assigned role through request payloads
- Test that campaign invitations enforce ownership (donor can only respond to their own)
- Test that notifications are scoped to the correct userId
- Test that `/requisitions/my` returns only the authenticated user's requisitions
- Verify the `banned` field on User model is checked in auth middleware
- Check for race conditions in inventory updates (concurrent DISPATCHED requests)
- Verify data ownership in campaign detail endpoint (exposes donor emails to campaign:read)

### ✓ Step 5: Stage 5 — Mobile App and AI Service Security Review
Inspect mobile app and AI service source code for security vulnerabilities.
- Review `auth-client.ts`: token storage, refresh logic, role caching, fallback behavior (defaults to DONOR on failure — security risk)
- Review `api.ts`: hemoraFetch interceptor, 401 retry logic, timeout handling
- Check `supabase.ts` for client configuration and session persistence
- Review `secure-store-adapter.ts` for secure token storage implementation
- Check for hardcoded secrets, API URLs, or debug logging in mobile app
- Review navigation guards and role-based screen access in mobile app layouts
- Inspect AI service (`main.py`): API key authentication added, input validation on blood_group
- Check AI service for data leakage in error messages or model-info endpoint — error messages sanitized
- Review the backend-to-AI communication: API key authentication implemented
- Check for excessive data exposure in campaign endpoints — donor PII removed
- Document all mobile and AI-specific findings

### ✓ Step 6: Stage 6 — Automated Tests, Build Checks and Report Generation
Run existing automated tests, perform build checks, and generate the final audit reports.
- Run `npm test` in hemora-backend to execute existing Jest tests (`permissions.test.ts`)
- Run `npm run build` to verify TypeScript compilation succeeds
- Check for linting configuration and run if available
- Run mobile app tests if available (`hemora-mobile/__tests__/`)
- Compile all findings from previous stages into the four required reports:
  1. `HEMORA_COMPREHENSIVE_SECURITY_AND_FUNCTIONAL_AUDIT.md` — Full audit report with executive summary, architecture findings, role-based results, vulnerability register, remediation roadmap, and deployment assessment
  2. `HEMORA_ROLE_PERMISSION_MATRIX.md` — Complete permission matrix with evidence for each cell
  3. `HEMORA_PENETRATION_TEST_RESULTS.md` — Detailed penetration test findings with reproduction steps, severity, and remediation
  4. `HEMORA_TEST_EXECUTION_RESULTS.md` — Structured test execution table with PASS/FAIL/BLOCKED/NOT_TESTED status
- Save all reports to `/tmp/junie-session-*/audit/` directory (outside project tree)
- Produce terminal summary with overall assessment, vulnerability counts by severity, and recommended next action