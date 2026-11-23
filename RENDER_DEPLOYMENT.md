# Render Deployment Guide — Hemora

> **Generated on:** 2026-11-23
> **GitHub Repo:** https://github.com/chimputu/Hemora
> **Branch:** main (commit 44702c9)

---

## Generated Secrets

Copy these values into the Render dashboard. **Do not share them publicly.**

| Key | Value |
|---|---|
| `JWT_SECRET` | `v0gRFHO6urx7tVGybPLB9CFfyqa+4upHmdAr/Wpen6c=` |
| `JWT_REFRESH_SECRET` | `3qguagNTS5I9V7WJpWU534vN5+JAk311Ton+FXGQ7lY=` |
| `AI_SERVICE_API_KEY` | `e0a269cf44849ab3328da6dfa5ca2f9e640f1e95253972efb357ac12823babdc` |

---

## Step 1: Deploy hemora-backend to Render

### 1. Go to Render Dashboard

Open: https://dashboard.render.com → **New +** → **Web Service**

### 2. Connect Repository

- Click **Connect a repository**
- Find and select `chimputu/Hemora`
- Click **Connect**

### 3. Service Configuration

| Field | Exact Value |
|---|---|
| **Name** | `hemora-backend` |
| **Root Directory** | `hemora-backend` |
| **Environment** | `Node` |
| **Variant** | `Other` |
| **Build Command** | `npm ci && npx prisma generate && npx prisma migrate deploy && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | **Starter** ($7/mo) — recommended for demo to prevent sleep mode |

> ⚠️ **Free tier warning**: Free instances sleep after 15 minutes of inactivity. The first request after sleep takes 30-60 seconds. Use Starter tier for the demo.

### 4. Environment Variables

Click **"Add Environment Variable"** and add each of these:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `postgresql://postgres.fmvbkaliixhyssydseti:kafiswe20031234@aws-0-eu-central-1.pooler.supabase.com:5432/postgres` |
| `JWT_SECRET` | `v0gRFHO6urx7tVGybPLB9CFfyqa+4upHmdAr/Wpen6c=` |
| `JWT_REFRESH_SECRET` | `3qguagNTS5I9V7WJpWU534vN5+JAk311Ton+FXGQ7lY=` |
| `AI_SERVICE_URL` | *(leave blank for now — set after Step 2)* |
| `AI_SERVICE_API_KEY` | `e0a269cf44849ab3328da6dfa5ca2f9e640f1e95253972efb357ac12823babdc` |
| `GOOGLE_CLIENT_ID` | `77537056928-eos2s4ip0f4u1j317018l5pllb4lf7ch.apps.googleusercontent.com` |
| `PORT` | `5000` |
| `CORS_ORIGINS` | `hemora://,http://localhost:8081` |

### 5. Click "Create Web Service"

Render will start building. Watch the logs for:
1. `npm ci` — install dependencies
2. `npx prisma generate` — generate Prisma client
3. `npx prisma migrate deploy` — apply database migrations to Supabase
4. `npm run build` — compile TypeScript
5. `npm start` — start the server

### 6. Verify Deployment

Once deployed, Render assigns a URL like `https://hemora-backend.onrender.com`.

Test in your browser or terminal:
```bash
curl https://hemora-backend.onrender.com/health
```

Expected: `{"status":"ok","service":"hemora-backend"}`

---

## Step 2: Deploy hemora-ai to Render

### 1. Create a New Web Service

Go to https://dashboard.render.com → **New +** → **Web Service**
- Connect the same GitHub repo: `chimputu/Hemora`

### 2. Service Configuration

| Field | Exact Value |
|---|---|
| **Name** | `hemora-ai` |
| **Root Directory** | `hemora-ai` |
| **Environment** | `Python` |
| **Python Version** | `3.11` (or latest available) |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| **Instance Type** | **Starter** ($7/mo) — recommended for demo |

### 3. Environment Variables

| Key | Value |
|---|---|
| `AI_SERVICE_API_KEY` | `e0a269cf44849ab3328da6dfa5ca2f9e640f1e95253972efb357ac12823babdc` |
| `PORT` | `8000` |

### 4. Click "Create Web Service"

### 5. Verify Deployment

Test:
```bash
curl https://hemora-ai.onrender.com/health
```

Expected: `{"status":"ok","service":"hemora-ai"}`

### 6. Link Backend to AI Service

After the AI service is deployed:
1. Go to the **hemora-backend** service on Render
2. Click **Environment** tab
3. Update `AI_SERVICE_URL` to the AI service's URL (e.g., `https://hemora-ai.onrender.com`)
4. Save changes — Render will auto-redeploy the backend

### 7. Test Backend → AI Connection

```bash
curl https://hemora-backend.onrender.com/api/hemora/forecast/all
```

This should return forecast data from the AI service.

---

## Step 3: Build the APK with Production URL

### 1. Update Mobile .env

Once the backend is deployed, update `hemora-mobile/.env`:

```
EXPO_PUBLIC_API_URL="https://hemora-backend.onrender.com"
EXPO_PUBLIC_GOOGLE_CLIENT_ID="77537056928-eos2s4ip0f4u1j317018l5pllb4lf7ch.apps.googleusercontent.com"
```

> ⚠️ Replace `hemora-backend.onrender.com` with your actual Render URL.

### 2. Build the APK

**Option A: Local USB Build (Fastest)**
```bash
cd /home/chimputu/Desktop/Hemora/hemora-mobile
npx expo run:android
```

**Option B: EAS Cloud Build (Download Link)**
```bash
cd /home/chimputu/Desktop/Hemora/hemora-mobile
npx eas build --platform android --profile preview
```

### 3. Transfer to Phone

- USB transfer, email, or Google Drive
- Install the APK on the supervisor's phone
- Enable "Install from Unknown Sources" if prompted

---

## Step 4: Pre-Demo Checklist

### Backend (Render)
- [ ] hemora-backend deployed and healthy (`/health` returns OK)
- [ ] All environment variables set
- [ ] Database migrations applied (Supabase schema matches Prisma)
- [ ] Demo data seeded in Supabase
- [ ] `CORS_ORIGINS` includes `hemora://`
- [ ] Backend can reach AI service (test `/api/hemora/forecast/all`)

### AI Service (Render)
- [ ] hemora-ai deployed and healthy (`/health` returns OK)
- [ ] `AI_SERVICE_API_KEY` matches backend's key
- [ ] `dataset.csv` included in deployment

### Mobile App
- [ ] `EXPO_PUBLIC_API_URL` points to Render backend URL
- [ ] APK built with correct API URL
- [ ] APK installed on supervisor's phone
- [ ] Test login with `admin@hemora.zm` / `Demo1234!` on mobile data

### Network
- [ ] Supervisor's phone has mobile data enabled
- [ ] Wi-Fi turned off during demo
- [ ] Hit `/health` endpoints right before demo to wake services
- [ ] Keep Render dashboard open on laptop

---

## Demo Account Credentials

| Email | Password | Role |
|---|---|---|
| `admin@hemora.zm` | `Demo1234!` | ADMIN |
| `doctor@hemora.zm` | `Demo1234!` | DOCTOR |
| `nurse@hemora.zm` | `Demo1234!` | NURSE |
| `bankmanager@hemora.zm` | `Demo1234!` | MANAGER |
| `donor@hemora.zm` | `Demo1234!` | DONOR |

---

## Emergency Contacts

- Keep the Render dashboard open: https://dashboard.render.com
- Know how to restart services from the dashboard
- Have demo credentials ready
