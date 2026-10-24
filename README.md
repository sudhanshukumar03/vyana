# Vyana

Vyana is an educational wellness-monitoring project. It brings device readings, activity, alerts, profiles and optional AI guidance into one dashboard. The services use the HealthGuard name internally.

## Run locally

Install Docker and Python 3.12, then run:

```powershell
python scripts/setup_env.py
docker compose up --build -d
```

Open http://localhost:8080, create a local account and complete your profile. To send simulated readings:

```powershell
docker compose exec api node dist/provision.js account@example.test "Virtual wristband"
python -m pip install -r simulator/requirements.txt
```

Copy [the simulator example](simulator/.env.example) to `simulator/.env`, save the one-time credential as `DEVICE_KEY`, and set `API_BASE_URL=http://127.0.0.1:8000/api/v1`. Run `python simulator/main.py`.

The local stack binds to loopback. If you already have a database, follow [the upgrade procedure](docs/OPERATIONS.md#upgrade-an-existing-database) before starting a newer version.

## What works

- Separate accounts own their profiles, contacts, devices, readings and alerts.
- Authenticated devices send replay-safe readings; authenticated sockets update the dashboard.
- History, daily activity, freshness and alert recovery use observation time.
- Assistant supports chat and PDF/PNG/JPEG uploads up to 10 MiB, with explicit offline fallbacks.
- Firmware and simulator queues are bounded; installs and automated checks use committed locks.

Sensor DSP, activity and the ECG illustration include simulated data. SOS records an in-app alert. It does not contact emergency services. This project has no clinical validation.

## Documentation

Start with [the documentation index](docs/README.md). It links to setup, architecture, API, features, testing, operations and the audit records. See [the current audit status](docs/audit/STATUS.md) for verified results and remaining checks. Hardware and external HTTPS checks are deferred; public deployment has not been signed off.

To contribute, read [CONTRIBUTING.md](CONTRIBUTING.md). Author: Sudhanshu Kumar. [MIT license](LICENSE).
