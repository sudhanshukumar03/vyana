# SOS settings and monitoring reports

Configure the web feature under **Settings → SOS and report sharing**. Select the doctor's email and trusted contacts, choose channels, then save sharing consent. Automatic SOS is off by default. External notifications require a running API server, internet access and configured sending services. The page does not activate a handset's built-in Emergency SOS.

## Recipients and delivery

Save contacts on the Emergency page first. Report recipients and emergency recipients are separate lists. Daily and sensor-quality reports use email only. Emergency alerts use the enabled channels available in each saved contact. Automatic calls/texts require international numbers such as `+919876543210`; short emergency-service numbers are not supported as notification destinations. Public directory entries are not automatic recipients.

**Email report now** queues a report for saved report recipients. **Download report data** returns JSON to the user's browser without contacting anyone. Manual SOS records an in-app critical alert and queues notifications according to saved sharing preferences. With sharing disabled, it records the request without claiming external delivery.

The Emergency page checks saved sharing, recipient selection and service availability before confirmation. Its result distinguishes an in-app record, queued contact notifications and missing service setup. Per-contact status refreshes every five seconds on the Emergency and Settings pages; refreshing delivery history does not overwrite unsaved preferences. Provider acceptance is not confirmation that someone received the notification. Direct email links include only fresh physical sensor values with observation times, excluding simulator data.

Manual confirmations carry a request UUID. Repeated clicks or a retry after a lost response reuse the same UUID, alert and notification jobs. **Start a new SOS request** creates a new request identity.

## Automatic monitoring

Repeated fresh hardware readings can start an SOS countdown when heart rate is below 40 or above 150 bpm, or oxygen is above zero and below 88%. These are project rules, not a clinically validated emergency detector. Defaults require at least three consecutive readings and 30 seconds of persistence; with five-second reports this normally requires about seven observations. A gap beyond the configured freshness interval resets the streak.

Only the active registered ESP32 and known hardware equipment snapshots qualify. Complete vital records contribute to reports; their matching equipment snapshot drives automation once per acquisition and carries ECG contact/clipping information. Stale observations, replays, inactive devices, zero/unavailable optical results and unverified/generated sources cannot trigger automatic SOS. A separate authenticated explicit device SOS signal can also start a countdown. The current firmware has no physical SOS-button driver; the endpoint supports a later input integration.

The default 30-second countdown appears across signed-in pages. Cancel it before its deadline. Recovery below the critical thresholds cancels a pending threshold incident, but not an explicit device SOS request. The default 60-minute cooldown suppresses repeated automatic incidents, including after cancellation. Removing recipients or turning sharing off cancels jobs that have not begun sending. Previously accepted provider requests cannot be recalled through this page.

The AD8232 currently reports lead contact and input quality, not ECG rhythm classification. Lead-off, significant clipping and unavailable sensor values do not independently initiate emergency calls. Optional fault emails require five minutes of continuously received fault observations and are limited to one per device per UTC day. They go only to report recipients over email.

## Reports

Daily reports run at the saved hour in the profile timezone, once per local calendar day. They summarize the preceding 24 hours of available records. If the server returns after the chosen hour, that day's report can be sent late; missed earlier days are not fabricated.

Reports include the saved name, active device, observation times, heart-rate range/average, minimum oxygen, probe temperature range and sensor-quality flags. ECG CSV fields include status, raw ADC, approximate millivolts and sampling/clipping counts when available. ECG remains unclassified. Summary statistics cover all recorded hardware observations; the optional CSV includes the latest 2,000. Unverified/generated-source data is excluded from the hardware summary and counted separately. Existing hardware vital records from the preceding 24 hours are backfilled during migration. HTML and spreadsheet cells are escaped.

## Server configuration

For private credential entry in a local terminal, run `pnpm sos:setup --channel phone` for Twilio or `pnpm sos:setup --channel email` for Resend. API keys and Auth Tokens are hidden while typing; account SID and sender details are visible. Press Enter after each field; Enter on an empty field keeps a previously saved value. The default target is `apps/api/.env`; add `--target compose` to configure the root `.env` instead. Other settings and comments are preserved. Saving provider credentials keeps `SOS_DELIVERY_ENABLED=false`, so this step cannot release queued notifications.

Run `pnpm sos:check --channel phone` for a local format/completeness check, or `pnpm sos:verify-phone` for read-only Twilio account and assigned sending-number checks. These commands never print credential values or send notifications. Twilio verification reports account status and capabilities for owned sending numbers; it does not verify recipient permissions or delivery. Current product trials may assign senders per product and recipient, so an absent owned-number record does not establish that a trial sender is invalid. Copy the From number from the appropriate product trial screen; the SMS and Voice senders may differ. Check [Twilio trial setup](https://www.twilio.com/docs/usage/tutorials/how-to-use-your-free-trial-account) for verified-recipient and destination restrictions, and [number capabilities](https://www.twilio.com/docs/phone-numbers/api/incomingphonenumber-resource) for supported channels.

The current [SMS product trial](https://www.twilio.com/docs/usage/trials/try-out-sms) limits messages to predefined examples such as appointment reminders. Those examples can test connectivity but are not custom SOS messages. A custom SOS SMS requires an account that permits custom content; do not replace an emergency alert with an unrelated trial template. Voice has [separate trial restrictions](https://www.twilio.com/docs/usage/trials/try-out-voice) and must be checked separately.

After credentials and recipients are confirmed, enable delivery deliberately, restart the API, and perform one explicitly authorized test to a chosen recipient. Keep automatic SOS off until that test is assessed. Never use an emergency-service number as a test destination.

Keep credentials in `apps/api/.env` for host development or the root `.env` for Compose. Never put them in `VITE_*`, source control or chat.

```dotenv
SOS_DELIVERY_ENABLED=true
RESEND_API_KEY=YOUR_RESEND_KEY
SOS_FROM_EMAIL=alerts@YOUR_VERIFIED_DOMAIN
TWILIO_ACCOUNT_SID=YOUR_TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN=YOUR_TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER=YOUR_TWILIO_NUMBER_IN_INTERNATIONAL_FORMAT
```

Email uses a verified Resend sender. SMS/voice use a Twilio account and number permitted to contact the selected recipients. Trial-account and destination restrictions can apply. Restart the host API or recreate the Compose API service after changing credentials. The existing migration process applies the new SOS migrations and grants access to the application database role.

The API starts its durable worker automatically; the web page may be closed. A worker outage retains queued jobs. Emergency notifications older than ten minutes and reports older than 24 hours expire rather than initiate delayed calls. The explicit retention command also removes old observations and incident reports under the configured retention policy.

Integration uses [Resend email](https://resend.com/docs/api-reference/emails/send-email), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), [Twilio Messaging](https://www.twilio.com/docs/messaging/api/message-resource) and [Twilio Voice](https://www.twilio.com/docs/voice/api/call-resource). Email retries use an incident-specific idempotency key. Ambiguous SMS/voice submissions are marked uncertain and are not automatically repeated. Explicit rate-limit responses may retry within bounded attempts and expiry.

## Delivery status

| Status | Meaning |
|---|---|
| Queued | Saved for the worker; no delivery claim |
| Setup required | Delivery disabled or channel credentials missing |
| Submitting | A worker has claimed the job |
| Provider accepted | Request accepted, without confirmation of delivery, reading or answering |
| Failed | Rejected, expired or attempts exhausted |
| Delivery uncertain | Ambiguous response or interrupted worker; check provider records before manually repeating |
| Cancelled | User action, consent, recipient or device changes invalidated the job |

Emergency call/message links require a user gesture and a supported phone application. They do not silently invoke native Emergency SOS. See [Android phone intents](https://developer.android.com/guide/components/intents-common#Phone) and [Apple Emergency SOS](https://support.apple.com/guide/iphone/use-emergency-sos-iph3c99374c/ios).

## API

Account routes require the existing bearer session and enforce ownership.

| Route | Purpose |
|---|---|
| `GET /api/v1/sos` | Preferences, non-secret capabilities and recent incident/job status |
| `PUT /api/v1/sos/preferences` | Save complete validated preferences and owned recipient IDs |
| `POST /api/v1/sos` | Manual SOS; returns alert and incident ID |
| `POST /api/v1/sos/:id/cancel` | Cancel a pending countdown before its deadline |
| `GET /api/v1/sos/report` | Owner-scoped 24-hour report preview |
| `POST /api/v1/sos/report` | Queue report email for saved report recipients |
| `POST /api/v1/device/emergency` | Device-key-authenticated explicit SOS signal |

Manual SOS accepts `{note, request_id}`; `request_id` is an optional UUID for compatibility with existing callers. Reuse it when retrying the same request. The response retains alert fields and adds `sos_incident_id`, `notification_count` and `delivery_status` (`recorded`, `queued` or `setup_required`). These describe recording/queueing and setup, not recipient delivery.

Device signal body: `{session_id, sequence, observed_at}`. It must be fresh, automatic sharing must be enabled and the device must be active. Replay/cooldown handling prevents repeated incidents. This does not implement ECG arrhythmia detection or a hardware SOS button.
