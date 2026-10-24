# Local demo

Use synthetic data and follow [setup](SETUP.md). Review [the status ledger](audit/STATUS.md) before describing unverified capabilities.

1. Start Compose, open http://localhost:8080 and complete a local account's profile. Show the missing-data state before telemetry.
2. Provision a device and save its credential privately in `simulator/.env`.
3. Run the normal simulator. Show vitals, activity, heartbeat and source. Explain the simulated processing and ECG illustration.
4. Restart with `SIMULATION_SCENARIO=high_heart_rate`, then `critical_heart_rate`. Show immediate escalation. Return to normal and show recovery after three fresh in-range readings.
5. After enough records arrive, page through History. Edit the profile and verify medication/allergy notes remain.
6. Log a synthetic SOS in Emergency. Acknowledge/resolve it in Notifications. Explain that it records an event without dispatching services.
7. Open Assistant and ask a general wellness question or upload a harmless synthetic PDF/PNG/JPEG. Show fallback guidance if the provider is unavailable.
8. Stop the simulator, wait past `STALE_SECONDS` and show the stale state/unavailable score. Sign out, reload and use another account to show separate data.

Use [the test suite](TESTING.md) for repeatable verification. A demonstration does not replace hardware, provider, accessibility or HTTPS evidence.
