# Audit remediation plan

The goal is a reproducible, tested prototype with owned data, authenticated telemetry, reliable alerts/history, explicit data states and recoverable operations. Cover all **F01–F36 and A01–A11**; use the [audit](2026-10-24.md) for the baseline and [status](STATUS.md) for results.

This condensed plan retains the original phase weights, regression cases and completion requirements. Weights describe the original remediation scope, not a measured percentage of the entire project. A repair is complete only when its behavior and required evidence agree.

## Delivery phases

| Phase | Deliverable | Depends on | Original weight |
|---|---|---|---:|
| 1 | Reproducible foundation and baseline | Current working tree | 12% |
| 2 | Data ownership, migrations, and contracts | 1 | 15% |
| 3 | Authentication, authorization, and deployment boundaries | 2 | 15% |
| 4 | Telemetry integrity and alert lifecycle | 2–3 | 13% |
| 5 | Correct frontend state, freshness, and recovery | 3–4 | 12% |
| 6 | Reliable AI, reports, and safety evaluation | 2–5 | 10% |
| 7 | Recoverable hardware and simulator transport | 3–4 | 7% |
| 8 | Accessible UI, reachable ECG, and measured performance | 5–7 | 6% |
| 9 | Full CI, operational checks, and failure testing | All prior phases | 6% |
| 10 | Documentation, release rehearsal, and closure review | 9 | 4% |

## Completion requirements

1. **Foundation:** fresh frozen/hash installs, importable Python package, startup without a model key, built containers and reconciled dependency scans. No known high/critical issue is left without a reviewed disposition.
2. **Data:** checksum migrations succeed on fresh and legacy copies before readiness. Preserve originals, restrict unmapped records, require explicit ownership/timezone import, validate storage-compatible inputs and preserve omitted profile fields.
3. **Access:** reject forged/expired/revoked identities and cross-owner HTTP/socket/device/AI access. Exercise rotation, reset, revocation, origin/rate boundaries and restricted roles. Prove external HTTPS from a second computer before deployment sign-off.
4. **Telemetry:** deduplicate acquisition-time envelopes transactionally. Escalation bypasses warning cooldown; failed writes and concurrent retries leave correct episode state. Recovery, SOS and day/reset/source boundaries have regression coverage.
5. **UI:** preserve chronology and bounded live windows, recover snapshots, clear prior-account state during races and show missing/stale/error states accurately.
6. **AI:** isolate owner/context caches, bound/coalesce work, validate outputs and exercise report limits through every proxy layer. Record controlled live prompt-override evaluation with human review before claiming the provider gate.
7. **Producers:** compile and test retry/acknowledgement/overflow policies, then record physical heap, queue, clock, reboot and reconnect evidence. Host tests alone cannot close the bench gate.
8. **Interface:** verify keyboard/focus, mobile layouts, reduced motion, synthetic ECG labeling and manual screen-reader behavior. Measure entry/chunk sizes after route splitting.
9. **Operations:** run hosted CI, a 30-minute representative load, DB/AI failure recovery, retention, backup/restore and compatible rollback rehearsals. Reconcile acknowledged records and check owner isolation.
10. **Handoff:** keep concise guides aligned with runnable code. Record each finding's evidence and every unresolved gate; do not substitute a score or percentage for missing verification.

The original local/staging budgets are core-summary p95 ≤500 ms and ingest-to-UI p95 ≤1 second on a documented machine with representative 30-day data. Record hardware, load and query plans; explain any budget change.

## Required regression cases

| ID | Trigger | Required result | Evidence |
|---|---|---|---|
| R01 | Fresh install and no-key startup | All services install/start; no hidden host dependencies; AI falls back explicitly | Clean environment + containers |
| R02 | Existing shared DB upgrade | Data preserved; unassigned records stay private; owner mapping is explicit | Disposable migration/restore rehearsal |
| R03 | User A requests/subscribes to B | No B records, events, cached insight, historical tool result, or contact data | HTTP + DB + sockets + AI contracts |
| R04 | Missing/forged/expired/revoked identity | Request/connection rejected; missing signing secret prevents startup | Auth integration |
| R05 | Device key revoked or owner spoofed | No write, alert, cooldown mutation, or delivery to another owner | Device/API integration |
| R06 | HR 125 → 165 inside cooldown | Immediate critical transition; sustained repeats deduplicate | Alert/DB integration |
| R07 | Recovery, recurrence, write failure, concurrent ingest | Correct episode state; retries allowed; no lost critical event or duplicate episode | Transaction/concurrency tests |
| R08 | SOS followed by many warnings, then reload | Critical SOS remains active/visible until explicit resolution | API + browser |
| R09 | No data, stale values, fever, missing ECG/device | Unknown/stale states; no fabricated stable/normal/connected/score assertion | Rule tests + browser |
| R10 | History 1–20, then 21 and replayed/out-of-order events | Correct ordered newest window; history pagination retains older records | Store + browser |
| R11 | Disconnect, missed events, reconnect | Authoritative resync recovers readings/alerts once | Socket + browser |
| R12 | Logout or account switch during slow requests | No prior-user data after session change | Store + browser |
| R13 | Profile edit changes only height/goal | Medications/allergies preserved; BMI/category and AI context refresh correctly | API + contract + browser |
| R14 | AI profile/owner/freshness changes and concurrent identical calls | Correct cache invalidation/isolation; bounded coalesced calls | AI unit/integration |
| R15 | Malformed model shapes, timeouts, quota errors | Validated fallback and explicit offline state; no app crash | Mocked AI failure tests |
| R16 | 10 MiB and 10 MiB + 1 byte; corrupted base64/MIME | Boundary success/failure through all layers; rejection before model work | Proxy/API/AI integration |
| R17 | Prompt override embedded in profile/history/report | Boundary checks hold; evaluation records unsafe generations as failures | Deterministic policy + controlled live evaluation |
| R18 | Firmware network loss and HTTP 429/500; queue full | Bounded retries/queue; no false acknowledgement; observable loss policy | Host tests + physical bench |
| R19 | Counter reset/midnight/timezone/source change | Correct per-day deltas without duplicate snapshots/totals | Ingestion/aggregation fixtures |
| R20 | Keyboard, screen reader, reduced motion, small viewport | Critical flows usable; state changes announced; synthetic ECG clear | Accessibility automation + manual browser evidence |
| R21 | DB/AI restart under load and retention | Controlled failure/recovery, bounded resources, correct readiness, preserved acknowledged records | Staging soak/fault injection |
| R22 | Backup/restore and release rollback | Usable version restored, records/ownership preserved | Disposable release rehearsal |

## Remaining work

The [status ledger](STATUS.md#remaining-checks) is the current checklist. Hardware and external HTTPS are deferred by the user. Hosted CI is waiting for a reviewed public push; provider and manual accessibility checks require their own evidence. The 25 October cleanup is local and does not authorize publication.
