# HealthGuard API Documentation

## Base URL
`/api/v1`

## Endpoints

### 1. Ingest Vitals
`POST /api/v1/ingest/vitals`
Ingests vital signs data from ESP32 sensors or the simulator.

**Request Body:**
```json
{
  "userId": "uuid",
  "heartRate": 72,
  "bloodOxygen": 98,
  "bodyTemp": 36.5,
  "timestamp": "2026-08-28T00:00:00Z"
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Vitals ingested successfully"
}
```

### 2. Ingest Activity
`POST /api/v1/ingest/activity`
Ingests activity data (steps, motion).

**Request Body:**
```json
{
  "userId": "uuid",
  "steps": 1500,
  "activityType": "walking",
  "timestamp": "2026-08-28T00:00:00Z"
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Activity ingested successfully"
}
```

### 3. Health Summary
`GET /api/v1/health/summary?userId=<uuid>`
Retrieves a summary of the user's health metrics.

**Response (200 OK):**
```json
{
  "userId": "uuid",
  "summary": {
    "avgHeartRate": 70,
    "avgBloodOxygen": 97.5,
    "totalSteps": 5000
  }
}
```
