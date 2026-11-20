# Phase 8 — AI Blood Forecasting Module

## Requirements

### Overview

Phase 8 implements the **AI Blood Forecasting Module** — the central innovation of HEMORA. This phase creates a Python FastAPI forecasting service with a real ML model (Scikit-learn), prepares a historical demand dataset, and connects the bank manager dashboard to display forecasts, shortage alerts, and visualizations.

### Goals

- Create a Python FastAPI service at `http://localhost:8000` that the backend's forecast endpoint can call.
- Build a real ML model (not random numbers) using historical blood demand data.
- Display forecast results in the bank manager dashboard with visual indicators.
- Show shortage alerts when predicted demand exceeds inventory.
- Evaluate and display model performance metrics.

### User Stories

- As a blood bank manager, I want to see predicted blood demand for each blood group so I can plan inventory.
- As a blood bank manager, I want to know which blood groups will face shortages so I can mobilize donors.
- As a demonstrator, I want to see model performance metrics so the AI component is credible.

### Scope

**In Scope:**
- Python FastAPI service with `/predict` endpoint.
- Historical blood demand dataset (synthetic but realistic, clearly labeled as demonstration data).
- Scikit-learn regression model (RandomForest) trained on the dataset.
- Model performance evaluation (MAE, RMSE, R²).
- Bank manager dashboard AI Forecasting section connected to real predictions.
- Forecast cards for each blood group showing predicted demand, current stock, and deficit.
- Shortage alerts for blood groups where predicted demand > available stock.
- Simple bar chart visualization comparing inventory vs predicted demand.
- Model info card showing engine name and performance metrics.

**Out of Scope:**
- Real-time model retraining.
- Advanced time series models (Prophet, LSTM).
- Web-based admin for model management.
- Integration with external blood bank data sources.

## Technical Design

### Current Implementation

**Backend (`hemora-backend/src/routes/prototype.routes.ts` lines 197-240):**
- `POST /api/hemora/forecast` accepts `{ bloodGroup }`, calls `http://localhost:8000/predict` with `{ blood_group, lead_time_days: 7 }`.
- Falls back to hardcoded heuristic baselines if AI service is offline.
- Returns `{ bloodGroup, availableUnits, predictedDemand, deficit, mobilizationRequired, engine }`.
- Requires `forecast: ["view"]` permission.

**Bank Manager Dashboard (`bank-manager.tsx` lines 613-621):**
- AI Forecasting section shows a static "Coming Soon" badge.
- Forecast stat card shows "—" placeholder.
- No charting library installed.

**No Python service exists.** The `AI_SERVICE_URL` env var points to `http://localhost:8000` but nothing runs there.

### Key Decisions

- **Scikit-learn RandomForestRegressor** for the ML model — it provides interpretable feature importance, handles non-linear relationships, and produces credible R² scores on structured data.
- **Synthetic historical dataset** generated with realistic patterns (seasonal variation, blood group distribution matching real-world frequencies, component breakdown). Clearly labeled as demonstration data.
- **Custom bar chart** using React Native View components — avoids native compilation issues with charting libraries.
- **Backend remains the gateway** — the mobile app calls `POST /api/hemora/forecast` (existing endpoint), which proxies to the Python service. No direct mobile-to-AI calls.
- **Batch forecast endpoint** — add `POST /api/hemora/forecast/all` to get forecasts for all 8 blood groups in one call.

### Proposed Changes

**New: Python FastAPI service (`hemora-ai/`):**
- Create `hemora-ai/` directory with `main.py`, `model.py`, `data.py`, `dataset.csv`, and `requirements.txt`.
- `main.py`: FastAPI app with `/predict` endpoint (matches existing backend contract) and `/health` endpoint.
- `model.py`: RandomForestRegressor trained on historical demand data.
- `data.py`: Dataset loading and feature engineering.
- `dataset.csv`: 2 years of weekly historical blood demand data with realistic patterns.
- `requirements.txt`: fastapi, uvicorn, scikit-learn, pandas, numpy.

**Backend (`prototype.routes.ts`):**
- Add `POST /api/hemora/forecast/all` endpoint that calls the AI service for all 8 blood groups and returns aggregated results with inventory comparison.
- Add `GET /api/hemora/forecast/model-info` endpoint that returns model performance metrics from the AI service.

**Mobile — Refactor `bank-manager.tsx`:**
- Replace "Coming Soon" AI Forecasting section with real forecast data.
- Add `useQuery` hooks for forecast data and model info.
- Display forecast cards for each blood group showing predicted demand, current stock, and deficit/surplus.
- Add shortage alerts for blood groups with deficit.
- Add a bar chart comparing inventory vs predicted demand using View components.
- Display model info card with engine name, R² score, MAE, and RMSE.
- Update the Forecast stat card to show a real value.

### Components Affected

| File | Change |
|---|---|
| `hemora-ai/main.py` | New: FastAPI app with `/predict`, `/predict/all`, `/health`, `/model-info` |
| `hemora-ai/model.py` | New: RandomForestRegressor training and prediction |
| `hemora-ai/data.py` | New: Dataset loading and feature engineering |
| `hemora-ai/dataset.csv` | New: Historical blood demand dataset |
| `hemora-ai/requirements.txt` | New: Python dependencies |
| `hemora-backend/src/routes/prototype.routes.ts` | Add `POST /forecast/all` and `GET /forecast/model-info` |
| `hemora-mobile/src/app/(main)/_dashboard/bank-manager.tsx` | Replace AI Forecasting placeholder with real data and chart |

## Delivery Steps

### ✓ Step 1: Create Python FastAPI forecasting service
Create the hemora-ai directory with a working FastAPI service that serves predictions.
- Create `hemora-ai/` directory with `main.py`, `model.py`, `data.py`, `dataset.csv`, and `requirements.txt`.
- Generate a realistic 2-year weekly historical blood demand dataset with seasonal patterns and blood group frequency distribution.
- Implement RandomForestRegressor model training in `model.py` with feature engineering.
- Create FastAPI endpoints: `POST /predict` (single blood group), `POST /predict/all` (all 8 blood groups), `GET /model-info` (returns R², MAE, RMSE), and `GET /health`.
- Install dependencies and verify the service starts on port 8000.

### ✓ Step 2: Add batch forecast and model-info endpoints to backend
Add new backend endpoints to support bulk forecasting and model info display.
- Add `POST /api/hemora/forecast/all` to `prototype.routes.ts` that calls the AI service's `/predict/all` endpoint and merges results with current inventory data.
- Add `GET /api/hemora/forecast/model-info` that proxies the AI service's `/model-info` endpoint.
- Both endpoints require `forecast: ["view"]` permission.
- Include fallback values if the AI service is offline.

### ✓ Step 3: Build AI Forecasting UI in bank manager dashboard
Replace the static AI Forecasting section with real predictions, charts, and model metrics.
- Add `useQuery` hooks in `bank-manager.tsx` for `POST /api/hemora/forecast/all` and `GET /api/hemora/forecast/model-info`.
- Replace the "Coming Soon" AI Forecasting card with forecast cards for each blood group.
- Add shortage alert badges for blood groups where predicted demand exceeds inventory.
- Add a bar chart comparing inventory vs predicted demand across all 8 blood groups.
- Display a model info card showing engine name, R² score, MAE, and RMSE.
- Update the Forecast stat card to show the average predicted demand.
- Remove the "Coming Soon" badge from the AI Forecasting section.
