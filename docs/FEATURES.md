# Features and limits

Vyana is a prototype for exploring owned telemetry and general wellness guidance. Its scores, thresholds and AI output have no clinical validation.

## Accounts and live data

Each account has its own profile, contacts, devices, readings, alerts and AI context. One selected device supplies current readings. Switching sources replaces the live window and daily activity.

The dashboard distinguishes missing, fresh and stale data. `STALE_SECONDS` defaults to 30. An observation is current only within the configured age window and no more than five seconds ahead. Older accepted uploads remain history and do not raise current alerts.

History pages are chronological and cursor-based. Daily activity derives from session-aware cumulative-counter deltas in the profile timezone. A process restart does not turn the previous cumulative value into another day's activity.

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

Emergency contacts are saved per account. SOS creates a persistent in-app critical alert; it sends no email/SMS and dispatches no services. Nearby-service links depend on external map data and availability.

## Profile, BMI and wellness

Profile edits preserve omitted notes; optional fields can be explicitly cleared. BMI uses the unrounded value for classification and rounds only its display. Adult categories require a known age of at least 20; younger or unknown-age profiles receive no adult category.

The wellness score is a project heuristic. Missing/stale data or unsupported ECG states make it unavailable. The ECG on Vitals is a labeled synthetic illustration, with pause and reduced-motion behavior.

## Assistant and reports

Assistant provides bounded chat and PDF/PNG/JPEG analysis up to 10 MiB decoded. The server supplies the signed-in account's relevant profile fields, readings, activity, alerts and seven-day aggregates. Names and profile/account identifiers are omitted from the profile context. Reports receive this context too; document findings and device observations remain separate, with explicit identity/timing limits.

Answers lead with the main point and use structured supporting sections when useful. The UI renders text safely and labels Gemini responses, Vyana rules and limited fallback guidance. Missing, invalid or stale vitals are withheld as current measurements. Fixed threshold warnings remain available when AI fails. An unavailable model never produces an invented report summary.

Fresh critical project thresholds use fixed chat/insight guidance instead of asking Gemini to infer symptoms. Their source, values and limitations remain visible, including for brief or unrelated questions. Critical values are also withheld from report-model interpretation; the server appends their factual snapshot. Simulated readings cannot establish exercise readiness or a medical emergency.

Reports receive structural and blank-content checks before any model call. Blank, corrupt, encrypted, oversized or excessively complex files receive a recovery message without extracted findings. Text and scanned PDFs are supported within the review limits: 20 pages, 12 million pixels per image and 24 million pixels across scanned PDF images, in addition to the 10 MiB file limit. These checks do not verify the accuracy of model-generated findings.

Requests can be stopped; route changes and logout discard pending results. Chat history is bounded by bytes and turn count. Uploaded reports, their summaries and failed replies are excluded from subsequent chat context. Reports are reviewed once and are not saved for later questions or export.

The conversation supports keyboard scrolling. Completion, cancellation, failed uploads and unavailable reviews have contextual status messages; focus returns to the composer when a pending control becomes unavailable. Actual screen-reader speech still needs manual review.

Structured roles, JSON schemas, decoded-string scope checks and concurrency limits reduce specific failure modes. Unknown age and under-20 profiles receive distinct rules-based replies for personal BMI/weight/calorie targets. Full birth dates are replaced with age context before generation. These controls do not establish comprehensive model safety. The updated credential and `gemini-3.1-flash-lite` passed live generation and a finite synthetic evaluation; clinical suitability and broader human review remain unestablished. Follow the [provider recovery procedure](OPERATIONS.md#resolve-gemini-access).

Reports links to Assistant. Export and custom settings/thresholds are unavailable and labeled accordingly.

## Producers and operating limits

The Python simulator provides synthetic vitals, activity and heartbeat scenarios. Firmware uses simulated heart-rate/SpO2 processing and activity; a temperature sensor can supply a real reading. Its ECG status is a leads check, not an acquired diagnostic trace. Battery is unknown.

| Boundary | Implementation |
|---|---|
| Replay identity | Device + producer session + sequence, per telemetry kind |
| Firmware queue | 64 fixed records, at most 512 payload bytes each; newest overflow drops |
| Simulator queue | 128 records; bounded retries and explicit drops |
| Delivery | Only 2xx acknowledges; timeout/408/429/5xx retry |
| Ordinary JSON | 100 KiB, including conversation history |
| Report JSON / decoded file | 15 MiB / 10 MiB |
| History page | At most 100 records |
| Clock handling | UTC acquisition/receipt times; unsynchronized firmware withholds samples |

Queues are volatile. Compilation does not establish physical sensor accuracy, heap stability or reconnect reliability.

Public signup/email delivery, report export, wearable integrations, real sensor DSP, clinical interpretation and emergency dispatch are outside the current release. Physical hardware and external HTTPS checks are deferred by the user. [The status ledger](audit/STATUS.md) separates local evidence from these remaining checks.
