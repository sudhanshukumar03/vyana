import time
import random
import requests
import os
import datetime

API_BASE = "http://127.0.0.1:8000/api/v1"
INTERVAL = int(os.environ.get("SIMULATION_INTERVAL", 5))
SCENARIO = os.environ.get("SIMULATION_SCENARIO", "normal")

# State
steps = 0
distance = 0.0
calories = 0

def generate_vitals():
    base_hr = 72
    base_spo2 = 98
    base_temp = 36.7
    
    if SCENARIO == "high_heart_rate":
        base_hr = random.randint(120, 140)
    elif SCENARIO == "low_spo2":
        base_spo2 = random.randint(88, 91)
    elif SCENARIO == "high_temperature":
        base_temp = random.uniform(38.5, 39.5)
    else:
        base_hr += random.randint(-5, 5)
        base_spo2 += random.randint(-1, 1)
        base_temp += random.uniform(-0.2, 0.2)
        
    base_spo2 = min(100, max(50, base_spo2))
        
    return {
        "heart_rate": int(base_hr),
        "spo2": float(base_spo2),
        "temperature": round(base_temp, 1),
        "ecg_status": "Normal" if SCENARIO == "normal" else "Irregular",
        "source": "Simulator"
    }

def generate_activity():
    global steps, distance, calories
    new_steps = random.randint(10, 50)
    steps += new_steps
    distance += new_steps * 0.000762 # roughly 30 inches per step
    calories += new_steps * 0.04
    
    return {
        "steps": steps,
        "distance_km": round(distance, 2),
        "calories": int(calories),
        "active_minutes": int(steps / 100),
        "source": "Simulator"
    }

def post_data(endpoint, data):
    try:
        url = f"{API_BASE}/{endpoint}"
        print(f"POST {url} - {data}")
        res = requests.post(url, json=data, timeout=2)
        if res.status_code >= 400:
            print(f"Error {res.status_code}: {res.text}")
    except Exception as e:
        print(f"Connection error: {e}")

def run():
    print(f"Starting simulator. Scenario: {SCENARIO}, Interval: {INTERVAL}s")
    
    # Device status
    post_data("device/status", {
        "device_name": "HealthGuard Smart Band",
        "connected": True,
        "battery": 85,
        "source": "Simulator"
    })
    
    while True:
        vitals = generate_vitals()
        activity = generate_activity()
        
        post_data("ingest/vitals", vitals)
        post_data("ingest/activity", activity)
        
        time.sleep(INTERVAL)

if __name__ == "__main__":
    run()
