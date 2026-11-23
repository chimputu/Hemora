# Demo Scenarios

Step-by-step walkthroughs for demonstrating each of the 6 roles in HEMORA. Each scenario is designed to take 2–3 minutes during a live demonstration.

**Prerequisites:**
- Backend running on `http://localhost:5000`
- Mobile app running via Expo Go
- AI service running on `http://localhost:8000` (optional — backend falls back to heuristic predictions)

---

## Scenario 1: Blood Donor

**Account:** `donor@hemora.zm` / `Demo1234!`
**Duration:** ~2 minutes

### Steps

1. **Login**
   - Open the app and navigate to Sign In.
   - Enter email `donor@hemora.zm` and password `Demo1234!`.
   - Tap "Sign In".
   - **Expected:** Redirected to the Donor Dashboard with "Bwalya Mutale" displayed.

2. **View Profile**
   - Observe the profile card at the top of the dashboard.
   - **Expected:** Blood group shows "O-", eligibility status shows "Eligible", phone number is displayed.

3. **View Campaign Invitations**
   - Scroll to the "Campaign Invitations" section.
   - **Expected:** Two campaign invitations are visible — one for "O+ Blood Drive" (ACCEPTED status, green badge) and one for "General Donor Mobilisation" (PENDING status, yellow badge).

4. **Accept a Campaign Invitation**
   - Tap the "Accept" button on the PENDING invitation.
   - Confirm in the dialog.
   - **Expected:** The invitation status changes to "ACCEPTED" with a green badge. The invitation summary stats update (Accepted count increases).

5. **View Eligibility Status**
   - Scroll to the "Eligibility Status" card.
   - **Expected:** Shows a checkmark icon, "Eligible" status, and contact information.

### Key Talking Points

- Donors see their real profile data, not placeholders.
- Campaign invitations are sent automatically by the blood bank manager.
- Donors can accept or decline invitations with one tap.

---

## Scenario 2: Blood Bank Manager

**Account:** `bankmanager@hemora.zm` / `Demo1234!`
**Duration:** ~3 minutes

### Steps

1. **Login**
   - Sign out of the donor account.
   - Enter email `bankmanager@hemora.zm` and password `Demo1234!`.
   - **Expected:** Redirected to the Bank Manager Dashboard with "Mulenga Banda" displayed.

2. **View Inventory Overview**
   - Observe the stats grid at the top.
   - **Expected:** Total Units, Low Stock count, Pending Requests, and Avg Forecast are all displayed with real numbers.

3. **Browse Inventory Grid**
   - Scroll to the "Blood Inventory" section.
   - **Expected:** A grid showing all 8 blood groups with 4 components each (Whole Blood, RBC, Plasma, Platelets). Low-stock items show a red "Low" badge.

4. **Filter by Blood Group**
   - Tap a blood group pill (e.g., "O+") in the filter bar.
   - **Expected:** The grid shows only O+ inventory records.

5. **Adjust Stock**
   - Tap the "+" button on any inventory cell.
   - Confirm in the dialog.
   - **Expected:** The unit count increases by 1. The Total Units stat updates.

6. **View and Approve a Requisition**
   - Scroll to the "Requisition Approvals" section.
   - Filter by "Pending" tab.
   - **Expected:** At least one PENDING requisition is visible with patient info, urgency, and clinical notes.
   - Tap "Approve" on a PENDING requisition.
   - Confirm in the dialog.
   - **Expected:** The requisition status changes to "APPROVED" with a green badge. A "Dispatch" button appears.

7. **View AI Forecast**
   - Scroll to the "AI Forecasting" section.
   - **Expected:** Model info card shows "RandomForestRegressor" with R² score. Bar chart compares inventory vs predicted demand. Shortage alerts highlight blood groups needing restocking.

8. **Create a Campaign**
   - Scroll to "Donor Mobilisation" and tap "New Campaign".
   - Fill in: Title "Emergency O+ Drive", Description "Critical shortage", Blood Group "O+", Target Units 15, then set dates.
   - Tap "Create Campaign" and confirm.
   - **Expected:** The new campaign appears in the campaign list with "ACTIVE" status and invitation counts.

### Key Talking Points

- The bank manager dashboard is the central hub for blood bank operations.
- AI forecasting uses a real ML model, not random numbers.
- Campaign creation automatically sends invitations to eligible donors.

---

## Scenario 3: Doctor

**Account:** `doctor@hemora.zm` / `Demo1234!`
**Duration:** ~2 minutes

### Steps

1. **Login**
   - Sign out of the bank manager account.
   - Enter email `doctor@hemora.zm` and password `Demo1234!`.
   - **Expected:** Redirected to the Doctor Dashboard with "Dr. Chanda Mwale" displayed.

2. **View Requisition Stats**
   - Observe the stats grid.
   - **Expected:** Pending, Approved, Rejected, and Total counts are displayed with real numbers.

3. **Create a Blood Request**
   - Tap "New Blood Request".
   - Fill in the form:
     - Patient Name: "John Doe"
     - Patient Ref: "GH-2024-005"
     - Blood Group: Select "O+"
     - Component: Select "Whole Blood"
     - Units: 2
     - Urgency: Select "URGENT"
     - Clinical Notes: "Post-operative transfusion required"
   - Tap "Submit Request" and confirm.
   - **Expected:** Success message appears. The new requisition shows in the list with "PENDING" status.

4. **View My Requisitions**
   - Scroll to the "My Requisitions" section.
   - **Expected:** The newly created request appears at the top with PENDING status, patient info, and urgency indicator.
   - Filter by "Approved" tab to see previously approved requisitions.

### Key Talking Points

- Doctors create blood requests directly from their dashboard.
- Requests flow to the blood bank manager for approval.
- Status tracking shows the current state of each request.

---

## Scenario 4: Nurse

**Account:** `nurse@hemora.zm` / `Demo1234!`
**Duration:** ~2 minutes

### Steps

1. **Login**
   - Sign out of the doctor account.
   - Enter email `nurse@hemora.zm` and password `Demo1234!`.
   - **Expected:** Redirected to the Nurse Dashboard with "Grace Tembo" displayed.

2. **Create a Blood Request**
   - Tap "New Blood Request".
   - Fill in the form with patient details, blood group, component, units, and urgency.
   - Tap "Submit Request" and confirm.
   - **Expected:** Success message appears. The new requisition shows in the list.

3. **View Requisitions List**
   - Scroll to the "My Requisitions" section.
   - **Expected:** All requisitions created by this nurse are displayed with status badges, urgency indicators, and patient info.

### Key Talking Points

- Nurses have the same request creation workflow as doctors.
- The system tracks which staff member created each request.

---

## Scenario 5: System Administrator

**Account:** `admin@hemora.zm` / `Demo1234!`
**Duration:** ~2 minutes

### Steps

1. **Login**
   - Sign out of the nurse account.
   - Enter email `admin@hemora.zm` and password `Demo1234!`.
   - **Expected:** Redirected to the Admin Dashboard with "Chimputu Kafiswe Jr" displayed.

2. **View System Statistics**
   - Observe the stats grid.
   - **Expected:** Total Users (10), Total Facilities (4), Blood Units (real count), and Low Stock alerts are displayed.

3. **View User List**
   - Scroll to "User Management".
   - **Expected:** All 10 users are listed with role badges, email addresses, blood groups, and facility assignments.
   - Tap a role filter pill (e.g., "DOCTOR") to filter the list.
   - **Expected:** Only doctor accounts are shown.

4. **View Facilities**
   - Scroll to "Facility Overview".
   - **Expected:** 4 facilities are displayed with names, types, addresses, phone numbers, and staff counts.

5. **View System Activity**
   - Scroll to "System Activity".
   - **Expected:** Pending and approved requisition counts, campaign count, and recent requisitions are displayed.

### Key Talking Points

- The admin dashboard provides a system-wide overview.
- Role-based filtering helps identify users by their function.
- Facility cards show the network of connected healthcare institutions.

---

## Scenario 6: Facility Administrator

**Account:** `facilityadmin@hemora.zm` / `Demo1234!`
**Duration:** ~2 minutes

### Steps

1. **Login**
   - Sign out of the admin account.
   - Enter email `facilityadmin@hemora.zm` and password `Demo1234!`.
   - **Expected:** Redirected to the Facility Admin Dashboard with "Thandiwe Phiri" displayed.

2. **View Facility Overview**
   - Observe the hero card and stats.
   - **Expected:** Facility name "Kafue General Hospital" is displayed. Stats show staff count, active requests, and total units requested.

3. **View Staff List**
   - Scroll to "Staff Management".
   - **Expected:** Staff members assigned to Kafue General Hospital are listed with role badges (Doctor, Nurse, Facility Admin).

4. **View Requisition History**
   - Scroll to "Request History".
   - **Expected:** All requisitions from Kafue General Hospital are displayed with status badges, patient info, urgency, and dates.
   - Filter by "Pending" tab to see pending requests only.

5. **View Blood Usage Reports**
   - Scroll to "Blood Usage Reports".
   - **Expected:** A summary showing total units requested per blood group with a horizontal bar chart visualization.

### Key Talking Points

- Facility admins manage their specific facility's operations.
- Blood usage reports help with inventory planning.
- Staff list shows who is assigned to the facility.

---

## Demonstration Tips

1. **Prepare in advance:** Have the backend and mobile app running before the demonstration.
2. **Use the bank manager account** as the primary demo — it shows the most features.
3. **Keep the AI service running** for the most impressive forecast results.
4. **Reset the database** before the demo if you've made changes during testing:
   ```bash
   cd hemora-backend && npx prisma db push && npm run db:seed
   ```
5. **Have a phone ready** with Expo Go installed for a live mobile demo.
6. **Total demo time:** ~15 minutes for all 6 roles, or ~5 minutes for a focused bank manager + doctor demo.
