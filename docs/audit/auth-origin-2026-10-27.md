# Development auth origin repair - 27 October 2026

The user reported that sign-in and registration at `http://localhost:5173` both returned `Origin not allowed` after `pnpm run dev`.

The failure was reproduced through Vite: the host API on port 8000 accepted `http://localhost:18082` and rejected `http://localhost:5173`, although `apps/api/.env` already specified 5173. The Compose stack on 18082 was independently healthy; its configuration check did not cover the host development process. The previous hardware changes did not modify authentication. The earlier uncommitted session changes addressed refresh/logout concurrency, not origin configuration.

The [API environment loader](../../apps/api/src/environment.ts) now resolves the service's `.env` relative to the API module and lets it override inherited values only under the local development watcher, outside production. The [entry point](../../apps/api/src/index.ts) uses this loader. Regular deployment environment precedence and the exact-origin check remain in place. The running watcher reloaded the repair.

Verification:

- Four new environment regression tests cover inherited Compose origin, sign-in/registration routing, rejection of an untrusted origin, deployment precedence, and absent local files. Together with the existing API unit/contract suites, **25 tests passed**; the 23 disposable-database integration tests were skipped in this run.
- API TypeScript checking passed.
- Live requests through `http://localhost:5173/api/v1` passed registration (201), identity (200), initial logout (200), login (200), refresh (200), refreshed identity (200), logout (200), and rejection of refresh after logout (401). The temporary verification account and its sessions were removed afterward.
- An untrusted Origin continued to return 403. No account credential or signing-secret changes were needed.

The request flow was exercised through the live Vite proxy and PostgreSQL-backed API. Browser UI automation and the full disposable-database integration suite were not rerun for this configuration repair.
