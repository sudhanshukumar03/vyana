# API

Browser base path: `/api/v1` on the web origin. Errors return `{error, request_id?}`.

| Status | Meaning |
|---|---|
| 400 | Invalid input |
| 401 / 403 | Authentication / origin denied |
| 404 | Owned resource not found |
| 413 | Body or decoded report too large |
| 429 | Rate or capacity limit |
| 503 | Dependency unavailable |

AI fallbacks are validated 200 responses with `offline: true`. Ordinary JSON bodies share a 100 KiB budget, including conversation history. Report routes allow 15 MiB encoded JSON and at most 10 MiB decoded content.

## Authentication

| Method and path | Input / behavior |
|---|---|
| POST /auth/register | `{email,password}`; available locally, closed in production |
| POST /auth/login | Same fields; returns `{token,user:{id,email}}` and refresh cookie |
| POST /auth/refresh | Rotates the refresh cookie and returns an access token |
| POST /auth/logout | Revokes the session and disconnects its sockets |
| GET /auth/me | Returns bearer-authenticated identity |
| POST /auth/request-reset | `{email}`; generic 202 response |
| POST /auth/reset-password | `{token,password}`; consumes token and revokes sessions |
| POST /auth/request-verification | Requires bearer identity |
| POST /auth/verify | Consumes `{token}` |

Passwords need at least eight characters and at most 72 UTF-8 bytes. Access tokens last 15 minutes and stay in browser memory. Refresh cookies last up to 30 days, rotate, and use HttpOnly/SameSite=Strict plus Secure in production.

Cookie mutations require the accepted origin; refresh requires credentials and `X-HealthGuard-Client: web`. Recovery/verification uses the encrypted operator outbox described in [operations](OPERATIONS.md).

## Device writes

All writes require `X-Device-Key`. `POST /ingest/vitals` accepts:

```json
{
  "session_id": "00000000-0000-4000-8000-000000000001",
  "sequence": 1,
  "observed_at": "2026-10-24T10:00:00Z",
  "heart_rate": 72,
  "spo2": 98,
  "temperature": 36.7,
  "ecg_status": "Normal",
  "source": "Simulator"
}
```

Use the acquisition time, a new producer UUID at boot and a nonnegative integer sequence. Accepted observation times extend from 31 days ago to five minutes ahead. ECG states are `Normal`, `Irregular`, `Leads Off` and `Unknown`.

`POST /ingest/activity` uses the same identity/time envelope with cumulative `steps`, `distance_km`, `calories` and `active_minutes`. `POST /device/status` accepts `{device_name,connected,battery,source}`; unmeasured battery is null.

Ingest returns `{success:true,duplicate:boolean}`. Uniqueness is per device/session/sequence and telemetry kind. Retries are idempotent. Payloads cannot choose another owner.

## Account routes

These routes require `Authorization: Bearer <token>`. Ownership comes from the session.

| Method and path | Result / input |
|---|---|
| GET /health/summary | Vitals, activity, device, alerts, deterministic insights, wellness score, freshness, server time and wellness version |
| GET /health/insights | `{insights,offline}`; optional model guidance separate from core summary |
| GET /vitals/latest | Latest active-source record or null |
| GET /vitals/trends | Ascending active-source history |
| GET /activity/summary | Ascending active-source activity history |
| GET /profile | Owned profile or `onboarded:false` |
| PATCH /profile | Merge supplied fields; omitted fields stay unchanged, optional null clears |
| POST /profile | Compatibility alias for PATCH |
| GET /profile/contacts | Owned contacts |
| POST /profile/contacts | Name plus phone or email |
| DELETE /profile/contacts/:id | Remove an owned contact |
| GET /devices | Owned devices |
| POST /devices | `{name}`; returns a one-time device credential |
| POST /devices/:id/activate | Select the live source |
| DELETE /devices/:id | Revoke and deactivate |
| GET /device | Selected/latest owned status |
| GET /alerts | Critical-active-first feed; `limit` 1–100, optional `before` ID |
| POST /alerts/:id/acknowledge | Acknowledge without implying recovery |
| POST /alerts/:id/resolve | Resolve an owned alert |
| POST /sos | Optional note, up to 200 characters; creates an in-app critical alert |
| POST /assistant/chat | Message and bounded user/assistant history |
| POST /assistant/report | `data_base64`, `mime_type`, optional `filename`; PDF/PNG/JPEG |

Vitals/activity history accepts `limit` 1–100. Request older pages with the URL-encoded `observed_at` and `id` of the oldest returned record, separated by `%7C` in the cursor. Responses remain ascending.

Editable profile fields: `full_name`, `dob` (ISO date), `sex`, `height_cm`, `weight_kg`, `conditions`, `medications`, `allergies`, `activity_level`, `goal` and `timezone` (IANA). Initial completion needs height and weight.

Reports undergo strict base64, decoded-size, MIME and file-signature checks before model work. These checks do not establish that a document is clinically interpretable.

Shared browser contracts are in [health.ts](../shared/types/health.ts); runtime validation is in [schemas.ts](../apps/api/src/schemas.ts). `timestamp` aliases `observed_at`; `received_at` is ingestion time. Data and scores may be null. See [features](FEATURES.md) for freshness, activity and alert semantics.

## Socket.IO and private AI

Connect on the web origin with `auth: {token}`. The server assigns owner/session rooms and rejects or disconnects invalid, expired or revoked sessions. `health_update` carries a committed vitals/activity/device record; `new_alert` carries an alert lifecycle record. Resynchronize snapshots after reconnecting.

Socket auth errors include status 401 or retryable 503. Temporary session-service failures preserve the local session for retry; invalid credentials clear it. Logout clears the browser cookie even if database revocation is temporarily unavailable.

Private FastAPI routes `/api/ai/insights`, `/api/ai/chat` and `/api/ai/report` require `X-AI-Key` and `X-Owner-Id` matching `owner_id`. Browsers call the Node API instead. The AI boundary limits streamed bodies, context, concurrency and output. Context includes owner-scoped seven-day aggregates; the model has no direct database tool.
