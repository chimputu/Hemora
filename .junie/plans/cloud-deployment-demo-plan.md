---
sessionId: session-261123-062552-8f44
---

# Git Push & Cloud Deployment Plan

### Current Status
- ✅ All code changes committed locally (commit `9fff856` on `fix/routing-verification` branch)
- ✅ **Pushed to GitHub** — `main` branch updated (commit `44702c9`)
- ✅ **Supabase database verified** — 18 users, 4 facilities, 7 campaigns
- ✅ **Secrets generated** — JWT_SECRET, JWT_REFRESH_SECRET, AI_SERVICE_API_KEY
- ✅ **Deployment guide created** — `RENDER_DEPLOYMENT.md` with all exact values
- ⏳ Deploy backend to Render (user action required — create web service on Render dashboard)
- ⏳ Deploy AI service to Render
- ⏳ Build and distribute APK

### Recommended Architecture

```
[Mobile App (Expo APK)]
        │
        │  HTTPS (EXPO_PUBLIC_API_URL)
        ▼
[hemora-backend (Express/Prisma)]
        │
        │  HTTP + Bearer AI_SERVICE_API_KEY
        ▼
[hemora-ai (FastAPI/uvicorn)]
        │
[Supabase/Neon PostgreSQL] ← shared by backend via DATABASE_URL
```

### Platform Recommendations

| Service | Platform | Why (12-hour deadline) |
|---|---|---|
| **Backend (Express)** | **Render** | Monorepo support via Root Directory field, free tier available, instant git deploy, native env vars dashboard. No Dockerfile needed. |
| **AI Service (FastAPI)** | **Render** | Same platform = simpler networking, same git repo, Python build support out of the box. Backend can reach it via Render's stable URL. |
| **Mobile (Expo)** | **Local build** | Build the APK locally with `expo run:android`. No cloud hosting needed — the APK is installed directly on the phone. |
| **Database** | **Supabase/Neon (existing)** | Already hosted. No changes needed. |

### Why Render over Railway/Fly.io?
- **Render**: Zero-config Node.js and Python builds. The Root Directory setting handles monorepos natively. Free tier exists (with sleep on free tier — see warnings). Deploy in ~5 minutes from git.
- **Railway**: Also good, but requires a credit card for the free trial and has a less straightforward monorepo config.
- **Fly.io**: Requires a Dockerfile and fly.toml — adds setup time we don't have.

### Key Decision: Mobile App Strategy
The APK is a static binary — it doesn't need hosting. The `EXPO_PUBLIC_API_URL` is baked into the APK at build time. This means:
1. Set `EXPO_PUBLIC_API_URL` to the Render backend URL before building.
2. Build the APK locally.
3. Transfer the APK to the supervisor's phone via USB, email, or a file sharing link.
4. Install and run.

# Step 0: Push Code to GitHub ✅ COMPLETED

### What Was Pushed
Commit `44702c9` on `main` includes:
- Facility detail page endpoint (`GET /facilities/:id`)
- Campaign delete endpoint (`DELETE /campaigns/:id`)
- Campaign join restricted to DONOR role only
- Facility CRUD permissions in RBAC system
- Clean `.gitignore` (coverage files excluded)
- All dashboard, home screen, and UI changes
- Dashboard with summary cards, Blood Inventory graph, Team Distribution graph
- React Query caching (5-min stale, 15-min GC)
- Backend in-memory cache (2-min TTL)
- Zambian cities picker (17 cities across 10 provinces)

### Render Can Now Deploy
The code is live at `https://github.com/chimputu/Hemora`. Proceed to Step 1: Backend Deployment.

# Backend Deployment (Render)

### Step-by-Step: Deploy hemora-backend to Render

#### 1. Connect Your Repo on Render

#### 2. Create a New Web Service on Render
- Go to https://dashboard.render.com → New + → Web Service
- Connect your GitHub repo
- Fill in:
  - **Name**: `hemora-backend`
  - **Root Directory**: `hemora-backend` (critical — tells Render to only look inside this folder for package.json)
  - **Environment**: `Node`
  - **Build Command**: `npm ci && npx prisma generate && npx prisma migrate deploy && npm run build`
  - **Start Command**: `npm start`
  - **Instance Type**: Free (or Starter for no sleep — $7/mo, recommended for demo)

#### 3. Environment Variables (Render Dashboard → Environment)
```
NODE_ENV=production
DATABASE_URL=postgresql://user:password@your-supabase-or-neon-host:5432/hemora?schema=public
JWT_SECRET=<generate with: openssl rand -base64 32>
JWT_REFRESH_SECRET=<generate with: openssl rand -base64 32>
AI_SERVICE_URL=https://hemora-ai.onrender.com    (set after deploying AI service)
AI_SERVICE_API_KEY=<generate a strong random key>
GOOGLE_CLIENT_ID=77537056928-eos2s4ip0f4u1j317018l5pllb4lf7ch.apps.googleusercontent.com
PORT=5000
CORS_ORIGINS=hemora://,http://localhost:8081
```

#### 4. Build Command Breakdown
- `npm ci` — clean install from lockfile
- `npx prisma generate` — generates the Prisma Client (src/generated/prisma/) required at runtime
- `npx prisma migrate deploy` — applies all pending migrations to the production database (idempotent, safe to run multiple times)
- `npm run build` — runs `tsc` to compile TypeScript to dist/

#### 5. Verify Deployment
Once deployed, Render assigns a URL like `https://hemora-backend.onrender.com`.
Test: `curl https://hemora-backend.onrender.com/health`
Expected: `{"status":"ok","service":"hemora-backend"}`

#### 6. Database Migration Note
If the database is already seeded locally, ensure the cloud database has the same schema. `npx prisma migrate deploy` handles this automatically if migrations are committed to git. If you need to seed demo data, run the seed script manually via Render's shell or by connecting to the database directly.

# AI Service Deployment (Render)

### Step-by-Step: Deploy hemora-ai to Render

#### 1. Create a New Web Service on Render
- Go to https://dashboard.render.com → New + → Web Service
- Connect the same GitHub repo
- Fill in:
  - **Name**: `hemora-ai`
  - **Root Directory**: `hemora-ai`
  - **Environment**: `Python`
  - **Python Version**: `3.11` (or latest available)
  - **Build Command**: `pip install -r requirements.txt`
  - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

#### 2. Environment Variables (Render Dashboard → Environment)
```
AI_SERVICE_API_KEY=<same key as backend AI_SERVICE_API_KEY>
PORT=8000
```

#### 3. How the Backend Connects to AI Service
The Express backend (hemora-backend/src/routes/prototype.routes.ts) already reads `AI_SERVICE_URL` and `AI_SERVICE_API_KEY` from environment variables and makes HTTP calls with Bearer token auth. After deploying the AI service, update the `AI_SERVICE_URL` in the backend's environment variables to point to the AI service's Render URL.

#### 4. Security
- The AI service uses API key authentication on all endpoints except `/health`.
- The backend sends `Authorization: Bearer <key>` headers when calling the AI service.
- Both services share the same key via environment variables — no key is exposed to the mobile app.

#### 5. Verify Deployment
Test: `curl https://hemora-ai.onrender.com/health`
Expected: `{"status":"ok","service":"hemora-ai"}`

#### 6. Note on dataset.csv
The `dataset.csv` file is already in the `hemora-ai/` directory and committed to git. Render will include it in the build. The `model.py` loads it at startup, so no additional configuration is needed.

# Mobile App Build & Configuration

### Step-by-Step: Build the APK for Production

#### 1. Set the API URL to the Hosted Backend
Edit `hemora-mobile/.env`:
```
EXPO_PUBLIC_API_URL="https://hemora-backend.onrender.com"
EXPO_PUBLIC_GOOGLE_CLIENT_ID="77537056928-eos2s4ip0f4u1j317018l5pllb4lf7ch.apps.googleusercontent.com"
```

This is the critical step. The `EXPO_PUBLIC_API_URL` is baked into the APK at build time. The mobile app reads it from `hemora-mobile/src/lib/api.ts` and `hemora-mobile/src/lib/auth-client.ts` via `process.env.EXPO_PUBLIC_API_URL`.

#### 2. Build the APK

**Option A: Local Build (Fastest for Demo)**
```bash
cd /home/chimputu/Desktop/Hemora/hemora-mobile
npx expo run:android
```
This builds the app and installs it on a connected Android device via USB. The APK is generated in `hemora-mobile/android/app/build/outputs/apk/release/`.

**Option B: EAS Build (Cloud Build, APK Download)**
```bash
cd /home/chimputu/Desktop/Hemora/hemora-mobile
npx eas build --platform android --profile preview
```
This uploads the project to EAS, builds it in the cloud, and provides a download link for the APK. The `preview` profile in `eas.json` uses `distribution: "internal"` which produces an installable APK.

**Option C: EAS Build Production**
```bash
npx eas build --platform android --profile production
```
Same as above but uses the `production` profile with auto-increment versioning.

#### 3. Transfer APK to Supervisor's Phone
- USB: Connect phone, transfer the APK file, install.
- Email/Drive: Upload the APK to Google Drive or email it.
- Direct Link: EAS build provides a direct download URL.

#### 4. Install on Android
- Enable "Install from Unknown Sources" if prompted.
- Open the APK file and install.
- The app will connect to the hosted backend via HTTPS.

#### 5. Important: Google OAuth Configuration
Ensure the `GOOGLE_CLIENT_ID` in the mobile `.env` matches the `GOOGLE_CLIENT_ID` set in the backend's Render environment variables. Also verify that the Google OAuth consent screen includes the Android package name `com.kafiswe.hemoramobile` as an authorized origin.

# CORS, Networking & Demo Checklist

### CORS Configuration

The Express backend (hemora-backend/src/server.ts) already has a dynamic CORS setup:
- Mobile apps (no Origin header): Allowed automatically ✓
- `hemora://` scheme: Allowed ✓
- Localhost/127.0.0.1:8081: Allowed (dev) ✓
- Private IP ranges (192.168.x.x, 10.x.x.x):8081: Allowed in dev ✓
- Production: Reads `CORS_ORIGINS` env var (comma-separated)

For the demo, set in Render backend:
```
CORS_ORIGINS=hemora://,http://localhost:8081
```
This covers the Expo app scheme and any web testing.

### Critical Warnings for Demo Day

#### ⚠️ Free Tier Sleep Mode
- **Render Free Tier**: Instances sleep after 15 minutes of inactivity. First request after sleep takes 30-60 seconds to wake up.
- **Solution for demo**: Upgrade to Starter tier ($7/mo) for both services to prevent sleeping. Or, hit the `/health` endpoint every 10 minutes using a free service like UptimeRobot to keep it awake.
- **Neon Free Tier**: Also sleeps after 5 minutes of inactivity. First query after sleep has a 1-2 second delay.

#### ⚠️ IPv4/IPv6
- Render provides IPv4 endpoints only. This is fine for mobile data.
- No IPv6 issues expected.

#### ⚠️ HTTPS Required
- The mobile app on mobile data must use HTTPS. Render provides automatic HTTPS certificates. ✓
- The `EXPO_PUBLIC_API_URL` must use `https://` — not `http://`.

### Final Pre-Demo Checklist

#### Backend (Render)
- [ ] hemora-backend deployed and healthy (/health returns OK)
- [ ] All environment variables set (especially DATABASE_URL, JWT_SECRET, AI_SERVICE_URL)
- [ ] Database migrations applied (npx prisma migrate deploy ran during build)
- [ ] Demo data seeded in the database
- [ ] CORS_ORIGINS includes hemora://
- [ ] Backend can reach AI service (test /api/hemora/forecast/all endpoint)

#### AI Service (Render)
- [ ] hemora-ai deployed and healthy (/health returns OK)
- [ ] AI_SERVICE_API_KEY matches the key in backend's env vars
- [ ] dataset.csv is included in the deployment
- [ ] Test prediction endpoint with the API key

#### Mobile App
- [ ] EXPO_PUBLIC_API_URL in .env points to the Render backend URL (not local IP)
- [ ] APK built with the correct API URL
- [ ] APK transferred to supervisor's phone
- [ ] APK installed successfully
- [ ] Test login with demo credentials on the phone (mobile data, Wi-Fi off)
- [ ] Test all demo scenarios work end-to-end

#### Network
- [ ] Supervisor's phone has mobile data enabled
- [ ] Wi-Fi is turned off during the demo
- [ ] Backend and AI service are not sleeping (hit health endpoints right before demo)
- [ ] Have a backup: know the Render URLs to open in a browser if the phone fails

#### Emergency Contacts
- [ ] Keep the Render dashboard open on your laptop
- [ ] Know how to restart services from the dashboard
- [ ] Have the demo account credentials ready (see DEMO_ACCOUNTS.md)

# Delivery Steps

### * Step 1: Deploy hemora-backend to Render (Preparation)
Deploy the Express.js backend to Render as a Web Service with monorepo root directory config.
- Push the monorepo to GitHub if not already done.
- Create a Render Web Service: Root Directory = `hemora-backend`, Environment = Node, Build Command = `npm ci && npx prisma generate && npx prisma migrate deploy && npm run build`, Start Command = `npm start`.
- Set all required environment variables: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `AI_SERVICE_URL`, `AI_SERVICE_API_KEY`, `GOOGLE_CLIENT_ID`, `PORT`, `CORS_ORIGINS`, `NODE_ENV=production`.
- Verify the `/health` endpoint returns OK and database migrations are applied.
- Seed demo data if the cloud database is empty.

###   Step 2: Deploy hemora-ai to Render
Deploy the FastAPI AI service to Render as a second Web Service.
- Create a Render Web Service: Root Directory = `hemora-ai`, Environment = Python, Build Command = `pip install -r requirements.txt`, Start Command = `uvicorn main:app --host 0.0.0.0 --port $PORT`.
- Set environment variables: `AI_SERVICE_API_KEY` (must match the backend's key), `PORT=8000`.
- Update the backend's `AI_SERVICE_URL` env var on Render to point to the new AI service URL.
- Verify `/health` returns OK and test a prediction endpoint with the API key.
- Confirm the backend can successfully call the AI service end-to-end.

###   Step 3: Build and distribute APK with production API URL
Build the Android APK with the hosted backend URL baked in and install it on the supervisor's phone.
- Update `hemora-mobile/.env`: set `EXPO_PUBLIC_API_URL` to the Render backend URL (e.g., `https://hemora-backend.onrender.com`).
- Run `npx expo run:android` for a local USB build, or `npx eas build --platform android --profile preview` for a cloud build with download link.
- Transfer the APK to the supervisor's phone via USB, email, or download link.
- Install the APK on the phone, disable Wi-Fi, enable mobile data, and verify the app can log in and load data from the cloud backend.
- Run through the demo scenarios from `DEMO_SCENARIOS.md` on the phone with mobile data only.