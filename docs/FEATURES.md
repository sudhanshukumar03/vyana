# Features and limits

Vyana is a prototype for exploring owned telemetry and general wellness guidance. Its scores, thresholds and AI output have no clinical validation.

## Accounts and live data

Each account has its own profile, contacts, devices, readings, alerts and AI context. One selected device supplies current sensor readings. Google Health activity belongs to the account and remains independent of the selected ESP32.

The dashboard distinguishes missing, fresh and stale data. `STALE_SECONDS` defaults to 30. An observation is current only within the configured age window and no more than five seconds ahead. Older accepted uploads remain history and do not raise current alerts.

Sensor history pages are chronological and cursor-based. Product steps, walking distance, active calories and active time use the connected Google Health account and profile timezone. The legacy device-activity API still accepts cumulative counters for simulator/history compatibility; its session-aware deltas are not the Google activity shown on the Activity page. The API summary and AI context use Google activity only; there is no fallback to device steps. Missing channels stay null, and a recorded zero remains zero.

## Alert rules

These strict inequalities are project rules, not diagnostic thresholds.

| Metric | Warning | Critical |
|---|---|---|
| Heart rate, high | >120 bpm | >150 bpm |
| Heart rate, low | <45 bpm | <40 bpm |
| SpO2 | <92% | <88% |
| Temperature, high | >38°C | >39.5°C |
| Temperature, low | <35°C | — |

Critical escalation is immediate, including during a warning cooldown. Sustained episodes can emit again after one hour. Three consecutive fresh in-range readings resolve a metric episode. Acknowledgement records attention; it does not imply recovery. SOS resolves explicitly.

Emergency contacts are saved per account. SOS creates a persistent in-app critical alert. External notifications require configured providers, enabled delivery and saved sharing preferences; real delivery remains unverified. The app does not dispatch services. Nearby-service links depend on external map data and availability.

## Profile, BMI and wellness

Wellness presents weight history, a structured maintain/reduce/gain goal, adult BMI and a height-based reference range alongside estimated maintenance energy. The published DRI EER 2023 adult equations use age, height, current weight, model-supported sex and an explicitly selected activity category. Estimates require one-time suitability setup; under-20 profiles, underweight or individual nutrition-review circumstances receive appropriate unavailable states. No daily check-in, inferred ideal weight, food-intake prescription or weight-loss timeline is generated. Voluntary dated measurements support a weight trend; a single fluctuation does not change the plan.

The account-owned health review adds weekly movement consistency, complete-week step comparisons, recurring recorded hours, source-reported exercise types, separate intensity minutes and timestamp-overlapping physical heart-rate observations. Missing uploads are not inactivity. These observations describe recorded behavior and timing; the sourced heart, weight, mood, sleep and everyday-fitness benefits remain general educational information. The assistant receives bounded deterministic review facts without the newly collected suitability answers or unrestricted weight history.

The API background worker imports Google activity while the browser is closed, provided the backend is running and consent remains valid. It uses shared locking, persisted backoff, bounded requests and per-feed errors. Original interval records cover seven dates; derived hourly history covers 15 dates for completed-week reviews. See [Google Health](GOOGLE_HEALTH.md) and the [implementation plan and later policy work](ACTIVITY_HEALTH_REVIEW_PLAN.md).

Profile edits preserve omitted notes; optional fields can be explicitly cleared. BMI uses the unrounded value for classification and rounds only its display. Adult categories require a known age of at least 20; younger or unknown-age profiles receive no adult category.

The wellness score is a project heuristic. Missing/stale data or unsupported ECG states make it unavailable. New firmware sends bounded raw ECG sample batches independently of complete vitals. Dashboard/Vitals can display a four-second recorded ADC trace with gaps for loss, lead-off and restart; pause, raw-value inspection and loaded-sample CSV export are available. Input remains unclassified and is not a calibrated clinical ECG. The compiled firmware must still be uploaded and physically verified. The explicit display-only demo can show a labelled synthetic illustration with pause and reduced-motion behavior.

## Assistant and reports

Assistant provides bounded chat and PDF/PNG/JPEG analysis up to 10 MiB decoded. The server supplies the signed-in account's relevant profile fields, readings, activity, alerts and seven-day aggregates. Names and profile/account identifiers are omitted from the profile context. Reports receive this context too; document findings and device observations remain separate, with explicit identity/timing limits.

Answers lead with the main point and use structured supporting sections when useful. The UI renders text safely and labels Gemini responses, Vyana rules and limited fallback guidance. Missing, invalid or stale vitals are withheld as current measurements. Fixed threshold warnings remain available when AI fails. An unavailable model never produces an invented report summary.

Fresh critical project thresholds use fixed chat/insight guidance instead of asking Gemini to infer symptoms. Their source, values and limitations remain visible, including for brief or unrelated questions. Critical values are also withheld from report-model interpretation; the server appends their factual snapshot. Simulated readings cannot establish exercise readiness or a medical emergency.

Reports receive structural and blank-content checks before any model call. Blank, corrupt, encrypted, oversized or excessively complex files receive a recovery message without extracted findings. Text and scanned PDFs are supported within the review limits: 20 pages, 12 million pixels per image and 24 million pixels across scanned PDF images, in addition to the 10 MiB file limit. These checks do not verify the accuracy of model-generated findings.

Requests can be stopped; route changes and logout discard pending browser results. Chat history is bounded by bytes and turn count. Report documents, summaries and failed replies are excluded from subsequent chat context. The Reports library stores encrypted account-owned originals and actual review metadata, supports failed-review retries and deletion, and starts empty. Limits are 20 files and 80 MiB decoded per account. Files uploaded directly in Assistant are reviewed once without being added to the library. Report-specific follow-up chat is not implemented.

The conversation supports keyboard scrolling. Completion, cancellation, failed uploads and unavailable reviews have contextual status messages; focus returns to the composer when a pending control becomes unavailable. Actual screen-reader speech still needs manual review.

Structured roles, JSON schemas, decoded-string scope checks and concurrency limits reduce specific failure modes. Unknown age and under-20 profiles receive distinct rules-based replies for personal BMI/weight/calorie targets. Full birth dates are replaced with age context before generation. These controls do not establish comprehensive model safety. The updated credential and `gemini-3.1-flash-lite` passed live generation and a finite synthetic evaluation; clinical suitability and broader human review remain unestablished. Follow the [provider recovery procedure](OPERATIONS.md#resolve-gemini-access).

Reports links to its saved review in Assistant and allows original-file download. Settings exports a labelled loaded-data snapshot; History CSV exports loaded rows. Full account export/restore, custom thresholds remain unavailable. Settings shows the supported metric/light configuration without inert preference buttons. Activity presents a step dial with compact active calories, distance and active time metrics. Active calories exclude resting energy; active time sums Google-reported light/moderate/vigorous minutes. Provider estimates, absent records and partial-sync warnings are labelled. Its hourly chart identifies the highest recorded period. One records expander offers original timestamps, hourly totals and daily totals; the duplicate weekly chart and Activity-specific hardware/demo notices are removed. Cross-hour intervals retain their original timestamps without a guessed distribution. Sync and connection controls remain available in a compact footer.

## Producers and operating limits

The Python simulator provides explicitly synthetic vitals, activity and heartbeat scenarios for development. Normal ESP32 firmware acquires real optical, temperature and ECG input data; it has no motion driver, activity generator or activity uploads. The dashboard starts live-only on every reload and hides simulated backend vitals/activity and stale current readings. A session-only demo control enables labelled generated vital displays, including an illustrative ECG trace; it does not generate steps, distance, calories or active time. ECG input summaries do not classify rhythm; battery is unknown.

| Boundary | Implementation |
|---|---|
| Replay identity | Device + producer session + sequence, per telemetry kind |
| Firmware summary queue | 64 fixed records, at most 512 payload bytes each; newest overflow drops |
| Firmware ECG stream | Separate 512-sample ring, at most 128 samples per request; loss remains visible through sequence gaps |
| ECG server retention | Ten minutes, at most 1,200 batches per device; cleanup every minute while API runs |
| ECG display/export | Latest four seconds, at most 1,000 loaded samples; raw ADC/lead flags only |
| Simulator queue | 128 records; bounded retries and explicit drops |
| Delivery | Only 2xx acknowledges; timeout/408/429/5xx retry |
| Ordinary JSON | 100 KiB, including conversation history |
| Report JSON / decoded file | 15 MiB / 10 MiB |
| History page | At most 100 records |
| Clock handling | UTC acquisition/receipt times; unsynchronized firmware withholds samples |

Queues are volatile. Compilation does not establish physical sensor accuracy, heap stability or reconnect reliability.

Public verification/password-recovery delivery, full account export/restore, clinical interpretation and emergency dispatch are outside the current local release. [ESP32 firmware](../hardware/README.md) includes real optical/temperature/ECG signal acquisition. Steps and distance use the separate [Google Health integration](GOOGLE_HEALTH.md); firmware motion simulation has been removed. Successful software checks do not establish functioning physical sensors or a completed real Google account import. Use the [connection guide](../hardware/CONNECT_ESP32.md) to verify acquisition and delivery separately. [The status ledger](audit/STATUS.md) separates local evidence from remaining checks.
