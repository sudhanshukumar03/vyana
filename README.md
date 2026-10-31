# Vyana

Vyana is an educational wellness-monitoring project. It brings device readings, activity, alerts, profiles and optional AI guidance into one dashboard. The services use the HealthGuard name internally.

## Run locally

Install Docker and Python 3.12, then run:

```powershell
python scripts/setup_env.py
python scripts/check_config.py
docker compose up --build -d --wait
python scripts/check_config.py --services
```

Open the web origin printed by setup (default http://localhost:8080), create a local account and complete your profile. To send simulated readings:

```powershell
docker compose exec api node dist/provision.js account@example.test "Virtual wristband"
python -m pip install -r simulator/requirements.txt
```

Copy [the simulator example](simulator/.env.example) to `simulator/.env`, save the one-time credential as `DEVICE_KEY`, and set `API_BASE_URL` to your local API address plus `/api/v1` (default `http://127.0.0.1:8000/api/v1`). Run `python simulator/main.py`.

The local stack binds to loopback. If you already have a database, follow [the upgrade procedure](docs/OPERATIONS.md#upgrade-an-existing-database) before starting a newer version.

For host development after the [dependency/database setup](docs/SETUP.md#host-development), use `pnpm dev`. It starts the Python AI service together with the API and web app. The launcher uses the project's `.venv` and reuses an already healthy AI service. The web app opens at http://localhost:5173.

On Windows with initial setup complete, double-click **Start Vyana.cmd** to start the database and background development services, enable the existing ESP32 hotspot if it matches the private hardware configuration, and open the dashboard. Once the ESP32 has the configured full firmware, powered hardware sends readings automatically. See [everyday automatic operation](hardware/CONNECT_ESP32.md#everyday-automatic-operation).

## What works

- Separate accounts own their profiles, contacts, devices, readings and alerts.
- Authenticated devices send replay-safe readings; authenticated sockets update the dashboard.
- History, daily activity, freshness and alert recovery use observation time.
- Assistant supports chat and PDF/PNG/JPEG uploads up to 10 MiB, with explicit offline fallbacks.
- Firmware and simulator queues are bounded; installs and automated checks use committed locks.

For physical sensors, follow [Connect an ESP32](hardware/CONNECT_ESP32.md) and upload the normal `esp32dev` firmware. Live-only display is the default; missing or stale sensor values remain unavailable. Simulated displays require an explicit demo opt-in each page session, and firmware-generated activity is disabled by default. This project has no clinical validation.

## Documentation

Start with [the documentation index](docs/README.md). It links to setup, architecture, API, features, testing, operations and the audit records. See [the current audit status](docs/audit/STATUS.md) for verified results and remaining checks. Hardware and external HTTPS checks are deferred; public deployment has not been signed off.

To contribute, read [CONTRIBUTING.md](CONTRIBUTING.md). Author: Sudhanshu Kumar. [MIT license](LICENSE).

For recorded phone/tracker steps, see [Google Health web integration](docs/GOOGLE_HEALTH.md). The Activity page uses an independently connected account; firmware MPU6050 simulation has been removed. Google OAuth credentials and real account authorization must be configured before live cloud activity is available.
