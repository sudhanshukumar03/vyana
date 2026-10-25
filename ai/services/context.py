"""Shared data minimization and freshness handling for every model request."""
from datetime import date, datetime, timezone
from services.deterministic import has_current_vitals, get_deterministic_insights


def age_context(context):
    profile = (context or {}).get("profile") or {}
    try:
        born = date.fromisoformat(str(profile.get("dob", ""))[:10])
        today = datetime.now(timezone.utc).date()
        age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
        if age < 0 or age > 130:
            raise ValueError("Invalid age")
    except (TypeError, ValueError):
        return {"age_group": "unknown", "age_years": None}
    return {"age_group": "adult" if age >= 20 else "under_20", "age_years": age}


def model_context(context):
    value = dict(context or {})
    value["profile"] = {key: item for key, item in (value.get("profile") or {}).items() if key != "dob"}
    value["profile"].update(age_context(context))
    vitals = value.get("vitals") or {}
    if not has_current_vitals(vitals, value.get("fresh", False)):
        value.update(fresh=False, wellness_score=None,
            vitals={"source": vitals.get("source"), "observed_at": vitals.get("observed_at"),
                    "status": "No fresh complete readings; do not assess current health."})
    elif any(entry["type"] == "critical" for entry in get_deterministic_insights(vitals)):
        value.update(fresh=False, wellness_score=None,
            vitals={"source": vitals.get("source"), "observed_at": vitals.get("observed_at"),
                "status": "Critical project threshold flags exist. The server appends the factual snapshot. Do not infer physical symptoms, diagnoses or exercise readiness from these prototype values."})
    return value
