import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_analyze_endpoint():
    payload = {
        "userId": "user-123",
        "heartRate": 85,
        "bloodOxygen": 96,
        "bodyTemp": 37.1
    }
    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "risk_score" in data
    assert "anomalies" in data

def test_root():
    response = client.get("/")
    assert response.status_code == 200
