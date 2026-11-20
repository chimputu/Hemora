ther# HEMORA — AI-Based Blood Forecasting and Donor Mobilisation System

An academic capstone prototype that integrates real-time blood inventory management, role-based hospital workflows, AI-powered demand forecasting, and donor mobilisation campaigns into a single mobile-first platform.

## Overview

HEMORA addresses blood shortages and inefficient donor mobilisation by providing:

- **Real-time blood inventory** tracking across 8 blood groups and 4 components.
- **Role-based dashboards** for 6 user types: System Admin, Blood Bank Manager, Facility Admin, Doctor, Nurse, and Blood Donor.
- **AI-powered demand forecasting** using a Random Forest model trained on historical blood demand data.
- **Donor mobilisation campaigns** with automated invitations and response tracking.
- **Blood request workflows** from doctor/nurse creation through bank manager approval to dispatch.

## Tech Stack

| Layer | Technology |
|---|---|
| **Mobile** | Expo SDK 55, React Native, TypeScript, Expo Router |
| **Backend** | Node.js, Express.js, TypeScript, Better Auth |
| **Database** | PostgreSQL, Prisma ORM |
| **AI Service** | Python, FastAPI, Scikit-learn, Pandas, NumPy |
| **UI** | Lucide React Native, React Native Reanimated, React Hook Form, Zod, TanStack Query |

## Project Structure

```
Hemora/
├── hemora-backend/    # Express REST API with Better Auth + Prisma
├── hemora-mobile/     # Expo React Native mobile application
└── hemora-ai/         # Python FastAPI AI forecasting service
```

## Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 14+ running locally
- **Python** 3.9+ (for AI service)
- **Expo Go** app on your mobile device or an emulator

## Setup Instructions

### 1. Database

Create a PostgreSQL database:

```bash
createdb hemora_db
```

### 2. Backend

```bash
cd hemora-backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env   # or create .env manually
```

Set the following environment variables in `.env`:

```
DATABASE_URL="postgresql://postgres:<your-password>@localhost:5432/hemora_db?schema=public"
BETTER_AUTH_SECRET="your-secret-key-here"
BETTER_AUTH_URL="http://localhost:5000"
AI_SERVICE_URL="http://localhost:8000"
PORT=5000
```

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed demo data
npm run db:seed

# Start development server
npm run dev
```

The backend runs on `http://localhost:5000`.

### 3. Mobile

```bash
cd hemora-mobile

# Install dependencies
npm install

# Configure environment
echo 'EXPO_PUBLIC_API_URL="http://<your-local-ip>:5000"' > .env
```

Replace `<your-local-ip>` with your machine's local IP address (e.g., `192.168.1.100`).

```bash
# Start Expo dev server
npm start
```

Scan the QR code with Expo Go on your phone or press `a` for Android emulator / `i` for iOS emulator.

### 4. AI Service (Optional)

The AI service provides ML-based blood demand predictions. The backend falls back to heuristic predictions if the AI service is offline.

```bash
cd hemora-ai

# Create a virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the service
python3 main.py
```

The AI service runs on `http://localhost:8000`.

## Demo Accounts

The seed script creates 10 demo accounts. All accounts share the same password:

**Password:** `Demo1234!`

| Email | Name | Role |
|---|---|---|
| `admin@hemora.zm` | System Administrator | System Admin |
| `bankmanager@hemora.zm` | Mulenga Banda | Blood Bank Manager |
| `facilityadmin@hemora.zm` | Thandiwe Phiri | Facility Admin |
| `doctor@hemora.zm` | Dr. Chanda Mwale | Doctor |
| `doctor2@hemora.zm` | Dr. Namunda Zulu | Doctor |
| `nurse@hemora.zm` | Grace Tembo | Nurse |
| `nurse2@hemora.zm` | Luyando Musonda | Nurse |
| `donor@hemora.zm` | Bwalya Mutale | Blood Donor |
| `donor2@hemora.zm` | Chilufya Sikazwe | Blood Donor |
| `donor3@hemora.zm` | Mutinta Kapembwa | Blood Donor |

See [DEMO_ACCOUNTS.md](DEMO_ACCOUNTS.md) for detailed role descriptions and permissions.

## Demo Scenarios

Step-by-step walkthroughs for demonstrating each role are available in [DEMO_SCENARIOS.md](DEMO_SCENARIOS.md).

## Documentation

- [DEMO_ACCOUNTS.md](DEMO_ACCOUNTS.md) — Demo credentials and role descriptions
- [DEMO_SCENARIOS.md](DEMO_SCENARIOS.md) — Step-by-step demo walkthroughs
- [ARCHITECTURE.md](ARCHITECTURE.md) — System architecture and API reference
- [PRESENTATION.md](PRESENTATION.md) — Capstone presentation talking points

## AI Model

The forecasting service uses a **RandomForestRegressor** trained on 3,328 records of synthetic historical blood demand data (104 weeks × 8 blood groups × 4 components).

**Model Performance:**
- R² Score: 0.8033
- MAE: 0.8348 units
- RMSE: 1.0266 units

See [ARCHITECTURE.md](ARCHITECTURE.md) for details on the ML pipeline.

## License

This project is an academic capstone prototype developed for educational purposes. It is not intended for production use in a clinical or operational blood bank environment.
# Hemora
