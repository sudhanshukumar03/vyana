# Setup

## Compose demo

Install Docker and Python 3.12:

```powershell
python scripts/setup_env.py
docker compose up --build -d
```

Open http://localhost:8080 and create a local account. The setup script creates distinct random secrets and preserves existing database URLs and Gemini keys. Keep the generated environment files private.

| Service | Host address | Container address |
|---|---|---|
| Web | localhost:8080 | web:80 |
| API | localhost:8000 | api:8000 |
| PostgreSQL | localhost:5433 | db:5432 |
| AI | Private | ai:8001 |

Host Node/pnpm are needed for development, not for building the Compose images. Existing databases need [the upgrade procedure](OPERATIONS.md#upgrade-an-existing-database); changing an environment password does not change the password stored in an existing volume.

## Simulator

After creating an account, provision its device:

```powershell
docker compose exec api node dist/provision.js account@example.test "Virtual wristband"
python -m pip install -r simulator/requirements.txt
```

Copy [simulator/.env.example](../simulator/.env.example) to `simulator/.env`. Set `DEVICE_KEY` to the one-time credential and `API_BASE_URL=http://127.0.0.1:8000/api/v1`, then run:

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

Set `apps/api/.env` to the actual PostgreSQL credentials on port 5433, `WEB_ORIGIN=http://localhost:5173` and the same `AI_INTERNAL_SECRET` as `ai/.env`. `JWT_SECRET` and `AI_INTERNAL_SECRET` must differ and each contain at least 32 characters. Review [the API environment example](../apps/api/.env.example) and [the AI example](../ai/.env.example).

Run these in separate terminals, with the Python environment active:

```powershell
pnpm --dir apps/api dev
python -m uvicorn main:app --app-dir ai --port 8001
pnpm --dir apps/web dev
```

Open http://localhost:5173. Build the API before using its operator CLIs: `pnpm --dir apps/api build`, then `pnpm --dir apps/api provision-device account@example.test "Virtual wristband"`.

Gemini is optional for local use. Missing or rejected credentials produce labeled fallback guidance. See [testing](TESTING.md) for checks and [operations](OPERATIONS.md) for deployment and data handling.
