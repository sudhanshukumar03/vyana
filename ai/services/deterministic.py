def get_deterministic_insights(vitals, activity):
    insights = []
    
    if vitals and 'heart_rate' in vitals:
        hr = vitals['heart_rate']
        if hr > 100:
            insights.append({"type": "warning", "title": "Elevated Heart Rate", "detail": "Your resting heart rate is above 100 bpm. Consider resting."})
        elif hr < 60:
            insights.append({"type": "info", "title": "Low Heart Rate", "detail": "Your heart rate is quite low. If you are an athlete, this may be normal."})
            
    if vitals and 'spo2' in vitals:
        spo2 = vitals['spo2']
        if spo2 < 95:
            insights.append({"type": "warning", "title": "Slightly Low Oxygen", "detail": "Your SpO2 is below 95%. Taking deep breaths may help."})
            
    if activity and 'steps' in activity:
        if activity['steps'] > 10000:
            insights.append({"type": "success", "title": "Activity Goal Met", "detail": "You've exceeded 10,000 steps today. Great job!"})
        elif activity['steps'] < 2000:
            insights.append({"type": "info", "title": "Low Activity", "detail": "You've been mostly stationary today. A short walk could boost energy."})
            
    if not insights:
        insights.append({"type": "success", "title": "Stable Vitals", "detail": "Your vitals are stable and within optimal ranges."})
        
    # Limit to 3 insights max
    return insights[:3]
