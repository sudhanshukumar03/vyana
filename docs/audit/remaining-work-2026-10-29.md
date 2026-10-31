# Vyana remaining work inventory - 29 October 2026

This inventory is based on the current working-tree implementation and recorded physical checks. It is not a fresh full test-suite run or a clinical assessment. Earlier dated feature descriptions do not always match the current UI. The items below distinguish missing implementation, defects, unverified integrations and optional expansion; they are not all requirements for the exhibition.

See the [30 October required-software follow-up](required-software-2026-10-30.md) for the subsequently implemented raw-waveform software, Google-only activity and current verification boundaries. The waveform implementation gaps below describe the earlier inventory; firmware installation and physical signal validation remain open.

The [software-first follow-up](software-first-2026-10-29.md) groups the work by sensor-free repairs, external-service dependencies and physical verification. The updated rows below record this pass; optional expansion is not implied complete.

## Working baseline

- The full ESP32 firmware is deployed. Repeated fresh AD8232 input summaries reach the existing active device over Wi-Fi, including after the user-reported switch to battery power.
- Dashboard live events and fallback polling have isolated browser verification. These deliver latest input summaries, not real ECG waveform samples.
- Account/session handling, owned API/database storage, profile/contact CRUD, complete-vitals history and source/freshness handling exist.
- AI chat/document endpoints, SOS preferences/countdowns/notification jobs, history CSV, report original-file download and a Settings snapshot export exist. Their existence must not be described as every UI/error/integration path being complete.
- A physical DS18B20 local probe reading was previously observed in Vyana. Reliable physical MAX30102 HR/SpO2 has not been established.

## Implement or repair existing product behavior

| # | Remaining work | Current evidence / completion criterion |
|---|---|---|
| 1 | Real ECG waveform in Vyana | Full firmware sends one ADC snapshot plus counters every five seconds. Add bounded timestamped sample batches, authenticated transport, ordering/loss/restart handling and a measured-data chart. Keep generated previews separate. See `hardware/esp32/src/main.cpp` and `apps/web/src/components/ECGWaveform.tsx`. |
| 2 | ECG signal-quality verification | Recent user-reported pads-on summaries contained clipping; the final window had 237 clipped of 1,250 counted samples. Capture actual waveform samples and assess clipping, continuity and lead state. Changing ADC values or `Unknown` do not validate an ECG. |
| 3 | Reports error/status honesty | Fixed locally: actual review outcomes are retained; failed/unreadable reports stay unreviewed and can retry the stored original. No fabricated OCR/success text. |
| 4 | Reports sample-data separation | Fixed locally: real accounts start empty. Predefined patient reports and substitute signed clinical documents were removed. |
| 5 | Reports privacy and persistence | Fixed locally: encrypted account-owned PostgreSQL storage with owned read/retry/delete, 20-file/80-MiB limits and safe in-flight deletion. Legacy unowned browser caches are not imported; an explicit clear control is provided. |
| 6 | Assistant error provenance | Fixed locally: failed chat shows an actual error. Saved report reviews preserve their real provider metadata; no client fallback invents Gemini provenance or findings. |
| 7 | Report follow-up context | Fixed within supported scope: unsupported report-specific follow-up suggestions and promises were removed. Chat explicitly excludes report context; contextual follow-up itself remains optional future work. |
| 8 | Doctor/emergency directory data and sharing | Fixed locally: placeholder helplines/default facilities removed, own clinician/clinic numbers stored separately, and email drafts filter stale/generated readings. Real contact/provider details still need user verification. |
| 9 | Third-party API credential handling | Fixed locally: browser key literals/settings removed, existing private server keys retained, and authenticated fixed-endpoint proxies validate/bound/rate-limit location requests. Live provider availability remains unverified. |
| 10 | Settings actually affect the application | Fixed for current supported behavior: metric/light are explicit. Unit switching, dark/system theme and chimes are disabled and labelled unavailable; those optional features are not implemented. |
| 11 | Partial-sensor history and trends | Implemented locally: owned, deduplicated partial snapshots persist independently of complete vitals; History has paging and Trends has selectable probe/pulse/oxygen plots with missing-data gaps. Live acquisition remains for sensor rehearsal. |
| 12 | Export scope and complete backup | Fixed scope claims: Settings downloads a loaded-state snapshot; History CSV exports loaded rows only. Full account export/restore and ECG waveform export remain separate optional work. |
| 13 | Real-hardware wellness-score behavior | Fixed unavailable-state explanation: Unknown remains unclassified and cannot satisfy Normal ECG scoring. Physical firmware therefore leaves the score unavailable; no diagnosis or new score algorithm is claimed. |
| 14 | Device management UI | Implemented local UI: create one-time credentials, select owned active devices and revoke access in Settings. Physical Wi-Fi/API configuration and board upload remain operator steps. |

## Complete integration and physical verification

| # | Remaining work | Current state / next evidence |
|---|---|---|
| 15 | Reliable MAX30102 HR/SpO2 | Drivers, algorithm and independent display exist, but previous physical acquisition was absent/stalled/intermittent. Establish repeatable measured output, contact behavior and recovery with the actual module. |
| 16 | Temperature interpretation/accuracy | Local DS18B20 probe acquisition was observed. Validate repeatability and the intended measurement method; a probe reading is not automatically core body temperature. |
| 17 | Combined-sensor rehearsal | Run the intended connected-sensor configuration through power-on, Wi-Fi join, live display, history and missing/disconnected-channel behavior. Current battery verification used AD8232 input summaries. |
| 18 | Longer hardware recovery/soak tests | Test Wi-Fi loss/return, hotspot and API restarts, clock synchronization, queue overflow, memory stability and repeated board power cycles over an exhibition-length run. Short successful delivery checks do not complete these. |
| 19 | Body-contact electrical review | Exact breakout protection, isolation, supply and wiring have not been independently checked. The photographed module is CJMCU-8232 V502; another manufacturer's schematic does not establish its protection. Software/transport tests cannot close this item. |
| 20 | Real notification delivery | The local `setup_sos.py --check` reports credential format/completeness satisfied, delivery disabled and provider credentials not verified. Verify account/sender/recipient capability, saved consent and receipt using separately authorized tests before claiming working email/SMS/voice delivery. No messages/calls were sent during this inventory. |
| 21 | Live hospital/location integration checks | Lookup code exists. Verify location permission/error handling, provider availability, actual regional results and clearly distinguish sourced facts from heuristics about emergency/trauma capability or opening hours. |
| 22 | Startup durability | Implemented guarded recovery for this launcher's unhealthy/partial process tree, verified by PID/start time/command. Unowned processes are not stopped. Permanent watchdog/login autostart remain optional and uninstalled. |
| 23 | Public accounts and recovery delivery | Local login/signup work. Production signup requires a verified delivery setup; verification/password-reset tokens currently use a local operator delivery sink. Add real delivery and user-facing recovery/verification flows before public use. |
| 24 | Hosting independent of this laptop | The deployment is local and depends on the PC/backend/hotspot. An always-on deployment still needs hosting, HTTPS/domain configuration, device-reachable API routing and external browser/socket tests. The ESP32 supports configured HTTPS but external TLS has not been verified. |

## Optional expansion or broader release work

| # | Remaining work | Scope clarification |
|---|---|---|
| 25 | Real Google Health account linking and import | Cloud Health API and Web OAuth client are enabled/configured, with the intended test account and read-only scope. The linked mobile profile, user consent and first real sync remain unverified. MPU source removal is compiled but not flashed. |
| 26 | Measured battery level | Firmware sends `battery: null`; no battery measurement circuit/driver exists. A percentage requires suitable hardware and validation. |
| 27 | Physical SOS button | Authenticated device SOS support exists, but the full firmware has no physical button driver/debounce/input integration. Optional until a button is part of the intended device. |
| 28 | ECG interpretation / trained model | Rhythm classification, diagnostic interpretation and future-event prediction are not implemented or validated. Downloaded datasets do not mean a model has been trained. Treat these as separate research scope, not something needed just to draw a trace. |
| 29 | Recorded-dataset viewer and evaluation tooling | Dataset download/integrity/format work exists. A Vyana replay viewer, preprocessing/evaluation pipeline and any trained model are separate future work, with recorded data kept distinct from live hardware and SOS. |
| 30 | Durable offline capture | Firmware retries with a bounded volatile queue; overflow can drop records and power loss clears the queue. Persistent offline recording is an optional design change if lossless offline history is required. |
| 31 | Manual accessibility and wider AI review | Report upload keyboard operation/native modal behavior and local regressions improved. Actual screen-reader review and wider qualified AI evaluation remain open; tests do not establish medical suitability. |
| 32 | Current release verification and documentation | Software-first API/frontend/browser/startup checks and documentation updated; see the follow-up. Hosted CI on the final snapshot, broader manual review and the integrated physical rehearsal remain open. |

## Exhibition priority

For 31 October, first address a real measured waveform and its quality limits, eliminate fabricated report/AI success and actionable placeholder contacts, then rehearse the exact intended hardware/app setup. Provider sending, physical activity, battery percentages, classification/ML, public hosting and durable offline recording are separate scope decisions. Show them as unavailable unless independently completed and verified.
