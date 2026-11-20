"""
HEMORA AI Forecasting Service
FastAPI application that serves blood demand predictions.
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

import model

app = FastAPI(
    title="HEMORA AI Forecasting Service",
    description="Blood demand forecasting using machine learning",
    version="1.0.0",
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
    """Health check endpoint."""
    return {"status": "ok", "service": "hemora-ai"}

@app.post("/predict")
def predict(req: PredictRequest):
    """
    Predict blood demand for a specific blood group.
    Returns forecasted demand in units.
    """
    if req.blood_group not in VALID_BLOOD_GROUPS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid blood_group. Must be one of: {', '.join(sorted(VALID_BLOOD_GROUPS))}"
        )
    
    try:
        demand = model.predict_demand(req.blood_group, req.lead_time_days)
        return {
            "blood_group": req.blood_group,
            "forecasted_demand_units": demand,
            "lead_time_days": req.lead_time_days,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/all")
def predict_all(req: PredictAllRequest):
    """
    Predict blood demand for all blood groups.
    Returns a dict of blood_group -> forecasted_demand_units.
    """
    try:
        results = model.predict_all_groups(req.lead_time_days)
        return {
            "lead_time_days": req.lead_time_days,
            "forecasts": results,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/model-info")
def model_info():
    """
    Return model performance metrics.
    """
    info = model.get_model_info()
    if "error" in info:
        raise HTTPException(status_code=503, detail=info["error"])
    return info

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
