# Local exhibition procedure

Use the current local app at **http://localhost:5173**. Keep the laptop, database/API/AI services and intended Wi-Fi network available. Public hosting, verified notification delivery and clinically validated measurements are separate requirements.

1. Launch **Start Vyana.cmd**. Confirm the dashboard loads and Settings shows the service connection. The launcher reuses ready services. See [setup](SETUP.md) if dependencies or private configuration are missing.
2. Sign in to the intended Vyana account. In Settings > Your devices, select the existing ESP32. Preserve its credential; provision only once per board.
3. Open Activity. Connect Google Health with the intended account and confirm actual recorded steps/distance. Missing data stays unavailable. Google Fit sign-in alone is not evidence of an imported Google Health record.
4. For physical operation, first complete the outstanding electrical/sensor review and an electrodes-off firmware upload. The new waveform build has not yet been flashed. Follow the [hardware guide](../hardware/README.md). A build or changing ADC number does not establish a usable ECG.
5. With a verified powered board and network, check each channel independently. Confirm freshness, missing/disconnected channels, partial History/Trends, ECG input quality and the recorded waveform. The trace is raw ADC; rhythm stays unclassified. Pause, inspect loaded sample values or export the loaded ECG samples to demonstrate the exact plotted values.
6. Rehearse Wi-Fi loss/return, application restart and board power cycles in the intended safe hardware setup. Verify automatic recovery. Software tests cover socket/poll recovery; physical rehearsal remains required.
7. Review a harmless synthetic report in a separate demo account. Show saved review source/status and original download; unavailable AI must remain unreviewed. Chat follow-ups do not include the report.
8. Show SOS settings and the in-app event flow in a separate test account. Sending real notifications needs separately authorized recipient testing and configured/enabled delivery. The app does not dispatch emergency services.
9. Keep demonstrations identified. The session-only **Enable simulated demo** control illustrates vitals/ECG, never steps or walking distance, and resets on reload. Default operation remains live-only. Recorded reference datasets are separate from live hardware and SOS.
10. Close private configuration/credential windows, confirm the correct account/device, and keep [the remaining-work record](audit/required-software-2026-10-30.md) available for feature limits.

Use [testing](TESTING.md) for repeatable checks and [operations](OPERATIONS.md) for recovery/backups. Manual screen-reader use, broader qualified AI review, real Google import and physical signal quality cannot be established by automated tests alone.
