"""Authenticated internal AI API. Run with uvicorn main:app inside ai/."""
import hashlib
import json
import os
import threading
import time
from collections import OrderedDict
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from services.boundary import InternalBoundary
from services.models import HealthData, ChatRequest, ReportRequest, InsightResponse, ChatResponse, ReportResponse
from services.gemini import generate_insights
from services.assistant import chat_reply, analyze_report
from services.deterministic import get_deterministic_insights, has_current_vitals

load_dotenv()


@asynccontextmanager
async def lifespan(_app):
    if len(os.environ.get("AI_INTERNAL_SECRET", "")) < 32:
        raise RuntimeError("AI_INTERNAL_SECRET must contain at least 32 characters")
    yield


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
_cache = OrderedDict()
_cache_lock = threading.Lock()
_inflight = {}
CACHE_TTL_SECONDS = 300


app.add_middleware(InternalBoundary)


@app.get("/health/live")
def health():
    return {"status": "alive"}


def _insight_signature(data):
    vitals = {key: data.vitals.get(key) for key in ("heart_rate", "spo2", "temperature", "ecg_status")}
    activity = {key: data.activity.get(key) for key in ("steps", "calories", "distance_km", "active_minutes")}
    profile = {key: value for key, value in data.profile.items() if key not in ("id", "user_id", "created_at", "updated_at")}
    alerts = [{key: alert.get(key) for key in ("metric", "severity", "status")} for alert in data.alerts if isinstance(alert, dict)]
    history = {key: value for key, value in data.historical_vitals.items() if key != 'sample_count'}
    review = data.health_review.model_dump() if data.health_review else None
    values = [data.owner_id, vitals, activity, profile, alerts, history, review, data.wellness_score, data.bmi, data.fresh, int(time.time() // 30)]
    return hashlib.sha256(json.dumps(values, sort_keys=True, default=str).encode()).hexdigest()


def _check_owner(request, owner_id):
    if request.headers.get("x-owner-id") != owner_id:
        raise HTTPException(status_code=403, detail="Owner mismatch")


@app.post("/api/ai/insights", response_model=InsightResponse)
def get_insights(data: HealthData, request: Request):
    _check_owner(request, data.owner_id)
    fallback = get_deterministic_insights(data.vitals, data.activity, data.fresh)
    if not has_current_vitals(data.vitals, data.fresh) or any(entry["type"] == "critical" for entry in fallback):
        return {"insights": fallback, "offline": True}
    key = _insight_signature(data)
    with _cache_lock:
        cached = _cache.get(key)
        if cached and time.monotonic() - cached[0] < CACHE_TTL_SECONDS:
            _cache.move_to_end(key)
            return {"insights": cached[1], "offline": cached[2]}
        event = _inflight.get(key)
        leader = event is None
        if leader:
            if len(_inflight) >= 8:
                return {"insights": fallback, "offline": True}
            event = _inflight[key] = threading.Event()
    if not leader:
        event.wait(timeout=31)
        with _cache_lock:
            cached = _cache.get(key)
            return {"insights": cached[1] if cached else fallback, "offline": cached[2] if cached else True}
    try:
        try:
            args = (data.vitals, data.activity, data.alerts, data.wellness_score, data.profile, data.bmi, data.historical_vitals)
            generated = generate_insights(*args, health_review=data.health_review.model_dump()) if data.health_review else generate_insights(*args)
            validated = InsightResponse.model_validate({"insights": generated})
            generated = [entry.model_dump() for entry in validated.insights]
            # Keep deterministic threshold warnings visible even when the model omits them.
            warnings = [entry for entry in fallback if entry["type"] in ("warning", "critical")]
            insights = (warnings + generated)[:8]
            offline = False
        except Exception:
            insights = fallback
            offline = True
        with _cache_lock:
            _cache[key] = (time.monotonic(), insights, offline)
            while len(_cache) > 128:
                _cache.popitem(last=False)
        return {"insights": insights, "offline": offline}
    finally:
        with _cache_lock:
            _inflight.pop(key, None)
            event.set()


@app.post("/api/ai/chat", response_model=ChatResponse)
def post_chat(data: ChatRequest, request: Request):
    _check_owner(request, data.owner_id)
    context = data.model_dump(exclude={"history", "message", "owner_id"})
    return chat_reply(data.message, [turn.model_dump() for turn in data.history], context)


@app.post("/api/ai/report", response_model=ReportResponse)
def post_report(data: ReportRequest, request: Request):
    _check_owner(request, data.owner_id)
    try:
        raw = data.decode()
    except OverflowError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    context = data.model_dump(exclude={"data_base64", "mime_type", "filename", "owner_id"})
    return analyze_report(raw, data.mime_type, context)
