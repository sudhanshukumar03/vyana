# API

Browser base path: `/api/v1` on the web origin. Errors return `{error, request_id?}`.

## Health review and weight history

- `GET /health/review`: authenticated owner-only snapshot of adult BMI/reference range, DRI EER 2023 maintenance estimate and eligibility state, latest 60 dated weight entries, two completed-week summaries, recurring hours, source-reported exercises, per-feed freshness and exact timestamp-overlap matches with the selected physical heart-rate source. Missing data stays nullable. No food-intake target or diagnosis is generated.
- `POST /health/weight`: `{weight_kg, observed_at}` (20–300 kg, ISO instant within the past year and no future measurement). Requires a completed profile. Repeating the same timestamp/value is idempotent; a different value at that instant returns 409. Only the latest measurement from local today updates profile weight. Response 201 includes `recorded`, `observed_at` and the resulting owned `profile`.
- Profile POST/PATCH additionally accepts `energy_activity` (inactive/low_active/active/very_active or null), `nutrition_review` (unknown/standard/required), `weight_goal_type` (maintain/reduce/gain), and optional `goal_weight_kg`. Adult goals must follow the selected direction and remain above the BMI-based lower reference weight. Maintain clears a target. Maintenance estimates require explicit eligibility and the published model inputs; conditions/medications or excluded circumstances require individual review. Calendar dates such as birthdays are returned as `YYYY-MM-DD`, independently of server timezone.

Weight entries are retained until account deletion; review responses return the latest 60. No daily weight entry or questionnaire is required. Assistant context receives bounded calculated facts/model outputs, without the new eligibility answers or unrestricted weight history.

| Status | Meaning |
|---|---|
| 400 | Invalid input |
| 401 / 403 | Authentication / origin denied |
| 404 | Owned resource not found |
| 409 | Account details already in use |
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

Passwords need at least eight characters and at most 72 UTF-8 bytes. Access tokens last 15 minutes and stay in browser memory. Refresh cookies rotate and renew a 30-day expiry on each refresh. They use HttpOnly/SameSite=Strict plus Secure in production.

Refresh requires the refresh cookie. Refresh and logout both require `X-HealthGuard-Client: web`. Browser requests must use the accepted origin. Recovery/verification uses the encrypted operator outbox described in [operations](OPERATIONS.md).

Logout identifies the session from a signed bearer token (including an expired one) or its refresh cookie. Cookie-only logout accepts the immediately previous refresh cookie after one rotation; old cookies cannot refresh the session. Without a usable bearer session ID, a missing or unmatched cookie returns 400. Logout clears the browser cookie even when it cannot identify a session or reach the database.

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

`POST /ingest/activity` uses the same identity/time envelope with cumulative `steps`, `distance_km`, `calories` and `active_minutes`. `POST /device/status` accepts `{device_name,connected,battery,source}`; unmeasured battery is null. It also accepts an optional independent `equipment` snapshot:

```json
{"observed_at":"2026-10-28T13:20:06Z","heart_rate":72,"spo2":98,"temperature_c":null,"ecg_status":"Unknown","ecg_raw_adc":2048,"ecg_millivolts":1650,"ecg_samples":1198,"ecg_clipped_samples":0}
```

Equipment accepts temperature null or -55 to 125 C, optional nullable integer `heart_rate` 1-300, optional nullable `spo2` 0-100, ECG status `Unknown` or `Leads Off`, ADC 0-4095, millivolts 0-5000 and nonnegative integer sample counts (clipped <= total). The optical channels are independent of each other and temperature. Observation times range from 31 days ago to five seconds ahead. The latest observation is stored on the authenticated device and returned in device status/summary/socket updates; owned partial snapshots also have their separate paginated history. Older equipment does not overwrite a newer snapshot; omission of equipment preserves it. A newer explicit null clears the corresponding displayed reading; omitted optical fields support older producers and allow fallback to saved vitals. Equipment does not create complete vital history or a wellness score; eligible observations can participate in configured SOS rules. The UI requires a connected active device and both a fresh heartbeat and equipment observation within 30 seconds. Existing heartbeat payloads remain valid.

Ingest returns `{success:true,duplicate:boolean}`. Uniqueness is per device/session/sequence and telemetry kind. Retries are idempotent. Payloads cannot choose another owner.

### Raw ECG batches

`POST /ingest/ecg` uses `X-Device-Key` and a separate 360-request/minute device limit. Example shape (use the actual acquisition UTC time):

```json
{"session_id":"00000000-0000-4000-8000-000000000001","sequence":1,"observed_at":"2026-10-30T10:00:00.000Z","source":"ESP32_MAX30102_DS18B20_AD8232","samples":[[0,2048,0],[4,2052,0],[8,2060,1]]}
```

Each sample is `[offset_ms,raw_adc,lead_flags]`: offset 0–2000, ADC 0–4095, flags 0–3 (LO+ bit 0, LO− bit 1). Batches have 1–128 samples, start at offset zero and increase strictly. `sequence` is the first sample ordinal, starting at 1; use a new boot UUID after restart. First/last timestamps must be within ten minutes of the server and at most five seconds ahead. Identical retries return `duplicate:true`; changed samples at the same identity or overlapping sample ranges return 409. Never include generated previews in this endpoint.

`GET /ecg/stream?device=<selected-uuid>&after=<cursor>` requires the account bearer token. It returns `{device_id,cursor,batches}` for the active owned unrevoked device, at most 24 batches. Omit `after` to load the latest batches; subsequent calls use the returned cursor. Each batch includes its database `id`, device/boot IDs, first sequence/time, source and exact sample tuples. Device mismatch returns no batches. Reset on device/account changes and show gaps for missing ordinals, reboot, lead-off or sample intervals longer than 20 ms. Data is retained for ten minutes, capped at 1,200 batches/device, with periodic cleanup while the API runs. This is a short raw-input buffer, not durable clinical recording or rhythm interpretation.

Legacy `/ingest/activity` and `/activity/summary` remain for owned simulator/history compatibility. Their records never supply product/AI activity; current activity comes only from the connected Google Health day. Steps, distance, active calories and active minutes can independently be null or zero. Google day records add `active_calories_kcal` and `active_minutes`; summary activity exposes these as `calories` with `calories_type: active`, and `active_minutes`. Calories exclude resting energy, and minutes are unweighted LIGHT/MODERATE/VIGOROUS counts. `metric_warnings` identifies optional metrics that failed refresh while prior cached values were retained. Google disconnection clears product activity and blocks delayed responses from restoring it.

## Account routes

These routes require `Authorization: Bearer <token>`. Ownership comes from the session. See [SOS settings and delivery](SOS.md) for countdowns, reports and notification setup.

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
| GET /sos | SOS preferences, delivery capabilities and incident/job status |
| PUT /sos/preferences | Validated SOS preferences with owned recipient IDs |
| POST /sos | Optional note, up to 200 characters; records SOS and uses saved notification preferences |
| POST /sos/:id/cancel | Cancels an owned pending countdown before its deadline |
| GET /sos/report | Owner-scoped 24-hour monitoring report preview |
| POST /sos/report | Queues email to saved report recipients |
| POST /assistant/chat | Message and bounded user/assistant history |
| POST /assistant/report | `data_base64`, `mime_type`, optional `filename`; PDF/PNG/JPEG |

Google activity uses authenticated `GET /integrations/google-health` (overview), `POST /integrations/google-health/connect`, `POST /integrations/google-health/sync` and `DELETE /integrations/google-health`. The separate `GET /integrations/google-health/timeline?date=YYYY-MM-DD&cursor=...` accepts a date in the last seven local days and an optional opaque cursor. It returns `date`, `timezone`, `last_synced_at`, `metric_warnings`, `hours`, `interval_count`, `unallocated_intervals`, up to 100 `intervals` and `next_cursor`. Each original interval includes `start_time`, `end_time`, `metric` and `value`; metrics use `steps`, `distance_km`, `active_calories_kcal` and `active_minutes`. Hour records include start/end instants and nullable totals for those four metrics. Intervals spanning a period boundary remain unallocated instead of receiving invented hourly values. Unknown/old dates or malformed cursors return 400; an import-version mismatch returns 409. Reads use one database snapshot and always scope by the authenticated owner and profile timezone. See [timestamp semantics](GOOGLE_HEALTH.md#time-of-day-and-original-timestamps).

Vitals/activity history accepts `limit` 1–100. Request older pages with the URL-encoded `observed_at` and `id` of the oldest returned record, separated by `%7C` in the cursor. Responses remain ascending.

Editable profile fields: `full_name`, `dob` (ISO date), `sex`, `height_cm`, `weight_kg`, `conditions`, `medications`, `allergies`, `activity_level`, `goal` and `timezone` (IANA). Initial completion needs height and weight.

Reports undergo strict base64, decoded-size, MIME and file-signature checks before model work. These checks do not establish that a document is clinically interpretable.

The AI service then checks actual image/PDF structure and content in a bounded worker. Blank, corrupt, encrypted, too-small or oversized content returns a structured `source:rules`, `document_status:unreadable` response with no findings and no model call. Structural limits are 20 PDF pages, 12 million pixels per image and 24 million pixels across scanned PDF images. A busy/unavailable parser instead returns `source:fallback`, `offline:true`, `document_status:not_reviewed`; it does not label the file unreadable. Earlier encoding/signature errors still return HTTP 400/413.

Chat returns `reply`; report review returns `summary`, `discussion_points` and `document_status` (`readable`, `unreadable`, `not_health_report` or `not_reviewed`). Provider failure means `not_reviewed`, not that the file itself is unreadable. Both include `sections:[{title,items}]`, a server-set `disclaimer`, `offline`, `source` (`gemini`, `rules`, `fallback`), an optional allowlisted `reason`, and nullable `retry_after_seconds`. A rules-only scope or file-check response can have `offline:false` without a Gemini call; use `source` to distinguish it. Provider errors never expose raw bodies, credentials or URLs.

Account context for chat/report comes from the authenticated API, not client fields. The browser cannot select an owner or inject profile/sensor context. Model output is schema-validated before display. Unreadable/unrelated documents receive a recovery message rather than extracted findings. `/assistant/report` is one-shot; the separate saved Reports library below persists originals and reviews. Neither adds documents to later chat context.

## Saved reports, location lookup and individual sensor history

- `GET /api/v1/reports` lists owned metadata; `POST /api/v1/reports` accepts the same validated file input as `/assistant/report`, reviews it and saves the real outcome. Its 15 MiB JSON boundary allows at most a 10 MiB decoded file. Storage is limited to 20 files/80 MiB decoded per owner.
- `GET /api/v1/reports/:id` returns an owned report and its original base64. `POST /api/v1/reports/:id/review` retries the saved original; `DELETE /api/v1/reports/:id` deletes original and review. Wrong-owner and missing IDs return 404. Metadata and originals are encrypted separately using an owner/report/purpose-bound key derived from the private internal secret. Failed AI work remains unreviewed.
- Authenticated `/api/v1/locations/geoapify/geocode/search?text=...`, `/geoapify/geocode/reverse?lat=...&lon=...`, `/geoapify/places?lat=...&lon=...&radius=...`, `/ninjas/hospitals?city=...` (all under `/api/v1/locations`) proxy bounded requests to fixed providers. Keys remain server-only; missing configuration returns 503. Lookup is limited to 30 requests/minute per account.
- `GET /api/v1/equipment/history?limit=50&before=<id>` returns selected-device snapshots, newest received first, with `equipment` retaining explicit missing channel values. Limit is 1-100; `before` is an exclusive positive integer ID. Snapshots are independent of complete vitals, deduplicated by device/observation time and retained for 30 days during ingestion.
- Contacts accept optional `office_phone` separately from `phone`. Device provisioning/activation/revocation remain under the existing owned `/devices` routes and are now exposed in Settings.

Shared browser contracts are in [health.ts](../shared/types/health.ts); runtime validation is in [schemas.ts](../apps/api/src/schemas.ts). `timestamp` aliases `observed_at`; `received_at` is ingestion time. Data and scores may be null. See [features](FEATURES.md) for freshness, activity and alert semantics.

## Socket.IO and private AI

Connect on the web origin with `auth: {token}`. The server assigns owner/session rooms and rejects or disconnects invalid, expired or revoked sessions. `health_update` carries a committed vitals/activity/device record; `new_alert` carries an alert lifecycle record. Resynchronize snapshots after reconnecting.

Socket auth errors include status 401 or retryable 503. Temporary session-service failures preserve the local session for retry; invalid credentials clear it. Logout clears the browser cookie even if database revocation is temporarily unavailable.

Private FastAPI routes `/api/ai/insights`, `/api/ai/chat` and `/api/ai/report` require `X-AI-Key` and `X-Owner-Id` matching `owner_id`. Browsers call the Node API instead. The AI boundary limits streamed bodies, context, concurrency and output. Context includes owner-scoped seven-day aggregates; the model has no direct database tool.
