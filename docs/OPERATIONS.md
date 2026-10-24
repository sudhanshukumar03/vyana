# Operations

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

`/health/live` reports API liveness; `/health/ready` checks the database after initialization. Core summaries do not wait for Gemini. Logs use request IDs/error codes. `STALE_SECONDS` defaults to 30 and accepts 10–3600.

External HTTPS is deferred by the user. Before external deployment, configure an HTTPS ingress, `NODE_ENV=production`, the exact HTTPS `WEB_ORIGIN`, managed secrets and restricted DB access. Keep AI, database and internal API ports private. Proxy `/api/` and `/socket.io/` on the same origin, including WebSocket upgrades and the 15 MiB encoded report budget.

Production refresh cookies use Secure, HttpOnly and SameSite=Strict. Cookie mutations also require the accepted origin and client header. Verify the complete browser flow from a second computer before recording the transport gate as passed.

Rehearsal commands are in [testing](TESTING.md); observed results and remaining checks are in [the ledger](audit/STATUS.md).
