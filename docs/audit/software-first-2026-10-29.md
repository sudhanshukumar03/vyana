# Software-first work - 29 October 2026

This follow-up groups the [32-item inventory](remaining-work-2026-10-29.md) by what can be completed without connected sensors. The current pass repairs the local product and preserves its established layouts. No physical sensor, serial connection, board reset or firmware upload was used for these changes. Test measurements and provider replies are synthetic and isolated from normal accounts.

## Fixed locally without sensors

| Original items | Result |
|---|---|
| 3-4: report outcomes and examples | Accounts start with an empty library. Failed/unreadable reviews stay explicitly unreviewed; actual provider metadata is retained. Retry reuses the original file. No fabricated OCR, findings, signatures or substitute patient document is displayed. |
| 5: report privacy and persistence | Originals and review metadata are encrypted in PostgreSQL with owner/report/purpose authentication. Every list/read/retry/delete is authenticated and owner-scoped. Limits are 20 reports and 80 MiB decoded per account, checked before AI work and again transactionally. Deleting during an in-flight retry cannot restore the file. New reports survive browser reload and are available to the same account on another browser. Legacy unowned browser caches are not imported; a user-operated clear control is provided rather than silently deleting old data. |
| 6-7: assistant provenance and report context | Failed chat shows the real failure instead of a hardcoded answer claiming Gemini provenance. Saved reviews are retrieved by authenticated report ID, with their actual source and result. The UI explicitly says follow-up chat does not include the report and removes unsupported report-specific suggestion chips. Report-context chat itself is not implemented. |
| 8: contacts and sharing | Actionable example clinicians/helplines and fabricated default hospital records are removed. Clinic telephone and personal telephone are separate fields. Clinician email drafts contain only fresh measured values from the selected device, identify local probe temperature, and withhold previews/stale values. Drafts still require the user's email application and sending action. |
| 9 and software part of 21: location integration | Provider keys are server-only. Authenticated, bounded, rate-limited proxy routes call fixed provider endpoints. Existing private server configuration is retained; browser key settings were backed up privately and removed. Unknown opening hours, telephone numbers and facility capability are not invented. Searches start with an explicit user-selected location. Live provider accuracy/availability remains unverified. |
| 10: settings honesty | The current version accurately exposes metric units and the light theme. Unsupported unit switching, dark/system theme and audio chimes are disabled and labelled unavailable. Those optional features have not been implemented. |
| 11: partial-sensor records | Individual equipment snapshots are stored independently of complete vitals, scoped to account/device, deduplicated and retained for 30 days. History has a paginated snapshot table; Trends offers probe/pulse/oxygen plots with gaps for missing values. ADC snapshots are explicitly not a streamed ECG waveform. Physical acquisition remains unverified by these software tests. |
| 12: exports | Settings exports a labelled loaded-state snapshot, including latest device equipment and Google activity. History CSV is labelled as loaded rows only. These are not a full account backup or restore facility. |
| 13: wellness-score limits | Unknown ECG remains unclassified and cannot become a Normal rhythm to obtain a score. The UI explains why the score is unavailable. No new scoring or diagnostic algorithm is claimed. |
| 14: device management | Settings supports provisioning a one-time credential, selecting an active owned device and revoking access. Credentials are shown only in memory. Firmware Wi-Fi/API settings and a physical board upload remain separate operator steps. |
| 22: startup recovery | The launcher can restart its own unhealthy/partial process tree after checking PID, original start time and exact wrapper command. It refuses to kill unrelated processes. Windows login autostart and a permanent watchdog are not installed. |
| Parts of 31-32: local release checks | Report upload supports keyboard activation, and its viewer uses the existing native modal with focus containment and Escape handling. Regression checks cover errors, ownership, encryption, quotas, retries, exports, device controls and partial history. This does not replace real screen-reader review, qualified AI review, hosted CI or an integrated hardware rehearsal. |

## No sensor needed, but an external dependency remains

| Items | What remains |
|---|---|
| 20 | Real notification delivery needs provider verification, consent, and an explicitly authorized recipient test. No email, SMS or call was sent by this work. |
| 21 | Real location searches need provider access and regional result verification. Local proxy tests use mocked responses. |
| 23 | Public verification/password recovery needs actual delivery and public deployment configuration; local operator delivery is not public recovery. |
| 24 | Independent hosting needs hosting/domain/TLS decisions and device-reachable routing. No paid service or public deployment was activated. |
| 25 | Google Cloud/API/OAuth setup exists locally. The linked mobile Google Health profile, account consent and first real import still need verification. Google Fit sign-in alone is not proof of a linked Health profile. |
| 31-32 | Manual accessibility and qualified AI evaluation can proceed offline; final hosted CI/release checks require the final intended configuration. |

## Reconnect sensors for measured verification

Items **1-2, 15-19, 26-27 and 30** require the actual board or electrical/measurement review for completion: real waveform streaming and signal quality, reliable MAX30102 output, probe interpretation, combined-sensor rehearsal, power/network recovery, body-contact protection, measured battery input, physical SOS input and power-loss/offline recording. Software for waveform/button/offline features can be developed before reconnecting, but these features are not implemented or validated merely by the current sensor-snapshot tests.

Items **28-29** (classification/ML and a recorded-dataset viewer/evaluation pipeline) can be developed without live sensors using separate recorded datasets. They remain optional research/expansion work, not completed features or prerequisites for this local defect cleanup.

## Storage and verification boundaries

Keep `AI_INTERNAL_SECRET` stable and backed up with private configuration: saved reports and Google credentials depend on it for decryption. Delete removes live account records; ordinary database backup retention is an operator policy. Old unowned browser report caches require the user's clear action. No report migration guesses an owner.

Current evidence is recorded in the status ledger. Automated success does not establish real medical signal quality, notification receipt or Google data availability.

Verification for this pass and reviews: **98 API tests, 64 frontend tests, 22 browser scenarios and 11 startup checks** passed. The final expanded device-selection scenario was rerun successfully after its locator was scoped to the correct device. The repeated review's browser run passed 21 scenarios; its delayed-list fixture was then corrected to hold replacement requests made by React StrictMode and passed in a targeted rerun. Frontend types/lint and API/frontend production builds pass. Desktop and 320 px screenshots were inspected, with additional 390/768/1440 px activity checks. The built browser assets were checked against configured private server credentials; none were present. Tests used only the explicit disposable test database. No provider messages or calls were sent.

## Follow-up review

The review found incomplete hospital lookup cleanup: unsuccessful or empty searches could retain a facility from a previous location, and a care filter could hide all cards while the map still selected an excluded facility. Lookups now clear the prior selection before requesting data, including GPS requests; empty, denied and failed outcomes cannot retain the old map destination. Provider failures are distinguished from empty successful results. Search text resolves a location rather than also filtering the returned facility names, and the clinic filter accepts provider-listed clinics.

The initial location no longer assumes New York. Its quick-city query is restored to the correct city. Unverified facility phone numbers are labelled as listed contact numbers, unknown hours are explicit, and absent phone numbers cannot create an actionable call link. These corrections preserve the existing layout.

A browser regression exercises found, empty, failed and denied results, unresolved and resolved searches, clinic/24-hour filters and map clearing. Large test runs respect the existing authentication retry delay when creating disposable accounts; production rate limits are unchanged. Physical sensors and real Google/location-provider connections were not exercised by this review.

## Repeated review

The repeated review identified two additional timing failures:

- A delayed socket device event could overwrite a newer heartbeat, restoring an older measurement or connection state. A failing regression reproduced this before the fix. Device socket events now use the same timestamp reconciliation as REST snapshots. The regression verifies that newer unavailable readings and a disconnected state remain intact.
- Device creation was enabled while the initial device list was still pending. Its older response could replace the refreshed list after a device was created. Creation now waits for that initial request, displays loading status and guards form submission. The initial request has a ten-second timeout so a stalled list does not block the form indefinitely. An isolated browser check delays the first list, then creates and revokes a disposable device.

Existing account/session isolation, Google disconnect races and automatic-update fallback checks remain covered. No firmware upload or physical sensor operation was performed during this review.
