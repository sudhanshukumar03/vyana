# Automatic hardware-to-dashboard updates: 29 October 2026

The user requested normal unattended uploads when the hardware is powered, without asking an assistant to copy readings. During the initial software work they reported no sensors connected; no hardware action was taken then. Later they confirmed the AD8232 was connected to the ESP32, all pads were off-body and laptop USB was connected. The deployment below followed that confirmation.

## Changes

- Full `esp32dev` startup explicitly selects station mode, enables automatic Wi-Fi reconnection and disables Wi-Fi sleep. Existing five-second equipment publication and bounded HTTP retry/offline buffering remain in place. Sensor validity checks and live-only defaults remain intact.
- Dashboard socket delivery remains the primary transport. A shared lifecycle now polls every five seconds when the socket is unavailable and reconciles every 30 seconds when connected. Network recovery, focus and visibility changes trigger immediate catch-up, with duplicate wake events suppressed. Hidden/offline tabs pause polling while freshness continues to age. Cleanup removes all timers/listeners.
- A disconnected socket can be reopened without creating another socket or interrupting an active Socket.IO reconnection attempt. Snapshot requests and session refreshes have ten-second deadlines so stalled requests do not prevent later automatic refreshes.
- `Start Vyana.cmd` starts the existing local database plus background API/web/AI services, opens the dashboard and reuses ready services on subsequent launches. It attempts to enable a saved PC hotspot only when its SSID matches private firmware configuration, preserving its credentials. Initial project setup remains required. Logs and owned-process identity are stored under ignored `.audit-runtime/vyana-startup/`.

## Verification

- All 54 frontend tests passed, including five synchronization lifecycle cases, stopped-socket recovery and recovery after a stalled snapshot timeout.
- All 67 native firmware tests passed, including automatic wireless startup and existing independent sensor publication/validity tests.
- Two new Playwright scenarios passed against the separate `healthguard_autoupdate_test` database: a temperature-only software fixture changed twice on an already open dashboard through socket delivery, then through polling with all Socket.IO requests blocked. No page reload or navigation was used to receive either change. These are software fixtures, not physical measurements.
- Six startup readiness checks passed. The launcher started the existing development database and services, then reused those ready services on a second invocation. Both live launcher checks used `-NoBrowser -SkipHotspot`; automatic hotspot activation and browser opening were not exercised.
- Frontend type checking, lint, production build and API build passed. The full ESP32 firmware compiled successfully; the existing third-party library warnings remain.

## Follow-up review

A second review reproduced two defects and fixed them:

- Under Windows PowerShell's `Stop` error preference, redirected native stderr threw `NativeCommandError` before the launcher could inspect Docker's nonzero exit code. The daemon-readiness probe now handles native failures as false results and restores the caller's error preference. Two real native-command fixtures verify stopped-daemon failure and successful readiness despite diagnostic stderr. No unrelated containers were stopped to reproduce this case.
- A REST summary requested before a live equipment event could arrive afterward and replace a newer temperature with the old value. A regression reproduced 26 reverting to 25. Same-device reconciliation now preserves the newer heartbeat/equipment while keeping API device-selection state authoritative. Two regressions cover old and absent REST heartbeats.

After these fixes, all 56 frontend tests and eight launcher checks passed. Frontend lint and production build also passed. Both isolated browser scenarios passed again. The socket scenario now blocks subsequent REST summaries after confirming the live connection, so polling cannot account for its two visible measurement changes. The other scenario blocks Socket.IO and verifies fallback polling. The running Vyana services were reused successfully by the repaired launcher with hotspot/browser actions skipped.

## Full firmware deployed and direct delivery verified

Windows detected the existing CP210x-connected ESP32 on COM3. The launcher enabled the saved `Vyana-ESP32` hotspot without changing its credentials and reused the ready local services. The configured hardware credential matched the existing active, unrevoked device; no new device/account was provisioned. The hotspot API readiness endpoint returned HTTP 200.

The complete 4,194,304-byte current flash was backed up privately before replacing the standalone ECG diagnostic. PlatformIO uploaded `esp32dev`, verified written hashes and reset the board successfully. This also deployed the previously reviewed AD8232 ADC initialization-order correction. No wiring or pad changes were made by software.

A 45-second off-body serial check received nine equipment reports and nine HTTP 200 delivery messages. The reported queue drained to zero each time; no captured panic, allocation/transport fault or diagnostic drop occurred. The AD8232 reported `Leads Off` in every equipment report. Raw ADC values ranged from 3463 to 4095 in these reports; valid/contact sample counts remained zero. These off-body readings do not establish a usable ECG or heart rate. The disconnected optical and temperature sensors supplied no valid measurements.

An independent read-only database check observed ten distinct, fresh equipment timestamps over ten checks approximately five seconds apart. The existing selected device was active and connected throughout. The source was the full real-sensor firmware. After closing the serial monitor, another read at 11:28:37 UTC (16:58:37 India time) confirmed a newer heartbeat and equipment timestamp. The verification scripts did not post measurements: the board delivered them directly over Wi-Fi while USB supplied power.

Private backup, upload log, source/binary hashes and sanitized checks are under `.audit-runtime/automatic-upload-2026-10-29/`. The deployment manifest is `deployment-manifest.json`; observed results are `serial-verification.json`, `database-verification.json` and `postserial-verification.json`. Physical delivery is now verified on this local setup. The earlier isolated browser checks verify dashboard rendering through both live events and polling; no new signed-in browser UI inspection was performed during this upload.

## Remaining limitations

After the user reported switching to battery power, four read-only checks received distinct equipment timestamps five seconds apart, each with a heartbeat approximately one second old. The last observation was 11:42:39 UTC. All reported `Leads Off`; the raw ADC values ranged from 3466 to 3475. PlatformIO then listed no serial devices, consistent with laptop USB being disconnected. No port was opened or board reset during this check. Evidence is retained privately in `battery-wireless-verification.json`. The battery type, charging state and electrical body-contact protection were not independently verified; this observation confirms wireless delivery after the user-reported power change, not body-contact safety.

The local PC/backend and saved Wi-Fi must stay available. This work does not provision an always-on hosted backend or install Windows login/startup tasks. The finite offline queue is in RAM; it can overflow and is cleared by power loss. Long-duration radio/outage recovery and body-connected ECG quality remain unverified. Pads remain off-body while computer USB is connected.

## Subsequent user-reported pads-on observation

The user later reported attaching the pads. Monitoring was limited to five read-only database equipment summaries over approximately 20 seconds; no USB port was accessed, firmware reset/upload performed or acquisition setting changed. All five summaries were fresh with distinct timestamps. Status changed from `Leads Off` in the first check to `Unknown` in the remaining four. The firmware uses `Unknown` when neither lead-off input is asserted; it does not classify rhythm or establish valid electrode contact.

The last two windows each contained 1,250 counted non-lead-off ADC samples. The final window included 237 clipped samples (raw input at or near an ADC limit), approximately 19%. Across the five reported windows, 1,009 of 5,190 counted samples were clipped. This observation does not provide a recorded waveform or validate a usable ECG, heart rate or electrical body-contact protection. The user was instructed to keep laptop USB and all charging connections disconnected. Evidence is the timestamped `body-summary-*.json` capture in the ignored verification directory.
