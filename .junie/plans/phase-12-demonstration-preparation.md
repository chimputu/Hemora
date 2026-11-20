# Phase 12 — Demonstration Preparation

## Delivery Steps

### ✓ Step 1: Create project README with setup instructions
**Verified in this session:** README.md content is accurate. Created missing `hemora-backend/.env.example` and `hemora-mobile/.env.example` so the setup instructions work. Created root-level `.gitignore` for clean repository structure.
Create a comprehensive README.md at the project root explaining HEMORA, tech stack, and how to run everything.
- Add project overview describing HEMORA as an AI-based blood forecasting and donor mobilisation system.
- List the tech stack: Expo SDK 55, Express, Better Auth, PostgreSQL, Prisma, Python FastAPI, Scikit-learn.
- Provide step-by-step setup instructions for backend (install, env, db push, seed, start), mobile (install, env, start), and AI service (install, start).
- Document the project structure (hemora-backend/, hemora-mobile/, hemora-ai/).
- Include a note about the demo password and where to find demo accounts.
- Add a license section noting this is an academic capstone prototype.

### ✓ Step 2: Create demo accounts reference document
Create DEMO_ACCOUNTS.md listing all 10 demo accounts with credentials and role descriptions.
- List all 10 accounts: admin, bankmanager, facilityadmin, 2 doctors, 2 nurses, and 3 donors.
- Include email, name, role, facility assignment, and the shared password Demo1234!.
- Describe what each role can do in the system (permissions and dashboard features).
- Document the 4 seeded facilities: Kafue General Hospital, Ubongo Hospital, National Blood Transfusion Service, Choma Rural Health Clinic.
- Note that the seed script can be re-run to reset demo data.

### ✓ Step 3: Create demo scenarios for all 6 roles
Create DEMO_SCENARIOS.md with step-by-step walkthroughs for demonstrating each role.
- **Donor scenario**: Login → view profile with blood group O- → view campaign invitations → accept invitation → verify status update.
- **Bank Manager scenario**: Login → view inventory grid → adjust stock → view requisitions → approve pending requisition → view AI forecast → create campaign.
- **Doctor scenario**: Login → create blood request for patient → view my requisitions → track status.
- **Nurse scenario**: Login → create blood request → view requisitions list.
- **System Admin scenario**: Login → view system stats → view user list → view facilities → view activity.
- **Facility Admin scenario**: Login → view facility overview → view staff → view requisitions → view blood usage.
- Include expected outcomes and tips for smooth demonstration.

### ✓ Step 4: Create system architecture documentation
Create ARCHITECTURE.md with system architecture diagram, data flow, and component descriptions.
- Include a Mermaid architecture diagram showing Mobile → Backend → Database and Backend → AI Service connections.
- Describe each component: hemora-mobile (Expo app with 6 dashboards), hemora-backend (Express with 20 endpoints, RBAC, Better Auth), hemora-ai (FastAPI with RandomForest model).
- Document the data flow for key workflows: authentication, requisition creation, forecast generation, and campaign creation.
- List all 20 API endpoints grouped by category.
- Document the Prisma schema overview with key models: User, Facility, BloodInventory, Requisition, Campaign, CampaignInvitation.
- Include the RBAC permission matrix showing permissions per role.

### ✓ Step 5: Create capstone presentation support document
Create PRESENTATION.md with talking points, feature highlights, and Q&A preparation.
- Problem statement: blood shortages, inefficient donor mobilisation, lack of predictive analytics.
- Solution overview: HEMORA as an integrated platform with AI forecasting.
- Key features: 6 role-based dashboards, real-time inventory, AI-powered demand forecasting, donor mobilisation campaigns.
- AI model evaluation: RandomForestRegressor with R²=0.8033, MAE=0.8348, RMSE=1.0266 on 3,328 training samples.
- Technical highlights: Expo SDK 55, Better Auth RBAC, Prisma ORM, Scikit-learn ML pipeline.
- Innovation points: ML-based blood demand prediction, integrated donor mobilisation, role-based access for healthcare workflows.
- Limitations: prototype environment, synthetic dataset, single-region focus.
- Future work: real hospital integration, mobile donor app enhancements, advanced ML models.
- Q&A preparation with common questions and answers.
