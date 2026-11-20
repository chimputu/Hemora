# Capstone Presentation Support

## Problem Statement

Blood transfusion services in Zambia face three critical challenges:

1. **Chronic blood shortages** — Hospitals frequently run out of specific blood groups, delaying life-saving procedures.
2. **Inefficient donor mobilisation** — Blood banks rely on manual, reactive methods to find donors, missing opportunities for proactive outreach.
3. **Lack of predictive analytics** — No system exists to forecast blood demand, making inventory planning purely reactive.

These challenges result in delayed surgeries, compromised patient care, and wasted resources due to expired blood that was collected without proper demand planning.

## Solution Overview

**HEMORA** is an integrated mobile-first platform that connects blood donors, hospitals, and blood banks through:

- **Real-time inventory management** across 8 blood groups and 4 components.
- **AI-powered demand forecasting** using machine learning to predict blood needs.
- **Role-based workflows** for 6 user types, from donors to system administrators.
- **Automated donor mobilisation** campaigns with invitation tracking.

## Key Features

### 1. Six Role-Based Dashboards

Each user role sees a dashboard tailored to their responsibilities:

| Role | Dashboard Focus |
|---|---|
| **Blood Donor** | Profile, campaign invitations, eligibility status |
| **Blood Bank Manager** | Inventory, requisitions, AI forecasts, campaigns |
| **Doctor** | Create blood requests, track status |
| **Nurse** | Create blood requests, track status |
| **System Admin** | System stats, user management, facility overview |
| **Facility Admin** | Staff management, requisition history, blood usage |

### 2. Real-Time Blood Inventory

- Grid view of all 8 blood groups × 4 components (32 records).
- Low-stock warnings when units fall below minimum threshold.
- Stock adjustment with +/- buttons for receiving or expiring blood.
- Blood group filtering for quick access.

### 3. AI-Powered Demand Forecasting

- **RandomForestRegressor** model trained on 3,328 records of historical blood demand.
- Predicts 7-day demand for each blood group.
- Compares predicted demand against current inventory.
- Highlights shortage alerts for blood groups needing restocking.
- Bar chart visualization comparing inventory vs predicted demand.

### 4. Blood Request Workflow

- Doctors and nurses create requests with patient and clinical details.
- Requests flow to the blood bank manager for approval.
- Status tracking: PENDING → APPROVED → DISPATCHED.
- Stock is automatically deducted when a requisition is dispatched.

### 5. Donor Mobilisation Campaigns

- Bank manager creates campaigns targeting specific blood groups.
- System automatically identifies eligible donors and sends invitations.
- Donors accept or decline invitations with one tap.
- Campaign effectiveness tracking with response statistics.

## AI Model Evaluation

The forecasting component uses a **RandomForestRegressor** from Scikit-learn.

| Metric | Value |
|---|---|
| **R² Score** | 0.8033 |
| **MAE** | 0.8348 units |
| **RMSE** | 1.0266 units |
| **Training Samples** | 3,328 records |
| **Features** | Blood group, component, week, month, day of week, rolling averages |

**Interpretation:** The model explains approximately 80% of the variance in blood demand, with an average prediction error of less than 1 unit per blood group per week. This is a strong result for a prototype using synthetic data.

**Important note:** The training dataset is synthetic, generated with realistic patterns (seasonal variation, blood group frequency distribution, component breakdown). It is clearly labeled as demonstration data, not real hospital records.

## Technical Highlights

### Mobile Application
- **Expo SDK 55** with React Native for cross-platform support.
- **TanStack Query** for efficient data fetching with caching and automatic refetching.
- **React Hook Form + Zod** for form validation.
- **React Native Reanimated** for smooth animations.
- Cookie-based session management via Better Auth.

### Backend API
- **Express.js 5** with TypeScript for type-safe API development.
- **Better Auth** for authentication with credential provider and session management.
- **Custom RBAC middleware** with 19 distinct permissions across 6 roles.
- **Prisma ORM** with PostgreSQL for type-safe database queries.
- Graceful fallback to heuristic predictions when the AI service is offline.

### AI Service
- **FastAPI** for a lightweight, high-performance Python API.
- **Scikit-learn** RandomForestRegressor with feature engineering.
- **Pandas** for data manipulation and feature extraction.
- Model trains on startup from CSV data in under 2 seconds.

## Innovation Points

1. **ML-based blood demand prediction** — Unlike existing systems that rely on manual inventory checks, HEMORA uses machine learning to predict demand before shortages occur.

2. **Integrated donor mobilisation** — Campaign creation automatically identifies and invites eligible donors, closing the loop between demand forecasting and supply mobilisation.

3. **Role-based healthcare workflows** — Six distinct roles with tailored dashboards reflect real-world blood bank operations, from donor registration to system administration.

4. **Mobile-first design** — The entire platform is accessible via mobile devices, making it suitable for low-resource settings where desktop access is limited.

5. **Graceful degradation** — The system continues to function with heuristic predictions even when the AI service is offline, ensuring reliability.

## Limitations

This is an **academic prototype** with the following known limitations:

1. **Synthetic dataset** — The AI model is trained on generated data, not real hospital records. Real-world performance may differ.
2. **Single-region focus** — The system is designed for the Lusaka, Zambia region. Multi-region support would require additional data and model training.
3. **No real-time notifications** — Campaign invitations appear on the dashboard but don't push notifications to donors.
4. **No transfusion logging** — While the schema supports it, the transfusion log UI is not implemented in the prototype.
5. **No user management UI** — Admins have the permissions to manage users, but the UI for creating/editing users is deferred.
6. **Prototype authentication** — All demo accounts share the same password for ease of demonstration.

## Future Work

Potential improvements for a production version:

1. **Real hospital integration** — Connect to actual hospital information systems for real-time data.
2. **Advanced ML models** — Explore Prophet, LSTM, or XGBoost for improved forecast accuracy.
3. **Push notifications** — Send real-time alerts to donors when campaigns are created.
4. **Transfusion logging** — Allow nurses to record transfusions for complete audit trails.
5. **Multi-region support** — Extend the system to cover multiple provinces with region-specific forecasts.
6. **Donor health screening** — Add pre-donation health questionnaires and eligibility checks.
7. **Export and reporting** — Generate PDF reports for blood usage, campaign effectiveness, and inventory trends.
8. **Offline mode** — Cache critical data for use in areas with limited connectivity.

## Q&A Preparation

### "Why did you choose Random Forest over other ML models?"

Random Forest provides a good balance of accuracy and interpretability. It handles categorical features well (blood groups, components), doesn't require extensive feature scaling, and provides feature importance scores. For a prototype, it trains quickly and produces credible results without the complexity of deep learning models.

### "How accurate is the AI forecast?"

The model achieves an R² score of 0.8033 on the synthetic dataset, meaning it explains about 80% of the variance in blood demand. The average prediction error is less than 1 unit per blood group per week. However, since the dataset is synthetic, real-world accuracy would need to be validated with actual hospital data.

### "What happens if the AI service goes down?"

The backend has a built-in fallback mechanism. If the AI service is unreachable, the system uses heuristic baseline values based on blood group frequency distributions. The dashboard clearly indicates when the fallback is active, so users know the predictions are approximate.

### "How does the system handle blood group compatibility?"

The prototype tracks blood groups individually for inventory and requests. Full compatibility logic (e.g., O- as universal donor) is noted as a future enhancement. The current system matches exact blood groups for simplicity.

### "Is the system secure?"

The prototype implements:
- Password hashing via Better Auth (bcrypt).
- Cookie-based session management with secure flags.
- Role-based access control with 19 distinct permissions.
- Server-side permission checks on every API endpoint.
- Password hashes and sensitive fields are excluded from API responses.

For production, additional measures would be needed: HTTPS, rate limiting, input sanitisation, and audit logging.

### "How many users can the system support?"

The prototype has been tested with 10 demo users and 32 inventory records. The PostgreSQL + Prisma stack can handle thousands of users and millions of records. Performance testing at scale was outside the scope of this prototype.

### "What makes HEMORA different from existing blood bank systems?"

Most existing blood bank management systems focus on inventory tracking and request processing. HEMORA differentiates itself by integrating **AI-powered demand forecasting** directly into the workflow, enabling proactive rather than reactive blood management. The donor mobilisation component also closes the loop by connecting predicted shortages with donor outreach.

## Presentation Structure (Suggested)

1. **Introduction** (2 min) — Problem statement and HEMORA overview.
2. **Live Demo** (5 min) — Bank manager dashboard: inventory, forecast, requisitions, campaign creation.
3. **AI Component** (2 min) — Model explanation, performance metrics, dataset.
4. **Architecture** (2 min) — Three-tier architecture, RBAC, data flow.
5. **Results & Limitations** (1 min) — What works, what's a prototype limitation.
6. **Future Work** (1 min) — Production roadmap.
7. **Q&A** (Remaining time)

**Total:** ~13 minutes + Q&A
