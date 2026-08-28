import os
import json
import psycopg2
from google import genai
from google.genai import types

def get_historical_vitals(days: int) -> str:
    """Connects to the HealthGuard database and returns the average heart rate and SpO2 over the last X days."""
    try:
        conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/healthguard")
        cur = conn.cursor()
        cur.execute(f"SELECT AVG(heart_rate), AVG(spo2) FROM vitals WHERE timestamp >= NOW() - INTERVAL '{days} days'")
        row = cur.fetchone()
        cur.close()
        conn.close()
        if row and row[0] is not None:
            return json.dumps({"average_heart_rate": float(row[0]), "average_spo2": float(row[1])})
        return json.dumps({"error": "No historical data found."})
    except Exception as e:
        return json.dumps({"error": str(e)})

def generate_insights(vitals, activity, alerts, wellness_score):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return [{"type": "info", "title": "AI Offline", "detail": "Gemini API key is not configured. Add GEMINI_API_KEY to your environment variables."}]
    
    try:
        client = genai.Client(api_key=api_key)
        
        prompt = f"""
        You are the AI engine for HealthGuard. Analyze the following user data and generate 2-3 brief, helpful health insights.
        Do not diagnose or prescribe. Provide wellness suggestions and identify patterns.
        
        Vitals: {vitals}
        Activity: {activity}
        Recent Alerts: {alerts}
        Wellness Score: {wellness_score}
        
        You have access to a tool to get historical vitals if needed.
        
        Respond ONLY with valid JSON in this exact format:
        {{
            "insights": [
                {{
                    "type": "info",
                    "title": "Short title",
                    "detail": "Detailed explanation"
                }}
            ]
        }}
        The 'type' must be one of: 'info', 'warning', 'success'.
        """
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                tools=[get_historical_vitals],
            ),
        )
        data = json.loads(response.text)
        return data.get("insights", [])
    except Exception as e:
        print(f"Gemini generation error: {e}")
        return [{"type": "warning", "title": "AI Unavailable", "detail": "Could not connect to AI service. Using fallback insights."}]
