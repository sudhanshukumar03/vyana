from dotenv import load_dotenv
load_dotenv()
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from services.gemini import generate_insights
from services.deterministic import get_deterministic_insights
import time

app = FastAPI()

class HealthData(BaseModel):
    vitals: dict = None
    activity: dict = None
    alerts: list = None
    wellness_score: int = 100

_insight_cache = {
    "timestamp": 0,
    "insights": []
}
CACHE_TTL_SECONDS = 300

@app.post("/api/ai/insights")
def get_insights(data: HealthData):
    global _insight_cache
    now = time.time()
    
    if _insight_cache["insights"] and (now - _insight_cache["timestamp"] < CACHE_TTL_SECONDS):
        return {"insights": _insight_cache["insights"]}
        
    v = data.vitals or {}
    a = data.activity or {}
    al = data.alerts or []
    
    gemini_insights = generate_insights(v, a, al, data.wellness_score)
    
    if not gemini_insights or gemini_insights[0].get("title") in ["AI Offline", "AI Unavailable"]:
        deterministic = get_deterministic_insights(v, a)
        insights = gemini_insights + deterministic if gemini_insights else deterministic
    else:
        insights = gemini_insights
        
    _insight_cache["timestamp"] = now
    _insight_cache["insights"] = insights
    
    return {"insights": insights}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001)
