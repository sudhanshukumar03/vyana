# Operations

## Saved report storage and location providers

The Reports library stores encrypted originals and review metadata in the account-owned `saved_reports` table. Limits are 20 reports and 80 MiB decoded per account. Preserve and securely back up `AI_INTERNAL_SECRET` with database backups: changing it without a re-encryption migration makes saved reports and Google tokens unreadable. Account deletion cascades reports; explicit report deletion removes the live original and review. Backup retention remains an operator policy.

New reports no longer use browser localStorage. Legacy unowned `vyana_saved_reports` caches are not imported; Reports offers a user-operated clear button. Do not assign those old records to an account by guessing ownership.

Location lookups use private API configuration `GEOAPIFY_API_KEY` (legacy `GEOAPIFY_KEY` is also accepted) and `API_NINJAS_KEY`. Host development reads `apps/api/.env`; Compose receives the root environment variables. Do not put provider credentials in `VITE_*`. Missing configuration returns an unavailable state. Automated provider tests do not verify current quota, regional coverage or facility contact accuracy.

Individual equipment history is retained for 30 days during device ingestion; it is separate from complete-vitals history and ECG waveform recording. No automatic Windows login service or permanent watchdog is installed by the one-click startup recovery.

## Upgrade an existing database

1. Stop ingestion. Create and verify a custom-format `pg_dump` backup; retain the prior app revision and configuration.
2. Preserve the volume's actual `POSTGRES_PASSWORD`. Set a separate `APP_DB_PASSWORD` and operator `MIGRATION_DATABASE_URL`.
3. Create/configure the restricted `healthguard_app` role through the operator connection. New Compose databases use [infra/init-db.sh](../infra/init-db.sh); existing volumes do not rerun initialization scripts.
4. Point runtime `DATABASE_URL` at the restricted role. Startup applies versioned, checksum-verified migrations through the operator connection before listening. A failure stops startup.
5. Rehearse on a copy. Old unowned patient tables move to restricted `legacy`; password hashes remain intact. Signup never adopts those records.
6. If ownership is known, run the built API's import command with operator access:

```powershell
pnpm --dir apps/api legacy-import account@example.test Asia/Kolkata --confirm-backup
```

Use the original timezone of naive timestamps. The import is atomic, preserves originals and refuses repeated assignment. Keep backups until the upgrade and restore checks pass. Preserve existing volumes.

Migration checksums use canonical LF line endings. Existing hashes for identical CRLF files are accepted so Windows/Linux checkouts remain compatible; changed SQL still fails verification.

## Backup, restore and retention

Use PostgreSQL operator tools to dump a consistent database and inspect the archive. Restore into a new disposable database; compare record counts, ownership and application behavior before switching traffic.

Rollback needs a schema-compatible app revision or a verified pre-upgrade backup. Prefer a reviewed roll-forward migration when possible.

Retention runs only when requested. Set `RETENTION_DAYS` from 7 to 3650, verify a backup, then run `pnpm --dir apps/api maintenance` against the intended database. It preserves an activity baseline and expires auth/outbox artifacts.

## Accounts and recovery

Local development allows registration. Production registration stays closed until real verification delivery exists. With a built API and operator `MIGRATION_DATABASE_URL`, privately set `PROVISION_PASSWORD`, then run:

```powershell
pnpm --dir apps/api create-user account@example.test
```

Remove the variable afterward. Keep passwords out of command arguments and logs.

Recovery/verification requests create single-use, 30-minute tokens in an encrypted local outbox. An authorized operator can inspect the latest token with `pnpm --dir apps/api delivery-sink account@example.test`. There is no automatic email/SMS delivery or public sink endpoint.

## Health and deployment

### Resolve Gemini access

Run the operator-only probe from the project root. It reads the selected private environment file and prints only allowlisted status fields. The optional generation sends a short synthetic question, consumes normal provider quota and contains no health data.

```powershell
.\.venv\Scripts\python.exe ai/check_provider.py --generate
.\.venv\Scripts\python.exe ai/check_provider.py --env-file ai/.env --generate
.\.venv\Scripts\python.exe ai/check_provider.py --list-models
docker compose exec ai python check_provider.py --environment --generate
```

Both configuration sources must agree for host and Compose runs. A successful model-access check alone does not prove generation works. The probe exits nonzero on failure and reports the failed stage.

| Probe reason | Operator action |
|---|---|
| `authentication` | Check the copied key, its AI Studio project and bound service account; replace a disabled/revoked or incorrectly copied key locally. New authorization-key formats are supported. |
| `permission` | Confirm Gemini is enabled. Review restrictions and service identity permissions in Google Cloud, plus account and region eligibility. |
| `quota` | Check API quota, credits and billing; wait before retrying. |
| `model_unavailable` | Select an available model supporting generateContent, JSON schema and PDF/image input; update `GEMINI_MODEL`. |
| `configuration` | Check key formatting, model ID and supported parameters. |
| `network` / `timeout` / `unavailable` | Check connectivity or provider status, then retry. |

After a private key/model change, recreate the AI service with `docker compose up -d --no-deps --force-recreate ai`. Verify chat and a synthetic PDF/image through the signed-in app, including the displayed source. Never paste credentials into chat, command arguments, logs or Git. See [Google's key guide](https://ai.google.dev/gemini-api/docs/api-key).

The first 2026-10-25 probe returned HTTP 401 / `ACCESS_TOKEN_TYPE_UNSUPPORTED`. The operator replaced the local key and the root/host configurations were synchronized. Both then passed model access and synthetic structured generation with `gemini-3.1-flash-lite`. The old `gemini-2.5-flash` generation route was unavailable; `gemini-3.8-flash` timed out during bounded probes. Flash Lite is the tested default and supports text, image, PDF and structured output; see its [model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite).

Each generation has a thirty-second provider timeout and one attempt within the API's thirty-five-second timeout. Nginx allows forty seconds; the browser stops waiting after forty-five seconds and offers immediate cancellation. The previous eight-second deadline was rejected by the provider's ten-second minimum; a ten-second probe subsequently timed out. The proxy's former twenty-second timeout also cut off longer valid report reviews. Repeated access failures pause generation for 60 seconds; quota failures for 30 seconds; transient failures for three seconds. A changed credential/model clears the process-local cooldown. There are no automatic paid retries; the user can retry after the displayed delay. Core summaries remain independent of AI. See [Google's retry guidance](https://ai.google.dev/gemini-api/docs/troubleshooting).

Stopping a response or leaving the page cancels the browser request and discards late results. An in-flight provider call may still finish within its deadline and consume quota.

Document preflight uses locked Pillow/pypdf versions in at most two disposable workers. Each has a 256 MiB memory limit and a three-second parsing deadline, with bounded cleanup. Linux uses process limits/groups; Windows uses Job Objects attached before document bytes are sent. Parser workers do not inherit application credentials. Failed validation never falls through to model generation. Large or complex reports may need fewer pages or smaller images. Content checks establish structure and nonblank content, not the truth of an AI summary. See [Pillow's image reference](https://pillow.readthedocs.io/en/stable/reference/Image.html) and [pypdf's extraction limits](https://pypdf.readthedocs.io/en/stable/user/extract-text.html).

### Service health

The normal API entrypoint runs the Google Health due-connection worker independently of browser sessions. Keep the API and database running for automatic imports. `GOOGLE_HEALTH_SYNC_SECONDS` accepts 60–3600 seconds (default 120 plus jitter); due connections are checked every 15 seconds, with up to two concurrent accounts. Database advisory locks prevent duplicate manual/background work across API instances. Persisted exponential backoff and consent-stop errors survive restarts. SIGTERM/SIGINT stop scheduling and abort provider calls. Optional exercise-feed failures do not block recorded steps/distance; per-feed status is available through the owned health review. See [Google Health synchronization](GOOGLE_HEALTH.md#synchronization).

`/health/live` reports API liveness; `/health/ready` checks the database after initialization. Core summaries do not wait for Gemini. Logs use request IDs/error codes. `STALE_SECONDS` defaults to 30 and accepts 10–3600.

External HTTPS is deferred by the user. Before external deployment, configure an HTTPS ingress, `NODE_ENV=production`, the exact HTTPS `WEB_ORIGIN`, managed secrets and restricted DB access. Keep AI, database and internal API ports private. Proxy `/api/` and `/socket.io/` on the same origin, including WebSocket upgrades and the 15 MiB encoded report budget.

The supplied Compose file is a loopback development stack and explicitly sets development mode. Production needs a reviewed deployment override; adding `NODE_ENV=production` to the root `.env` alone does not change that service setting.

Production refresh cookies use Secure, HttpOnly and SameSite=Strict. Cookie mutations also require the accepted origin and client header. Verify the complete browser flow from a second computer before recording the transport gate as passed.

Rehearsal commands are in [testing](TESTING.md); observed results and remaining checks are in [the ledger](audit/STATUS.md).
