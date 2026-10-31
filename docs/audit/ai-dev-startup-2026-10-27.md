# AI development startup repair - 27 October 2026

The user reported that the assistant was unavailable in the host development app at `http://localhost:5173`.

The API's `AI_URL` was `http://127.0.0.1:8001`, with no listener on that port. The old root `pnpm dev` command started only the API/web workspaces; Python AI was a separately documented manual step. The Compose AI container was healthy but private to its own Docker network, so it did not satisfy the host API's connection. The existing provider probe independently confirmed Gemini authentication, model access and one synthetic generation with `gemini-3.1-flash-lite`.

The [development launcher](../../scripts/dev.cjs) now starts the local Python AI service before starting API/web, selects the project's `.venv` or `HEALTHGUARD_PYTHON`, loads the AI's private service environment, respects the configured local AI port and waits for readiness. It reuses a healthy existing service and leaves externally managed services running. It stops only the services/process groups it started. Startup reports missing runtimes, readiness failure and mismatched internal service secrets without printing secret values. `pnpm dev:ai` and `pnpm dev:apps` retain separate-start workflows.

The AI prompt's hardware description was also aligned with the current firmware: real MAX30102/DS18B20/AD8232 acquisition and simulated MPU6050 activity, with source-specific attribution and unverified physical accuracy. This text change was separate from the availability failure.

## Verification

- **Five startup regression tests passed**, including a real isolated synthetic FastAPI process: missing AI startup, health readiness, reuse by a second launcher, preservation when the borrower exits, and cleanup when its owner exits. No provider calls occur in these tests. `pnpm verify` now includes them.
- **All 139 Python AI tests and Ruff passed.** Initial fixture runs were blocked by sandbox temporary-directory permissions; the complete suite passed with a fresh authorized temporary test directory. One existing Starlette test-client deprecation warning remains.
- The real local AI service was started with the new managed launcher. Through the live Vite/API route, a temporary account received HTTP 200 from `/assistant/chat` with `source: gemini` and `offline: false` for a synthetic step-count question. Registration, identity, login, refresh and logout also passed. The verification account and its sessions were removed afterward.
- The running development app can now reach AI on loopback port 8001. Provider credentials, existing user accounts and the Compose deployment were not changed.

These checks verify local startup and one live chat route. They do not establish general clinical reliability or revalidate every possible provider response, report upload or browser interaction. No publication was performed.
