# Audit status

The local remediation is substantially complete. Release checks remain open below. This ledger records observed evidence; it does not establish clinical suitability.

The [audit](2026-10-24.md) is the historical baseline. The [plan](PLAN.md) defines completion. Detailed dated metadata is in [evidence-2026-10-24.json](evidence-2026-10-24.json); its source hashes refer to that snapshot, before the 25 October cleanup.

## Current local configuration — 25 October

**Configured and verified for local development/demo use.** The normal `vyana-local` Compose stack is healthy at **http://localhost:18082**; API and database host ports are 18002 and 55435. AI stays private. `python scripts/check_config.py --services` passes. The prior environment files are backed up privately, and the original database volume and unrelated projects remain untouched.

The original configuration checkpoint passed **104 tests**: 39 API, 16 frontend, 39 Python, seven browser and three native firmware tests. Types/lint/build, ESP32 compilation, frozen JS installation, a fresh hash-locked `.venv`, `pip check` and zero-advisory JS/Python runtime scans also passed. Both Docker and host API/AI/Vite startup/login/session flows were exercised. The Windows Node launcher selects 24.22.1 while preserving the older global installation. The AI follow-up below records the newer test counts.

The regular configuration now has aligned service secrets, separate runtime/migration database roles, encoded passwords and dedicated loopback ports. Setup preserves existing credentials and rejects conflicts. Startup rejects malformed deployment settings. Migration checks accept identical LF/CRLF SQL while still rejecting changed checksums. Compose explicitly receives model/freshness settings, and Docker contexts exclude private settings and tool caches.

The actual simulator, two-account socket isolation, replay, warning-to-critical escalation, recovery, SOS, profile preservation and all eleven pages passed smoke checks. Actual AI/database stop/start recovered without an API restart; a custom-format backup restored with matching record counts. Unavailable scores now use a neutral dash. Demo login details are in the ignored local `.audit-runtime/local-demo.json`; `simulator/.env` is configured for that synthetic account. Run `.venv/Scripts/python.exe simulator/main.py` to produce new readings.

The final source export passed Gitleaks. Four exact synthetic configuration-test values have path-scoped exceptions; an unexpected credential in the same test path was correctly rejected. Private environments, backups and demo credentials are excluded from the review snapshot.

See the [configuration evidence](configuration-2026-10-25.json). Production sign-off still needs the release checks below; local success does not close them.

## AI implementation follow-up — 25 October

Live Gemini access is working with the operator's updated private credential and `gemini-3.1-flash-lite`. The root/host environments were synchronized. Provider diagnostics now distinguish authentication, permissions, quota, model availability, network, timeout and invalid output without exposing credentials or raw provider messages.

Chat uses a direct answer plus useful supporting sections and honors explicit brevity requests. The UI labels Gemini, rules and fallback responses. Report review receives account-scoped context, keeps document findings separate from device data and dates, and offers questions to ask a clinician. Birth dates become age context before generation; unknown age is distinct from under 20. Stale/incomplete vitals cannot become current measurements. Uploads and failed replies stay out of later chat context.

The updated checks pass **175 software/browser tests**: 40 API, 20 frontend, 105 Python and ten browser. Types, lint, builds and `pip check` passed. Thirteen finite live synthetic cases covered missing/stale/simulated data, age limits, an injected profile instruction, restricted medical requests, urgent symptoms and PDF/PNG/JPEG review. Wording review led to fixes for unknown-age assumptions, invented Bluetooth controls and duplicated/misdirected report questions. Insights, chat and report review share the same age-only context handling.

The actual local app returned Gemini chat and synthetic PDF review, with successful login/refresh/logout checks. At 320/390/768/1440 px the composer had no horizontal overflow and all its controls met the 44 px minimum. Cancellation, duplicate submission, escaped text rendering, reduced motion and automated accessibility checks passed. An initial empty-session refresh correctly returned 401; there were no unhandled page errors. Timeout budgets now increase through provider/API/proxy/browser at 30/35/40/45 seconds. The former nginx limit cut off valid longer reviews and has been corrected.

The [AI evidence record](ai-implementation-2026-10-25.json) separates this finite evaluation from broader qualified human review. It does not establish clinical validation.

## Earlier GitHub publication — 25 October

The reviewed changes are on the [audit branch](https://github.com/sudhanshukumar03/vyana/tree/codex/audit-cleanup-2026-10-25); `main` remains unchanged. [Hosted CI](https://github.com/sudhanshukumar03/vyana/actions/runs/40168534380) passed at `3e9282b`: software/PostgreSQL/browser checks, firmware compile/native tests and the secret scan all succeeded. The initial run exposed incorrect PostgreSQL health-command quoting; the follow-up commit corrected it.

## Recorded verification — 24 October

| Evidence | Observed result |
|---|---|
| E1: software suite | Node 24.22.1, frozen pnpm and fresh hash-locked Python; types/lint/build passed; 28 API + 16 frontend + 29 Python tests passed |
| E2: browser | Seven Chromium tests passed: 320/390/768/1440 px, keyboard/modal, profile, SOS/logout, reduced motion, axe, pagination and source switching |
| E3: firmware | ESP32 compile passed; three native transport tests passed; static RAM 85,504/327,680 bytes, flash 1,220,431/1,310,720 bytes |
| E4: dependencies/secrets | JS graph and Python runtime scans reported zero known advisories; exported source passed Gitleaks with narrow reviewed non-secret exceptions; an unexpected-key sentinel was rejected |
| E5: data operations | PostgreSQL 16.15/18.4 migration, legacy quarantine/import, ownership, restricted role, backup/restore, retention baseline and failed-startup checks passed |
| E6: load | 30 minutes, 10 devices/20 clients; 518,400 vitals + 518,400 activity seeded; 10,800 successful ingests, 300 duplicate replays, zero errors/leaks; acknowledged records reconciled |
| E7: fault recovery | Actual DB/AI stop/start passed; liveness, JSON 503s, retryable socket auth, logout cookie clearing and pool recovery worked without an API restart |
| E8: containers/proxy | Final API/web/AI images built from locks and all four services became healthy; nginx CSP/socket/viewport checks passed; 10 MiB report accepted, +1 byte returned 413, MIME mismatch returned 400 |
| E9: real simulator | Eight owned vitals + eight activity records, heartbeat, consistent session and increasing counters passed |
| Provider smoke | Gemini returned 401 for the configured key; no successful live-generation result is claimed |

E1 includes real database/HTTP/socket tests, not only mocks. API lint is a TypeScript check. Python tests emit an upstream Starlette/httpx deprecation warning.

E6 ran on Windows, Intel Core i5-12500H, about 16 GiB RAM, PostgreSQL 18.4 and Node 24.14.0. Each client requested summary/history/activity/alerts in parallel every five seconds. The complete four-endpoint snapshot p95 was **350.28 ms**, and socket delivery p95 was **125 ms**, over 7,200 snapshots and 7,194 non-durable deliveries. REST provides stream recovery. These measurements exclude failed resource-pressure attempts.

Node was subsequently upgraded to 24.22.1; E1 and E8 passed on that patched runtime. E6 was not repeated on it. Entry JS fell from about 781 kB to 364 kB minified; charts moved to a deferred roughly 384 kB chunk.

Local outputs and synthetic backups are ignored under `artifacts/`. Existing user databases were not upgraded, reassigned or deleted in these rehearsals.

## Finding closure

“Verified” means the reported software defect has supporting evidence. A pending release check still needs the named environment/manual evidence.

| ID | Repair and evidence | Status |
|---|---|---|
| F01 | Required distinct secrets; expiring session-bound JWTs; forgery/expiry/revocation tests (E1) | Verified |
| F02 | Owner-scoped data/context and restricted legacy records; two-account and import/restore tests (E1/E5) | Verified |
| F03 | Authenticated owner/session socket rooms and revocation (E1/E2) | Verified |
| F04 | Transactional episodes, immediate critical escalation, failed-write rollback/concurrent replay (E1) | Verified |
| F05 | Complete Python metadata, hashed locks, wheel and non-root image (E1/E8) | Verified |
| F06 | Obsolete orchestrator import removed; package imports/tests run (E1) | Verified |
| F07 | Missing/stale data cannot fabricate normal status or score (E1/E2) | Verified |
| F08 | Reconciled JS/Python locks and advisory scans (E4) | Verified at scan date |
| F09 | Hashed per-device credentials, ownership and revocation tests (E1/E9) | Verified |
| F10 | Same-origin API/socket and nginx proxy (E2/E8) | External HTTPS pending |
| F11 | Consistent ports/templates and idempotent secret setup (E1/E8) | Verified |
| F12 | Pinned tools, frozen JS and hashed Python installs (E1/E8) | Verified |
| F13 | Async boundaries, sanitized JSON failures and DB recovery (E1/E7) | Verified |
| F14 | Locked checksum migrations before listening; startup failure tests (E1/E5) | Verified |
| F15 | Sorted/deduplicated live window and composite-cursor pages, including 105 equal-time records (E1/E2) | Verified |
| F16 | Activity/summary resync, profile refresh and active-source replacement (E1/E2) | Verified |
| F17 | Heartbeat expiry, freshness and nullable scores/unknown device states (E1/E2) | Verified |
| F18 | Memory bearer, rotating sessions, cancellation and complete logout reset (E1/E2) | Verified |
| F19 | Persistent owned alerts, critical ordering and acknowledgement/resolution (E1/E2) | Verified |
| F20 | Owner/material-context cache isolation, invalidation and coalescing (E1) | Verified |
| F21 | Bounded validated AI request/output shapes and malformed-output fallbacks (E1) | Verified |
| F22 | Encoded/decoded report budgets, strict encoding/signature checks and capacity limits (E1/E8) | Verified |
| F23 | Storage-compatible numbers, dates, IDs, text and enums (E1) | Verified |
| F24 | Transactional profile merge preserves omitted notes; null clears optional fields (E1/E2) | Verified |
| F25 | Acquisition/receipt UTC and producer replay identity (E1/E5/E9) | Software verified; physical clock/replay pending |
| F26 | 2xx-only acknowledgement and explicit retry/error classes (E3) | Physical HTTP/network bench pending |
| F27 | Bounded firmware/simulator queues, overflow tests and static memory (E3/E9) | Physical heap/reconnect duration pending |
| F28 | Bounded SQL aggregation/indexes/pool; dense load, plans and retention (E5/E6) | Verified for recorded workload |
| F29 | Root checks and populated software/browser/firmware CI (E1–E3) | Hosted CI verified |
| F30 | Shared wire contracts, strict API types and lint/schema checks (E1) | Verified |
| F31 | Modal focus containment/restore, inert background, Escape and mobile scrolling (E2) | Manual screen-reader check pending |
| F32 | Reachable labeled synthetic ECG with pause, stale and reduced-motion behavior (E1/E2) | Verified as illustration |
| F33 | Lazy routes/deferred charts and bounded live history (E1) | Verified |
| F34 | Current guides and successful local install/upgrade/container rehearsals (E1/E5/E8) | Verified locally; cleanup recorded below |
| F35 | Consistent status rules, live feedback, form types and motion/focus behavior (E1/E2) | Automated checks passed; manual AT pending |
| F36 | BMI classification before rounding; age boundary (E1) | Verified |

## Follow-up closure

| ID | Repair and evidence | Status |
|---|---|---|
| A01 | Session-aware daily deltas, old baseline and timezone/reset fixtures (E1/E5) | Verified |
| A02 | Authenticated activity/heartbeat and explicit simulated source (E3/E9) | Software verified; physical producer pending |
| A03 | Auth lifecycle, encrypted operator sink, rate/concurrency bounds and closed production signup (E1) | Verified for closed prototype |
| A04 | Random local secrets, loopback/private services, restricted role and TLS configuration (E1/E5/E8) | Local verified; external TLS pending |
| A05 | Structured roles, schemas, decoded scope checks, age rules and finite live evaluation | Live access verified; broader qualified human review pending |
| A06 | Honest Reports/Settings copy; Assistant upload remains discoverable (E1/E2) | Verified product boundary |
| A07 | Status-aware chat/report/SOS/profile/contact errors and retry feedback (E1/E2) | Verified |
| A08 | UTC storage, explicit legacy timezone and IANA profile timezone (E1/E5) | Verified |
| A09 | Generated bytecode/package metadata removed from tracking | Verified |
| A10 | Obsolete root move script removed; versioned migrations documented | Verified |
| A11 | Tool pins, aggregate checks and locked installs (E1/E8) | Local and hosted CI verified |

## Remaining checks

| Check | Next evidence / owner | Current state |
|---|---|---|
| AI review | Qualified reviewer: broader adversarial and clinical-scope evaluation | Live access and 13 synthetic cases verified; comprehensive safety/clinical suitability unestablished |
| Physical ESP32 | Hardware owner: clock, sensor absence, queue/retry/heap, reboot and reconnect bench | Deferred by user; components unavailable |
| External HTTPS | Deployment owner: hostname/certificate, private routing, secure cookies and second-computer HTTP/socket test | Deferred by user |
| Manual accessibility | Reviewer: real screen-reader announcements, focus restoration and mobile navigation | Keyboard/axe/reduced-motion automation passed |

Repeat recovery/load checks on an intended deployment if its topology differs from the local rehearsal. Do not count deferred checks as passed.

The following entries record local work completed before GitHub publication.

## Cleanup — 25 October

Unused source/assets and overlapping documentation were removed after a reference review. Active routes, the Vyana brand mark, versioned migrations, tests and dated machine evidence are retained. Current guides now have a [single index](../README.md); audit history stays in this folder.

After cleanup, all 83 tests passed (28 API, 16 frontend, 29 Python, seven browser and three native firmware), along with types/lint/build, the ESP32 compile, frozen install, reference checks and the source secret scan. The final JS dependency scan reported zero known advisories. An initial axe analysis-page timeout passed in isolation and on the final complete browser run.

The original documents and removed drafts/assets are preserved in an ignored local backup. [The cleanup record](cleanup-2026-10-25.json) lists removal totals and verification. This cleanup does not authorize a public push. Commit `69c2f52` is the earlier review snapshot and does not include these changes.

## Second review — 25 October

The follow-up review found garbled characters on 14 lines in Assistant, Emergency and onboarding, plus misleading loading punctuation, outdated Settings/Reports wording and an upload limit labeled MB instead of MiB. These are corrected. The API guide now states the rolling refresh expiry and the client-header requirement for both refresh and logout.

The source encoding check now covers project code as well as docs and excludes generated dependencies. It rejected the original corrupted Assistant source in a negative check. Frontend types/lint/build, all 16 frontend tests and all seven browser tests passed again. The 68 local links, 47 finding IDs, 22 regression cases, removal list, backup integrity and unchanged historical JSON evidence also passed review. No additional unused source or image was identified. Nothing was pushed.
