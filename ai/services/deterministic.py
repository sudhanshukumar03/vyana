"""Project threshold rules; these are not clinical diagnoses."""
import math


def get_deterministic_insights(vitals, activity=None, fresh=True):
    vitals = vitals or {}
    required = ("heart_rate", "spo2", "temperature")
    if not fresh or not all(isinstance(vitals.get(k), (float, int)) and math.isfinite(vitals[k]) for k in required):
        return [{"type": "info", "title": "Insufficient current data", "detail": "Fresh, complete readings are needed for a wellness summary."}]
    hr, oxygen, temp = (vitals[k] for k in required)
    flags = []
    if hr > 150 or hr < 40:
        flags.append(("critical", "Heart rate threshold", f"Heart rate: {hr} bpm."))
    elif hr > 120 or hr < 45:
        flags.append(("warning", "Heart rate threshold", f"Heart rate: {hr} bpm."))
    if oxygen < 88:
        flags.append(("critical", "Oxygen threshold", f"SpO2: {oxygen}%."))
    elif oxygen < 92:
        flags.append(("warning", "Oxygen threshold", f"SpO2: {oxygen}%."))
    if temp > 39.5:
        flags.append(("critical", "Temperature threshold", f"Temperature: {temp} C."))
    elif temp > 38 or temp < 35:
        flags.append(("warning", "Temperature threshold", f"Temperature: {temp} C."))
    if vitals.get("ecg_status") != "Normal":
        flags.append(("warning", "ECG status needs review", f"Status: {vitals.get('ecg_status', 'Unknown')}. No rhythm interpretation is available."))
    if flags:
        return [{"type": severity, "title": title, "detail": detail + " Review the reading and consult a qualified clinician if concerned."} for severity, title, detail in flags]
    return [{"type": "info", "title": "Current readings received", "detail": "No configured threshold alert was triggered. This is not a clinical assessment."}]
