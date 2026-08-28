import time
from .gemini import generate_insights
from .deterministic import get_deterministic_insights

_insight_cache = {
    "timestamp": 0,
    "insights": []
}

CACHE_TTL_SECONDS = 60 * 5  # Regenerate every 5 minutes

def get_health_insights(vitals, activity, alerts, wellness_score):
    global _insight_cache
    
    now = time.time()
    if _insight_cache["insights"] and (now - _insight_cache["timestamp"] < CACHE_TTL_SECONDS):
        return _insight_cache["insights"]
        
    gemini_insights = generate_insights(vitals, activity, alerts, wellness_score)
    
    if not gemini_insights or gemini_insights[0].get("title") in ["AI Offline", "AI Unavailable"]:
        deterministic = get_deterministic_insights(vitals, activity)
        insights = gemini_insights + deterministic if gemini_insights else deterministic
    else:
        insights = gemini_insights
        
    _insight_cache["timestamp"] = now
    _insight_cache["insights"] = insights
    
    return insights
