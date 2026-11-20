"""
Data loading and feature engineering for HEMORA AI forecasting.
"""
import pandas as pd
import numpy as np
import os

def load_dataset():
    """Load the historical blood demand dataset."""
    dataset_path = os.path.join(os.path.dirname(__file__), "dataset.csv")
    df = pd.read_csv(dataset_path)
    return df

def encode_blood_group(bg: str) -> int:
    """Encode blood group as an integer."""
    mapping = {
        "O_POS": 0, "O_NEG": 1, "A_POS": 2, "A_NEG": 3,
        "B_POS": 4, "B_NEG": 5, "AB_POS": 6, "AB_NEG": 7,
    }
    return mapping.get(bg, -1)

def encode_component(comp: str) -> int:
    """Encode component as an integer."""
    mapping = {
        "WHOLE_BLOOD": 0, "Packed_RBC": 1, "PLASMA": 2, "PLATELETS": 3,
    }
    return mapping.get(comp, -1)

def prepare_features(df: pd.DataFrame) -> tuple:
    """
    Prepare features and target from the dataset.
    Returns (X, y) where X is the feature matrix and y is the target.
    """
    df = df.copy()
    
    # Encode categorical variables
    df["blood_group_encoded"] = df["blood_group"].apply(encode_blood_group)
    df["component_encoded"] = df["component"].apply(encode_component)
    
    # Feature columns
    feature_cols = ["week_number", "month", "day_of_week", "blood_group_encoded", "component_encoded"]
    
    X = df[feature_cols].values
    y = df["demand_units"].values
    
    return X, y, feature_cols

def prepare_prediction_features(blood_group: str, component: str = None, week_number: int = 105, month: int = 11, day_of_week: int = 0) -> np.ndarray:
    """
    Prepare features for a single prediction.
    """
    bg_encoded = encode_blood_group(blood_group)
    
    if component:
        comp_encoded = encode_component(component)
        return np.array([[week_number, month, day_of_week, bg_encoded, comp_encoded]])
    else:
        # Aggregate across all components
        features = []
        for comp in ["WHOLE_BLOOD", "Packed_RBC", "PLASMA", "PLATELETS"]:
            comp_encoded = encode_component(comp)
            features.append([week_number, month, day_of_week, bg_encoded, comp_encoded])
        return np.array(features)
