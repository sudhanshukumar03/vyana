# Testing

Use Node 24.22.1 or newer within 24.x, pnpm 11.18.0 and Python 3.12. Install JS with `pnpm install --frozen-lockfile` and Python with `--require-hashes -r ai/requirements-test.lock`.

## Software and browser checks

Create an empty, disposable PostgreSQL database whose name ends in `_test`. The integration suite resets its contents. Set its actual URL and explicitly allow the reset:

```powershell
$env:TEST_DATABASE_URL='postgresql://postgres:TEST_PASSWORD@127.0.0.1:55432/healthguard_test'
$env:ALLOW_TEST_RESET='1'
pnpm verify
pnpm --dir apps/web exec playwright install chromium
pnpm test:e2e
```

Use your disposable test credentials in place of the example. Integration tests require both variables; without a URL they are skipped. A pass with skipped integration tests is not a database verification pass.

`pnpm verify` runs documentation/reference checks, types, lint, API/frontend tests, builds and Python tests/lint. API lint currently repeats TypeScript checking; frontend uses ESLint and Python uses Ruff. Browser tests start isolated API/Vite servers on 18000/4173 and require a built API.

For JS checks in Linux, build `docker build -f scripts/Dockerfile.verify -t healthguard-checks .`, then run `docker run --rm healthguard-checks`. Supply test database variables only for a disposable database. That image runs JS checks; Python and firmware checks are separate.

## Operational rehearsals

The extra runners require `VERIFY_DISPOSABLE=1` and exactly:

```text
VERIFY_DATABASE_URL=postgresql://postgres@127.0.0.1:55434/healthguard_soak_test
```

Initialize a separate native PostgreSQL cluster under ignored `.audit-runtime/native-postgres`, bound to 127.0.0.1:55434. Its trust authentication is for synthetic fixtures only. These runners do not target the normal Compose database.

| Runner | Purpose |
|---|---|
| [verification-server.cjs](../scripts/verification-server.cjs) | Migrate as operator; serve a restricted API on 18081, with web origin 18080 |
| Vite preview, port 18080 | Built UI/proxy; set `API_PROXY_TARGET=http://127.0.0.1:18081` |
| [verify-stack.cjs](../scripts/verify-stack.cjs) | Dense seed, 10-device/20-client load, duplicate replay and acknowledgement reconciliation; `SOAK_SECONDS` defaults to 1800 |
| [verify-query-plans.cjs](../scripts/verify-query-plans.cjs) | Capture dense-owner SQL plans |
| [verify-operations.cjs](../scripts/verify-operations.cjs) | Backup, legacy import, permissions, restore, retention and failed startup |
| [verify-simulator.cjs](../scripts/verify-simulator.cjs) | Run the actual simulator and verify its producer contract |
| [verify-failures.cjs](../scripts/verify-failures.cjs) | Stop/start the dedicated native cluster and its own AI child; verify recovery |
| [verify-proxy.cjs](../scripts/verify-proxy.cjs) | Exercise the isolated nginx stack, uploads, sockets and CSP |

Python-spawning runners accept `VERIFY_PYTHON`. Local defaults reference the Windows verification environment; choose your installed interpreter. Proxy/failure runners have their own topology requirements: inspect their configuration before running them.

Outputs and synthetic backups go into ignored `artifacts/`; scratch databases/toolchains stay in `.audit-runtime/`. Run heavy builds/load sequentially on constrained machines. Preserve existing user volumes and unrelated containers.

## CI and external checks

[GitHub CI](../.github/workflows/ci.yml) defines software/PostgreSQL/browser, firmware and digest-pinned secret-scan jobs. A local pass does not mean hosted CI has run.

See [hardware](../hardware/README.md) for firmware commands. Record live-provider, physical-board, screen-reader and external-HTTPS results separately in [the ledger](audit/STATUS.md).
