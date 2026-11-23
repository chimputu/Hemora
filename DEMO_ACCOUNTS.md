# Demo Accounts

All demo accounts share the same password for ease of demonstration.

**Shared Password:** `Demo1234!`

---

## Accounts

### System Administrator

| Field | Value |
|---|---|
| **Email** | `admin@hemora.zm` |
| **Name** | Chimputu Kafiswe |
| **Role** | ADMIN |
| **Facility** | None (system-wide) |

**Permissions:** Full access to all modules — inventory, requisitions, transfusions, forecasts, campaigns, and user management.

**Dashboard Features:** System statistics, user list with role filtering, facility overview, system activity monitoring.

---

### Blood Bank Manager

| Field | Value |
|---|---|
| **Email** | `bankmanager@hemora.zm` |
| **Name** | Mulenga Banda |
| **Role** | MANAGER |
| **Facility** | National Blood Transfusion Service |

**Permissions:** Inventory read/update/dispatch, requisition read/approve/reject, forecast view/trigger, campaign create/read.

**Dashboard Features:** Blood inventory grid with stock adjustments, requisition approvals, AI-powered demand forecasting, donor mobilisation campaigns.

---

### Facility Administrator

| Field | Value |
|---|---|
| **Email** | `facilityadmin@hemora.zm` |
| **Name** | Thandiwe Phiri |
| **Role** | MANAGER |
| **Facility** | Kafue General Hospital |

**Permissions:** Inventory read/update/dispatch, requisition read/approve/reject, forecast view/trigger, campaign create/read.

**Dashboard Features:** Blood inventory grid with stock adjustments, requisition approvals, AI-powered demand forecasting, donor mobilisation campaigns.

---

### Doctor (1)

| Field | Value |
|---|---|
| **Email** | `doctor@hemora.zm` |
| **Name** | Dr. Chanda Mwale |
| **Role** | DOCTOR |
| **Facility** | Kafue General Hospital |
| **Blood Group** | O+ |
| **License No.** | HPCZ-12345 |

**Permissions:** Inventory read, requisition create/read/approve, transfusion read.

**Dashboard Features:** Create blood requests, track requisition status, view inventory levels.

---

### Doctor (2)

| Field | Value |
|---|---|
| **Email** | `doctor2@hemora.zm` |
| **Name** | Dr. Namunda Zulu |
| **Role** | DOCTOR |
| **Facility** | Ubongo Hospital |
| **Blood Group** | AB+ |
| **License No.** | HPCZ-67890 |

**Permissions:** Same as Doctor (1).

**Dashboard Features:** Same as Doctor (1).

---

### Nurse (1)

| Field | Value |
|---|---|
| **Email** | `nurse@hemora.zm` |
| **Name** | Grace Tembo |
| **Role** | NURSE |
| **Facility** | Kafue General Hospital |
| **Blood Group** | A+ |

**Permissions:** Inventory read, requisition create/read, transfusion create/read.

**Dashboard Features:** Create blood requests, track requisition status, view inventory levels.

---

### Nurse (2)

| Field | Value |
|---|---|
| **Email** | `nurse2@hemora.zm` |
| **Name** | Luyando Musonda |
| **Role** | NURSE |
| **Facility** | Ubongo Hospital |
| **Blood Group** | O+ |

**Permissions:** Same as Nurse (1).

**Dashboard Features:** Same as Nurse (1).

---

### Blood Donor (1)

| Field | Value |
|---|---|
| **Email** | `donor@hemora.zm` |
| **Name** | Bwalya Mutale |
| **Role** | DONOR |
| **Facility** | None |
| **Blood Group** | O- |
| **Phone** | +260 97 123 4567 |
| **Eligible** | Yes |

**Permissions:** Inventory read.

**Dashboard Features:** Profile with blood group and eligibility, campaign invitations with accept/decline actions, donation history.

---

### Blood Donor (2)

| Field | Value |
|---|---|
| **Email** | `donor2@hemora.zm` |
| **Name** | Chilufya Sikazwe |
| **Role** | DONOR |
| **Facility** | None |
| **Blood Group** | A+ |
| **Phone** | +260 96 234 5678 |
| **Eligible** | Yes |

**Permissions:** Same as Donor (1).

**Dashboard Features:** Same as Donor (1).

---

### Blood Donor (3)

| Field | Value |
|---|---|
| **Email** | `donor3@hemora.zm` |
| **Name** | Mutinta Kapembwa |
| **Role** | DONOR |
| **Facility** | None |
| **Blood Group** | B+ |
| **Phone** | +260 95 345 6789 |
| **Eligible** | Yes |

**Permissions:** Same as Donor (1).

**Dashboard Features:** Same as Donor (1).

---

## Seeded Facilities

| Name | Type | Address | Phone |
|---|---|---|---|
| Kafue General Hospital | Hospital | Plot 45, Kafue Road, Lusaka | +260 211 234 567 |
| Ubongo Hospital | Hospital | Ubongo Road, Lusaka | +260 211 345 678 |
| National Blood Transfusion Service | Blood Bank | Ridgway, Lusaka | +260 211 456 789 |
| Choma Rural Health Clinic | Clinic | Choma District, Southern Province | +260 213 123 456 |

## Seeded Data Summary

The database seed script creates:

- **10 users** across 6 roles
- **4 facilities** (2 hospitals, 1 blood bank, 1 clinic)
- **32 blood inventory records** (8 blood groups × 4 components)
- **5 requisitions** with various statuses (PENDING, APPROVED, REJECTED)
- **2 campaigns** (ACTIVE status)
- **6 campaign invitations** (3 donors × 2 campaigns)

## Resetting Demo Data

To reset the database to its initial demo state, run both seed scripts in order:

```bash
cd hemora-backend
npx prisma migrate reset --force
npm run db:seed-auth
npm run db:seed
```

**Why two seed steps?** The first command (`db:seed-auth`) creates the Supabase Auth accounts. The second (`db:seed`) creates the database records with matching Auth UUIDs. Both are required — if you skip the auth seed, login will fail with "invalid credentials" because Supabase Auth has no account to authenticate against.

### Manual setup (first time)

If you are setting up the database from scratch for the first time:

```bash
cd hemora-backend
npx prisma db push
npm run db:seed-auth
npm run db:seed
```

### Using Prisma Migrate (recommended for production)

If you prefer the migrate workflow over `db push`:

```bash
cd hemora-backend
npx prisma migrate deploy
npm run db:seed-auth
npm run db:seed
```
