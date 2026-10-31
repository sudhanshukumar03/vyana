# Vyana scope and motion cleanup - 30 October 2026

This is a code/configuration inventory for the current local project, following the user's decision to use Google Health for steps and walking distance. It separates obsolete code, optional product scope and necessary unfinished work. A configured Google integration is not evidence of a real account import. Recommendations below are a list for review, not a claim that every listed feature has been deleted.

The subsequent [required-software follow-up](required-software-2026-10-30.md) implements the Google-only fallback/request cleanup, raw waveform software, Activity/Settings/trauma-control simplification and live provider query correction listed as pending in this inventory. External account and physical verification remain open.

## Current product sources

| Function | Intended source |
|---|---|
| Heart rate and SpO2 | MAX30102 on ESP32; reliable physical output still needs verification |
| Local probe temperature | DS18B20 on ESP32; measurement method/accuracy still needs verification |
| ECG input and lead state | AD8232 on ESP32; main firmware sends summaries, not waveform batches |
| Steps and walking distance | Account-owned Google Health integration, independent of ESP32 |
| Calories and active time | Not imported or calculated in the current Google integration |
| Battery percentage | Unavailable; firmware reports null |

## Confirmed obsolete items and cleanup

| Item | Evidence / action |
|---|---|
| MPU driver, PlatformIO dependency, pins and active simulation settings | Already absent from current production source, example configuration and private firmware configuration. Five obsolete motion-setting comment lines were found in the ignored private configuration and removed after an exact private backup; all active configuration lines are unchanged. `MPU6050_Driver.h` is deleted in the working tree. The remaining sensor library dependencies serve MAX30102, DS18B20 or JSON transport. |
| Firmware step/distance/calorie generation and activity uploads | Already removed. Main firmware uses the three health sensors and publishes vitals/equipment/heartbeats. Tests check that activity is not published. |
| Browser preview step generator | Removed in this pass. It constructed unused steps, distance, calories and active minutes even though the presentation layer used Google Health only. The preview now constructs vital examples only. |
| Test dependence on that unused generator | Replaced with an explicit historical fixture. The test still proves old generated activity stays hidden; it no longer needs a production fake-step generator. |
| Stale setup and feature specifications | Corrected the claims that activity was merely disabled by default, firmware continued activity polling/uploads, and the UI lacked device management. Current guides point to Settings > Your devices and describe Google activity separately. Related stale statements about DS18B20 rediscovery, report exports and demo ECG behavior were aligned with current code. |

No private network/device credentials were changed, no stored records were deleted and no board was flashed. The compiled motion-free firmware still needs a later electrodes-off upload to replace the installed image.

## Redundant or unnecessary for the current exhibition scope

| Candidate | Why it is unnecessary or overlapping | Recommended disposition |
|---|---|---|
| Legacy device activity totals in product summary/AI context | `telemetry.ts` falls back to device-counter activity when no connected Google day exists. This is a second activity source behind the Google-only UI. | Retire the product fallback and audit AI/export consumers. Preserve old account history and the explicitly synthetic development API until its callers are separated. Still pending. |
| Repeated activity history requests/state | `useHealthStore` loads legacy `/activity/summary` alongside Google records; Trends and Activity already use Google days. | Audit remaining History/export/socket consumers, then remove unnecessary product requests/state. Still pending. |
| Calories and Active Time cards | No imported values exist, so these remain unavailable. | Either hide them after the layout decision or implement real supported data; do not estimate them from steps. The current Activity layout is preserved in this pass. |
| Disabled theme/unit/chime controls and unsupported custom thresholds | Dark/system theme, imperial switching, chimes and custom thresholds are not functional product settings. | Defer these options or simplify their presentation. They are optional, not exhibition blockers. |
| Repeated prototype wellness-score panels | Dashboard and Wellness repeat a heuristic that requires Normal ECG; physical firmware reports Unknown and cannot produce that score. | Treat the score as optional. Keep it unavailable, or remove the score UI in a later agreed layout change. Do not invent Normal ECG or a clinical score. |
| Trauma filter | Current provider mapping does not assign a verified trauma category, so the filter cannot currently produce verified trauma results. | Hide until supported by verified provider data, or implement a defensible provider field. Still pending. |
| Clinical prediction/rhythm-diagnosis claims | No validated classifier, diagnostic interpretation or future-event prediction exists. | Exclude from exhibition specifications. A measured trace does not require a classifier. |
| Recorded-dataset replay/training pipeline | Downloads/integrity checks exist, but a replay viewer and trained/evaluated model do not. | Optional research work, independent of live telemetry. |
| Bluetooth pairing | The intended board-to-server path is Wi-Fi/HTTP. No Bluetooth pairing feature exists. | No Bluetooth configuration or UI is needed for this design. |
| Battery-percentage UI and physical SOS button | No battery measurement circuit or production button input exists. | Optional hardware expansion. Keep percentage unavailable and do not advertise a working physical button. |
| Permanent watchdog, login autostart and independent hosting | The current exhibition can use the laptop launcher. | Optional operating/deployment scope; required only if operation must continue without this laptop or an operator. |
| Full account backup/restore | Current exports intentionally cover loaded state/rows and original report downloads. | Optional expansion; do not label existing exports as a full backup. |

These candidates are not equivalent to unused files. Dashboard summaries, Vitals details, History records and Trends charts have different purposes. Report-library uploads persist originals/reviews; Assistant's direct upload is a one-time review. Those are related flows, not proven dead code.

Keep source/freshness checks, old-source recognition, account ownership, encryption, device credentials, bounded queues and retries. In particular, `ESP32_RealVitals_SimulatedSteps` identifies an older hub whose equipment can be real, while `ESP32_MPU6050_Simulated` identifies generated historical activity. Retaining these names in compatibility checks and regression fixtures does not configure a motion sensor. Removing the checks could hide the currently installed hub's health readings or misrepresent old generated data. Historical dated audit records remain evidence of their original versions.

Keep MAX-only and AD-only bench environments for sensor troubleshooting. They are diagnostic tools, separate from the full production firmware, and are useful for the remaining physical work.

## Needed work that can start without connected sensors

| Priority | Work | What can be completed offline |
|---|---|---|
| 1 | Finish Google-only activity semantics | Remove legacy fallback from product/AI context; align Activity, dashboard, summaries and exports for connected, disconnected, missing, zero and stale records. Preserve history and account isolation. |
| 2 | Production ECG waveform software | Implement bounded timestamped sample batches, owned transport/storage, restart/loss ordering and a measured-data chart. Exercise recorded or clearly labelled test input. Actual AD8232 waveform quality remains a physical check. |
| 3 | Simplify unsupported controls/specifications | Resolve the candidates above while preserving the agreed layout. Update feature/API/demo documentation to match the final chosen scope. |
| 4 | Accessibility and AI review | Check keyboard/focus/error flows, real screen-reader use and broader qualified AI-response evaluation. Software test success does not establish clinical suitability. |
| 5 | Final release checks | Run the appropriate tests/builds against the chosen final snapshot and record an exhibition startup/recovery procedure. A complete hardware rehearsal remains separate. |

## No sensor needed, but an external account/service is required

| Work | What remains |
|---|---|
| Real Google account connection | Complete consent and verify that the phone/tracker actually supplies steps/distance to the configured Google Health profile. First real import is unverified. Google Fit mobile sign-in alone does not prove this path. |
| Real location results | Verify provider availability and regional facility/contact data. Local error handling has automated coverage; real provider results do not. |
| Notification delivery, if included | Verify provider, sender, saved sharing preferences and receipt by an explicitly authorized recipient. Delivery is currently disabled/unverified; no messages or calls are authorized by this inventory. |
| Public signup/recovery, if public access is included | Implement user-facing verification/password recovery with real delivery. Current operator delivery is local. |
| Independent hosting, if required | Choose deployment/routing/HTTPS and verify browser/socket/device access externally. No paid hosting or billing setup is implied. |

## Physical work to defer until the sensor session

- Upload the motion-free firmware with pads off-body; no USB/serial/flash operation was performed here.
- Establish reliable MAX30102 heart rate/SpO2 and validate the temperature measurement method.
- Verify AD8232 lead behavior, clipping and actual waveform quality after waveform transport exists.
- Review the exact body-contact module, protection, power supply and wiring.
- Rehearse all intended sensors together through battery use, Wi-Fi loss, backend restart, clock recovery and an exhibition-length run.
- Add measured battery input, a physical SOS button or persistent offline recording only if those optional requirements are chosen. Software can be prepared offline; physical verification cannot.

The [32-item inventory](remaining-work-2026-10-29.md) and [software-first review](software-first-2026-10-29.md) retain the detailed prior completion evidence.

## Verification of this cleanup

All 64 frontend tests, frontend lint, TypeScript/production build and project reference checks passed. Firmware source/build settings, editor metadata and the private configuration were scanned for motion configuration. Removing the private comments preserved all active lines exactly. No API or firmware implementation changed in this pass, and their previous test counts are not presented as new runs. No sensor, serial port, upload or external provider was used.
