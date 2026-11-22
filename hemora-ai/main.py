"""
HEMORA AI Forecasting Service
FastAPI application that serves blood demand predictions.
"""
from fastapi import FastAPI, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from typing import Optional
import os

import model

app = FastAPI(
    title="HEMORA AI Forecasting Service",
    description="Blood demand forecasting using machine learning",
    version="1.0.0",
)

# API key authentication for backend-to-AI communication
# Set AI_SERVICE_API_KEY environment variable on both the backend and AI service
security = HTTPBearer()

def get_api_key() -> str:
    """Get the API key from environment variable."""
    return os.environ.get("AI_SERVICE_API_KEY", "")

def verify_api_key(credentials: HTTPAuthorizationCredentials) -> bool:
    """Verify the API key matches the configured key."""
    expected_key = get_api_key()
    if not expected_key:
        # If no API key is configured, allow access (development mode)
        return True
    return credentials.credentials == expected_key

def require_api_key(request: Request) -> None:
    """Middleware to require API key authentication on protected endpoints."""
    expected_key = get_api_key()
    if not expected_key:
        # If no API key is configured, allow access (development mode)
        return
    
    auth_header = request.headers.get("authorization", "")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid authorization header"
        )
    
    token = auth_header.replace("Bearer ", "")
    if token != expected_key:
        raise HTTPException(
            status_code=403,
            detail="Invalid API key"
        )

class PredictRequest(BaseModel):
    blood_group: str
    lead_time_days: int = 7

class PredictAllRequest(BaseModel):
    lead_time_days: int = 7

# Valid blood groups
VALID_BLOOD_GROUPS = {"O_POS", "O_NEG", "A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG"}

@app.get("/health")
def health_check():
    """Health check endpoint — no authentication required."""
    return {"status": "ok", "service": "hemora-ai"}

@app.post("/predict")
def predict(request: Request, req: PredictRequest):
    """
    Predict blood demand for a specific blood group.
    Returns forecasted demand in units.
    Requires API key authentication.
    """
    require_api_key(request)
    
    if req.blood_group not in VALID_BLOOD_GROUPS:
        raise HTTPException(
            status_code=400,
            detail="Invalid blood_group. Must be one of: O_POS, O_NEG, A_POS, A_NEG, B_POS, B_NEG, AB_POS, AB_NEG"
        )
    
    try:
        demand = model.predict_demand(req.blood_group, req.lead_time_days)
        return {
            "blood_group": req.blood_group,
            "forecasted_demand_units": demand,
            "lead_time_days": req.lead_time_days,
        }
    except Exception:
        raise HTTPException(status_code=500, detail="Prediction failed")

@app.post("/predict/all")
def predict_all(request: Request, req: PredictAllRequest):
    """
    Predict blood demand for all blood groups.
    Returns a dict of blood_group -> forecasted_demand_units.
    Requires API key authentication.
    """
    require_api_key(request)
    
    try:
        results = model.predict_all_groups(req.lead_time_days)
        return {
            "lead_time_days": req.lead_time_days,
            "forecasts": results,
        }
    except Exception:
        raise HTTPException(status_code=500, detail="Prediction failed")

@app.get("/model-info")
def model_info(request: Request):
    """
    Return model performance metrics.
    Requires API key authentication.
    """
    require_api_key(request)
    
    info = model.get_model_info()
    if "error" in info:
        raise HTTPException(status_code=503, detail="Model info unavailable")
    return info

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
