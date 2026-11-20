"""
ML model training and prediction for HEMORA AI forecasting.
Uses RandomForestRegressor trained on historical blood demand data.
"""
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from data import load_dataset, prepare_features, prepare_prediction_features

# Global model and metrics
model = None
metrics = None
feature_names = None

def train_model():
    """Train the RandomForest model on historical data."""
    global model, metrics, feature_names
    
    print("Loading dataset...")
    df = load_dataset()
    
    print("Preparing features...")
    X, y, feature_names = prepare_features(df)
    
    # Split data: 80% train, 20% test
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    print("Training RandomForest model...")
    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=10,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    
    # Evaluate on test set
    y_pred = model.predict(X_test)
    
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)
    
    metrics = {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "r2": round(r2, 4),
        "model_type": "RandomForestRegressor",
        "n_estimators": 100,
        "max_depth": 10,
        "training_samples": len(X_train),
        "test_samples": len(X_test),
    }
    
    print(f"Model trained successfully!")
    print(f"  MAE:  {mae:.4f}")
    print(f"  RMSE: {rmse:.4f}")
    print(f"  R²:   {r2:.4f}")
    
    return model, metrics

def predict_demand(blood_group: str, lead_time_days: int = 7) -> float:
    """
    Predict demand for a blood group over the next lead_time_days.
    Returns the total predicted demand in units.
    """
    if model is None:
        raise RuntimeError("Model not trained. Call train_model() first.")
    
    # Predict for the next week (week 105) across all components
    # Use current month (November = 11) and Monday (day_of_week = 0)
    features = prepare_prediction_features(
        blood_group=blood_group,
        week_number=105,
        month=11,
        day_of_week=0,
    )
    
    # Predict for each component and sum
    predictions = model.predict(features)
    total_demand = float(np.sum(predictions))
    
    # Scale by lead_time_days (default 7 days = 1 week)
    scale_factor = lead_time_days / 7.0
    total_demand = total_demand * scale_factor
    
    return round(total_demand, 2)

def predict_all_groups(lead_time_days: int = 7) -> dict:
    """Predict demand for all blood groups."""
    if model is None:
        raise RuntimeError("Model not trained. Call train_model() first.")
    
    blood_groups = ["O_POS", "O_NEG", "A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG"]
    results = {}
    
    for bg in blood_groups:
        demand = predict_demand(bg, lead_time_days)
        results[bg] = demand
    
    return results

def get_model_info() -> dict:
    """Return model performance metrics."""
    if metrics is None:
        return {"error": "Model not trained"}
    return metrics

# Train on module import
train_model()
