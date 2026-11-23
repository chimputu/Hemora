# HEMORA — AI-Based Blood Forecasting and Donor Mobilisation System

An academic capstone prototype that integrates real-time blood inventory management, role-based hospital workflows, AI-powered demand forecasting, and donor mobilisation campaigns into a single mobile-first platform.

## Overview

HEMORA addresses blood shortages and inefficient donor mobilisation by providing:

- **Real-time blood inventory** tracking across 8 blood groups and 4 components.
- **Role-based dashboards** for 5 user types: System Admin, Manager, Doctor, Nurse, and Blood Donor.
- **AI-powered demand forecasting** using a Random Forest model trained on historical blood demand data.
- **Donor mobilisation campaigns** with automated invitations and response tracking.
- **Blood request workflows** from doctor/nurse creation through bank manager approval to dispatch.

## Architecture

```
Mobile (Expo SDK 55) → Express Backend → Local PostgreSQL
                              ↓
                        FastAPI AI Service
```

HEMORA uses a fully independent architecture with no external SaaS dependencies:

- **Mobile**: Expo SDK 55, React Native, TypeScript, Expo Router, SecureStore for session persistence
- **Backend**: Express.js 5, TypeScript, Prisma ORM, custom JWT authentication with `jose`, bcrypt password hashing
- **Database**: Local PostgreSQL (`hemora` database), Prisma migrations
- **AI Service**: Python FastAPI, RandomForest model, API key authentication

## Tech Stack

| Layer | Technology |
|---|---|
| **Mobile** | Expo SDK 55, React Native, TypeScript, Expo Router |
| **Backend** | Node.js, Express.js, TypeScript, Custom JWT Auth |
| **Database** | Local PostgreSQL, Prisma ORM |
| **AI Service** | Python, FastAPI, Scikit-learn, Pandas, NumPy |
| **UI** | Lucide React Native, React Native Reanimated, React Hook Form, Zod, TanStack Query |

## Project Structure

```
Hemora/
├── hemora-backend/    # Express REST API with custom JWT Auth + Prisma
├── hemora-mobile/     # Expo React Native mobile application
└── hemora-ai/         # Python FastAPI AI forecasting service
```

## Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 14+ installed locally
- **Python** 3.9+ (for AI service)
- **Expo Go** app on your mobile device or an emulator

## Setup Instructions

### 1. Local PostgreSQL Setup

Install PostgreSQL and create the `hemora` database:

```bash
sudo -u postgres psql -c "CREATE DATABASE hemora;"
sudo -u postgres psql -c "CREATE ROLE chimputu WITH LOGIN CREATEDB PASSWORD 'password';"
sudo -u postgres psql -c "GRANT ALL ON DATABASE hemora TO chimputu;"
sudo -u postgres psql -d hemora -c "GRANT ALL ON SCHEMA public TO chimputu;"
```

### 2. Backend

```bash
cd hemora-backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env   # then edit .env with your settings
```

Set the following environment variables in `.env`:

```
DATABASE_URL="postgresql://chimputu:password@localhost:5432/hemora?schema=public"
JWT_SECRET="hemora-jwt-secret-change-this-in-production"
JWT_REFRESH_SECRET="hemora-refresh-secret-change-this-in-production"
AI_SERVICE_URL="http://localhost:8000"
AI_SERVICE_API_KEY="hemora-ai-api-key-change-this-in-production"
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
PORT=5000
```

```bash
# Generate Prisma client
npx prisma generate

# Apply migrations to database
npx prisma migrate dev

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
cat > .env << EOF
EXPO_PUBLIC_API_URL="http://<your-local-ip>:5000"
EOF
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

## Authentication

HEMORA uses custom JWT-based authentication with:

- **bcrypt** password hashing
- **Short-lived access tokens** (15 minutes)
- **Refresh token rotation** with reuse detection
- **Rate limiting** on login and registration endpoints
- **RBAC** with 5 roles: ADMIN, MANAGER, DOCTOR, NURSE, DONOR

Auth endpoints:
- `POST /api/auth/register` — Create a new account
- `POST /api/auth/login` — Sign in with email/password
- `POST /api/auth/google/verify` — Sign in with Google
- `POST /api/auth/logout` — Revoke refresh token
- `POST /api/auth/refresh` — Rotate refresh token
- `POST /api/auth/forgot-password` — Request password reset
- `POST /api/auth/reset-password` — Reset password with token
- `POST /api/auth/verify-email` — Verify email address
- `GET /api/auth/me` — Get current user profile

## Demo Accounts

The seed script creates 10 demo accounts. All accounts share the same password:

**Password:** `Demo1234!`

| Email | Name | Role |
|---|---|---|
| `admin@hemora.zm` | Chimputu Kafiswe | System Admin |
| `bankmanager@hemora.zm` | Mulenga Banda | Manager |
| `facilityadmin@hemora.zm` | Thandiwe Phiri | Manager |
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

## Security Considerations

- Passwords are hashed with bcrypt (cost factor 12)
- Access tokens expire after 15 minutes
- Refresh tokens use rotation with reuse detection — if a stolen token is reused, all sessions are invalidated
- Login rate limiting: 5 attempts per 15 minutes per IP
- All API endpoints require authentication and role-based authorization
- AI service is protected by API key authentication
- No Supabase or external SaaS dependencies — full infrastructure control

## License

This project is an academic capstone prototype developed for educational purposes. It is not intended for production use in a clinical or operational blood bank environment.
