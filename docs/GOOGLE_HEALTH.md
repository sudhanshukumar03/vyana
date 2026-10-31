# Google Health activity on the web

Vyana imports recorded steps, walking distance, active calories and active minutes through the Google Health REST API. The ESP32 remains the independent source for optical, temperature and AD8232 input/sample batches. No MPU6050 driver or step simulation is part of the current firmware source. Missing cloud records stay unavailable, including when simulated vital previews are enabled.

## Prerequisites

1. A Google account with a linked **Google Health** profile and recorded phone/tracker activity. Signing into **Google Fit** alone does not establish this link. Google's [setup guide](https://developers.google.com/health/setup) describes the account/profile requirement and MobileTrack option.
2. A Google Cloud project with **Google Health API** enabled. This is a different service from Cloud Healthcare API. A generic Cloud signup/free-trial billing form does not establish the selected API's actual prerequisite. Check the exact API page and its terms before supplying payment details or activating any billing account; Vyana does not activate billing.
3. A Web application OAuth client, consent-screen configuration, read-only activity scope and the intended test account listed as a test user while the OAuth app is in testing.

## Local setup

Keep OAuth credentials in `apps/api/.env`, never `VITE_*`, source code or chat:

```dotenv
GOOGLE_HEALTH_CLIENT_ID=YOUR_WEB_OAUTH_CLIENT_ID
GOOGLE_HEALTH_CLIENT_SECRET=YOUR_WEB_OAUTH_CLIENT_SECRET
GOOGLE_HEALTH_REDIRECT_URI=http://localhost:5173/api/v1/integrations/google-health/callback
```

Register that exact redirect in the Google OAuth client. It must match Vyana's `WEB_ORIGIN` plus `/api/v1/integrations/google-health/callback`. For Compose, configure the root `.env` and use that deployment's actual web origin, rather than the host-development port. Production requires HTTPS through the existing production configuration rules.

Restart the API after setting credentials. Normal startup applies pending migrations, including migrations 009 and 014–016. Open Activity and select **Connect Google Health**. Sign into the intended account and grant the requested read-only activity permission. OpenID/email permission identifies the linked account; no health write permission is requested. The callback verifies both the Vyana initiating session and the Google Health profile before saving a connection.

An unconfigured installation shows **Connection setup pending**. The presence of this page or a successful build does not mean that Google OAuth or real data import has completed.

## Synchronization

The normal API process runs a background worker even while the browser is closed. It polls due connections every 15 seconds with at most two concurrent accounts. `GOOGLE_HEALTH_SYNC_SECONDS` controls the normal interval (60–3600 seconds, default 120, plus small jitter). Shared PostgreSQL advisory locks coalesce manual/background requests across processes; persisted exponential backoff survives restart. Consent failures stop retries until reconnection. Shutdown aborts provider calls. The open app also requests synchronization after 60 seconds; the server enforces cooldown and backoff. **Sync activity** requests the same bounded sync; it does not bypass the provider cooldown. Google Cloud synchronization is not a live footstep stream.

The cards default to **Today** in the saved profile timezone. A successful sync can return no records for that day, especially after midnight or before the phone/tracker uploads its activity. The page explains this state and offers a dated selector for earlier recorded days; older totals never silently become today's totals. Automatic checks show a working state, and manual checks report completion, cooldown or errors while retaining recorded data.

### Time of day and original timestamps

Migration `015_google_activity_intervals.sql` preserves each reconciled interval's exact start/end instants, metric and value in an account-owned cache. A successful sync replaces the imported seven-day window for each successful metric, removes older interval-cache rows, and preserves previous intervals for optional metrics that failed. Relink/disconnect clears this cache. Existing daily totals remain separately available.

The **Statistics** chart shows hourly steps, distance, active calories or active time for the selected date, with the highest recorded period and explicit ties. Active time is selected initially when available. Periods start at local midnight and follow actual elapsed hours; daylight-saving days can have 23 or 25 periods. The profile timezone is shown once; UTC offsets distinguish clock changes and appear in detailed hourly totals. Missing periods remain unavailable. Only intervals fully contained inside a period contribute to hourly comparisons. A record crossing a boundary is counted separately and stays visible in the original interval table; Vyana never assumes uniform movement or estimates a split. Daily totals may therefore exceed the sum in the hourly chart.

The timestamped records table preserves milliseconds and displays the profile timezone, with UTC instants in the time elements. Its values cover complete provider intervals, not individual footstep events. Reads are authenticated, scoped to one owned day and paginated in stable timestamp/metric order at 100 records per page. A new import invalidates old cursors. Changing the account/date/timezone/import version aborts the old view; a new sync resets its loaded pages. A single **View activity records** expander provides original timestamps, hourly totals and daily totals through its record-type selector. The redundant weekly chart is removed. The reference-based summary uses a decorative step dial and three compact supporting metrics; it does not invent a daily step goal. Connection management is tucked into the sync footer. Hardware freshness/demo notices are omitted on Activity and Wellness; backend failures remain visible.

The server backfills 15 local dates initially and at least daily, then refreshes the most recent three dates between full imports. It reads reconciled steps, distance, active-energy-burned, active-minutes and optional exercise sessions, follows bounded pagination and groups intervals in the saved profile timezone. `null` means no record was supplied; a real recorded zero remains zero. Reconciled duplicate intervals and intervals spanning a local calendar-day boundary are rejected instead of silently adding or allocating misleading totals. Failed sync keeps the previous cache and exposes a sanitized error. Active calories come from Google `activeEnergyBurned.kcal` and exclude resting/basal expenditure. Active time sums the unweighted LIGHT, MODERATE and VIGOROUS minute counts from `activeMinutes.activeMinutesByActivityLevel`; it is not weighted Active Zone Minutes. Calories are provider/tracker estimates, not a fixed steps-to-calories conversion. Availability depends on the connected source supplying these records. Both data types use the existing read-only activity scope. If either optional metric fails, step/distance syncing continues and its previously cached values are retained with `metric_warnings`; a successful empty response remains missing rather than an invented zero. Migration 014 adds nullable columns and the warning state.

Provider definitions: [active energy burned](https://developers.google.com/health/data-types/calories) and [active minutes](https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints#ActiveMinutes).

Google documents the [observed time intervals](https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints#ObservationTimeInterval) and [reconciled stream](https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/reconcile) used here. Recording resolution and upload delay depend on the connected source; these timestamps do not establish a live second-by-second stream.

Records remain account-owned, separately cached and independent of ESP32 selection or heartbeat freshness. A cloud-linked account never replaces the active hardware device. Google-derived step records do not feed physical-device SOS monitoring.

## Security and disconnect

Migration 016 retains derived hourly totals for 15 local dates while original interval records remain limited to seven dates. Incremental imports replace only fetched windows and successful feeds. The review uses the last 14 completed dates for two comparable weeks and recurring activity hours; Activity's exact-record selector stays limited to its seven-date cache. Per-feed attempt/success/error state preserves optional failures separately from steps and distance. Exercise requests use Google's documented `exercise.interval.civil_start_time` date filter, unlike physical-time filters for interval metrics; padded bounds are trimmed to the requested profile-local dates. Exercise session types are source-reported, not proof of phone auto-detection or a current running state. Light/moderate/vigorous minutes remain separate and are not weighted exercise targets.

OAuth uses a ten-minute, single-use, Vyana-session-bound state plus an HttpOnly SameSite=Lax callback cookie and PKCE. Refresh/access tokens and PKCE verifiers are encrypted with AES-GCM and owner-bound authenticated data using a purpose-derived key from `AI_INTERNAL_SECRET`. The browser receives connection metadata and activity totals only. Keep that secret stable and back up environment configuration securely.

**Disconnect** removes Vyana's saved tokens, pending OAuth attempts and cached Google activity. It does not claim to revoke the Google account's grant; users can also remove the grant in their Google account's connected-app settings. A connection generation check prevents an older sync from restoring records after disconnect/relink. Logout clears browser activity state but intentionally keeps the owner's persistent linked account for their next login.

## Verification boundaries

Automated OAuth/provider tests use synthetic responses and a separate disposable database. They must not be described as a successful real Google sign-in or live import. Actual API enablement, account consent and first real sync remain separate verification steps. The new sensor-only firmware source can be compiled/tested without flashing a board; any later USB upload still requires electrode pads off-body.
