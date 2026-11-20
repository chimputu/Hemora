"""
Generate a realistic historical blood demand dataset for HEMORA AI forecasting.
This is demonstration data with realistic patterns based on blood group frequency
distribution and seasonal variation.
"""
import csv
import random
import os
from datetime import datetime, timedelta

random.seed(42)

# Blood groups with relative demand weights (based on real-world frequency)
BLOOD_GROUPS = {
    "O_POS": 0.25,
    "O_NEG": 0.13,
    "A_POS": 0.20,
    "A_NEG": 0.08,
    "B_POS": 0.17,
    "B_NEG": 0.07,
    "AB_POS": 0.07,
    "AB_NEG": 0.03,
}

COMPONENTS = {
    "WHOLE_BLOOD": 0.30,
    "Packed_RBC": 0.40,
    "PLASMA": 0.20,
    "PLATELETS": 0.10,
}

# Seasonal factors (higher demand in certain months)
SEASONAL_FACTORS = {
    1: 1.1,   # January - post-holiday surge
    2: 0.95,  # February
    3: 0.9,   # March
    4: 0.85,  # April
    5: 0.9,   # May
    6: 0.85,  # June
    7: 0.9,   # July
    8: 1.0,   # August
    9: 1.1,   # September - back to school
    10: 1.05, # October
    11: 1.0,  # November
    12: 1.15, # December - holiday season
}

# Day of week factor (weekends have lower demand)
DAY_FACTORS = {0: 0.7, 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0, 5: 0.8, 6: 0.6}

# Base weekly demand (total units across all groups)
BASE_WEEKLY_DEMAND = 120

def generate_dataset():
    """Generate 2 years of weekly blood demand data."""
    output_path = os.path.join(os.path.dirname(__file__), "dataset.csv")
    
    start_date = datetime(2024, 1, 1)
    weeks = 104  # 2 years
    
    rows = []
    
    for week_idx in range(weeks):
        week_start = start_date + timedelta(weeks=week_idx)
        month = week_start.month
        day_of_week = week_start.weekday()
        
        seasonal = SEASONAL_FACTORS.get(month, 1.0)
        day_factor = DAY_FACTORS.get(day_of_week, 1.0)
        
        # Add some trend (slight increase over time)
        trend = 1.0 + (week_idx / weeks) * 0.1
        
        # Random noise
        noise = random.gauss(1.0, 0.1)
        
        for bg, bg_weight in BLOOD_GROUPS.items():
            for comp, comp_weight in COMPONENTS.items():
                # Calculate demand for this combination
                base = BASE_WEEKLY_DEMAND * bg_weight * comp_weight
                demand = base * seasonal * day_factor * trend * noise
                
                # Add some randomness
                demand = max(0, demand + random.gauss(0, 1))
                
                rows.append({
                    "date": week_start.strftime("%Y-%m-%d"),
                    "week_number": week_idx + 1,
                    "month": month,
                    "day_of_week": day_of_week,
                    "blood_group": bg,
                    "component": comp,
                    "demand_units": round(demand, 2),
                })
    
    # Write CSV
    fieldnames = ["date", "week_number", "month", "day_of_week", "blood_group", "component", "demand_units"]
    with open(output_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    
    print(f"Generated {len(rows)} records in {output_path}")
    return output_path

if __name__ == "__main__":
    generate_dataset()
