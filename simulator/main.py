"""Authenticated wearable simulator with bounded replay and explicit session counters."""
import os
import random
import time
import uuid
from collections import deque
from datetime import datetime, timezone
import requests
from dotenv import load_dotenv

load_dotenv()
API_BASE = os.environ.get("API_BASE_URL", "http://127.0.0.1:8000/api/v1").rstrip("/")
INTERVAL = max(1, int(os.environ.get("SIMULATION_INTERVAL", "5")))
SCENARIO = os.environ.get("SIMULATION_SCENARIO", "normal")
steps = 0
active_seconds = 0


def generate_vitals():
    hr, oxygen, temperature = 72 + random.randint(-5, 5), 98 + random.randint(-1, 1), 36.7 + random.uniform(-.2, .2)
    if SCENARIO == "high_heart_rate":
        hr = random.randint(125, 140)
    elif SCENARIO == "critical_heart_rate":
        hr = 165
    elif SCENARIO == "low_spo2":
        oxygen = random.randint(88, 91)
    elif SCENARIO == "high_temperature":
        temperature = 40
    return {"heart_rate": hr, "spo2": oxygen, "temperature": round(temperature, 1), "ecg_status": "Normal", "source": "Simulator"}


def generate_activity():
    global steps, active_seconds
    steps += random.randint(10, 50)
    active_seconds += INTERVAL
    return {"steps": steps, "distance_km": round(steps * .000762, 3), "calories": int(steps * .04), "active_minutes": active_seconds // 60, "source": "Simulator"}


def retryable(status):
    return status in (408, 429) or status >= 500


def run():
    key = os.environ.get("DEVICE_KEY", "")
    if len(key) < 32:
        raise SystemExit("Provision a device, then configure DEVICE_KEY in simulator/.env or the environment.")
    pending = deque(maxlen=128)
    session, sequence = str(uuid.uuid4()), 0
    next_sample, retry_at, attempts, dropped = 0.0, 0.0, 0, 0
    with requests.Session() as client:
        client.headers.update({"X-Device-Key": key})
        try:
            while True:
                now = time.monotonic()
                if now >= next_sample:
                    sequence += 1
                    envelope = {"session_id": session, "sequence": sequence, "observed_at": datetime.now(timezone.utc).isoformat()}
                    values = [("ingest/vitals", {**generate_vitals(), **envelope}), ("ingest/activity", {**generate_activity(), **envelope}),
                              ("device/status", {"device_name": "Virtual wristband", "connected": True, "battery": 85, "source": "Simulator"})]
                    for record in values:
                        if len(pending) == pending.maxlen:
                            dropped += 1  # Keep the older acquisition order; drop newest explicitly.
                        else:
                            pending.append(record)
                    next_sample = now + INTERVAL
                if pending and now >= retry_at:
                    endpoint, body = pending[0]
                    try:
                        response = client.post(f"{API_BASE}/{endpoint}", json=body, timeout=(2, 3))
                        if 200 <= response.status_code < 300:
                            pending.popleft()
                            attempts = 0
                        elif retryable(response.status_code):
                            attempts += 1
                            delay = response.headers.get("Retry-After", "0")
                            retry_at = now + max(min(60, 2 ** min(attempts, 6)), min(300, int(delay)) if delay.isdigit() else 0)
                        else:
                            print(f"Record rejected ({response.status_code}); inspect device configuration/input.")
                            pending.popleft()
                            if response.status_code == 401:
                                raise SystemExit("Device credential revoked or invalid. Provision a new credential.")
                    except requests.RequestException:
                        attempts += 1
                        retry_at = now + min(60, 2 ** min(attempts, 6)) + random.random()
                    print(f"queued={len(pending)} dropped={dropped} retries={attempts}")
                time.sleep(.1)
        except KeyboardInterrupt:
            try:
                client.post(f"{API_BASE}/device/status", json={"device_name": "Virtual wristband", "connected": False, "battery": 85, "source": "Simulator"}, timeout=2)
            except requests.RequestException:
                pass  # Heartbeat expiry still marks the device offline.


if __name__ == "__main__":
    run()
