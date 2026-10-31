# Setup

## Compose demo

Install Docker and Python 3.12:

```powershell
python scripts/setup_env.py
python scripts/check_config.py
docker compose up --build -d --wait
python scripts/check_config.py --services
```

Open the web origin printed by setup (default http://localhost:8080) and create a local account. Setup generates missing secrets, preserves existing database URLs/passwords/provider keys, and refuses conflicting service secrets. Database passwords are URL-encoded. Keep the generated files private.

| Service | Default host address | Container address |
|---|---|---|
| Web | localhost:8080 | web:80 |
| API | localhost:8000 | api:8000 |
| PostgreSQL | localhost:5433 | db:5432 |
| AI | Private | ai:8001 |

If a port is occupied, set `WEB_PORT`, `API_PORT` or `DB_PORT` in the root `.env` before starting. Keep `WEB_ORIGIN` equal to the chosen web origin and host API database URLs on the selected DB port. The local configuration check reports mismatches without printing credentials. Use `COMPOSE_PROJECT_NAME` only when deliberately selecting a separate stack/volume; changing it does not move existing data.

Host Node/pnpm are needed for development, not for building the Compose images. Existing databases need [the upgrade procedure](OPERATIONS.md#upgrade-an-existing-database); changing an environment password does not change the password stored in an existing volume.

## Simulator

After creating an account, provision its device:

```powershell
docker compose exec api node dist/provision.js account@example.test "Virtual wristband"
python -m pip install -r simulator/requirements.txt
```

Copy [simulator/.env.example](../simulator/.env.example) to `simulator/.env`. Set `DEVICE_KEY` to the one-time credential and `API_BASE_URL` to your configured API address plus `/api/v1` (default `http://127.0.0.1:8000/api/v1`), then run:

```powershell
python simulator/main.py
```

Choose `SIMULATION_SCENARIO`: `normal`, `high_heart_rate`, `critical_heart_rate`, `low_spo2` or `high_temperature`. Each process starts a new producer session; daily totals come from counter deltas in the profile timezone.

## Host development

Use Node 24.22.1 or newer within 24.x, pnpm 11.18.0 and Python 3.12.

```powershell
pnpm install --frozen-lockfile
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --require-hashes -r ai/requirements-test.lock
python scripts/setup_env.py
docker compose up -d db
```

For Linux/macOS, activate with `source .venv/bin/activate`.

Setup creates a restricted runtime `DATABASE_URL` and separate operator `MIGRATION_DATABASE_URL` for a new local configuration. Review preserved existing URLs before use. Set `WEB_ORIGIN=http://localhost:5173` for host development and keep `AI_INTERNAL_SECRET` aligned with `ai/.env`. Signing/internal secrets must differ and each contain at least 32 printable ASCII characters. Review [the API environment example](../apps/api/.env.example) and [the AI example](../ai/.env.example).

After installing dependencies and starting the database, run all development services together:

```powershell
pnpm dev
```

This starts the Python AI service, waits for its health check, then starts the API and web workspaces. The launcher selects the project's `.venv` automatically, or `HEALTHGUARD_PYTHON` when explicitly set. It follows `AI_URL` in `apps/api/.env`; a healthy existing local AI service is reused, and an external AI service stays externally managed. Services started by the launcher stop with it; reused services are left running. `pnpm dev:ai` starts only AI, and `pnpm dev:apps` starts only API/web.

Alternatively, run these in separate terminals, with the Python environment active:

```powershell
pnpm --dir apps/api dev
python -m uvicorn main:app --app-dir ai --port 8001
pnpm --dir apps/web dev
```

Open http://localhost:5173. Build the API before using its operator CLIs: `pnpm --dir apps/api build`, then `pnpm --dir apps/api provision-device account@example.test "Virtual wristband"`.

The API's `ts-node-dev` startup loads `apps/api/.env` relative to the API directory and gives that service file precedence over inherited Compose settings during local development. Keep its `WEB_ORIGIN=http://localhost:5173`; the root `.env` can retain the separate Compose web origin. Outside the development watcher, explicitly supplied deployment environment variables keep precedence. Restart the dev command after editing environment files or Python AI source.

On this Windows workspace, [with-node.ps1](../scripts/with-node.ps1) selects the supported project Node runtime without changing the global installation: `./scripts/with-node.ps1 pnpm dev`. Activate your Python environment separately for manual Python commands; the dev launcher selects `.venv` itself. Fresh checkouts need a supported Node installation; the helper does not download one.

Gemini is optional for local use. Missing or rejected credentials produce labeled fallback guidance. See [testing](TESTING.md) for checks and [operations](OPERATIONS.md) for deployment and data handling.
