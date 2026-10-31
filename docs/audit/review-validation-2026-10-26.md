# Validation of the pasted review — 26 October 2026

Scope: checked the six ranked findings and wellness-score commentary against this checkout, documented behavior, existing tests, and focused reproductions. The original validation made no production-code changes. Subsequent repairs and their separate verification are recorded below. Previously created hardware wiring files were left intact.

## Confirmed findings

### P2 — Cookie-only logout can miss a session during concurrent refresh

Location: `apps/api/src/auth.ts:107`, especially the revocation query at line 121.

The pasted finding is valid only under a narrower condition than claimed: logout has the old refresh cookie **and no usable signed bearer token identifying the session**.

Reproduction using real PostgreSQL and the actual HTTP handlers:

1. Refresh acquires the session row lock and rotates `token_hash`; pause before its transaction commits.
2. Start logout using the original refresh cookie.
3. Let refresh commit. Logout's old hash no longer matches the session.
4. Logout returns 200, but the session remains unrevoked. Both the newly issued access token and rotated refresh cookie remain usable (200).

With a signed expired bearer token, the same interleaving successfully revokes the stable session ID. Reuse of the rotated cookie and access token then both return 401. Rotation does not create a new session row or clear `revoked_at`, so the pasted claim that rotation defeats successful revocation is incorrect.

Impact: cookie-only clients can receive a successful logout response without server-side revocation during this interleaving. The normal frontend includes its bearer token when available; do not describe this as a universal browser logout bypass.

Suggested fix: give cookie-only logout a stable way to identify/revoke the token family across rotation, or explicitly require a verifiable session identifier and reject logout when it cannot revoke the intended session. Preserve expired signed bearer revocation. Add an overlapping refresh/logout integration test; the existing test uses sequential rotation followed by logout.

**Repaired and locally verified (2026-10-26):** refresh rotation stores the immediately previous hash in `sessions.prev_token_hash` (migration `004_session_prev_token.sql`), so cookie-only logout can identify the session across one rotation. The previous cookie remains invalid for refresh. Logout without a usable bearer SID returns 400 for both missing and unmatched cookies, while still clearing the browser cookie. Signed expired-bearer revocation is preserved. PostgreSQL regressions now hold the session row lock, queue refresh followed by logout, confirm both are waiting, and release the lock; the rotated refresh cookie and access token then both return 401. This passes with and without an expired bearer. Each logout regression uses a separate application instance to preserve the real authentication rate limit. Ship the migration with the auth implementation.

### P2 — In-flight AI guidance can overwrite a different device's guidance

Location: `apps/web/src/store/useHealthStore.ts:87`, especially the response assignment at line 90.

This is a related issue discovered while checking finding 4; it is **not** the pasted claim about unlabelled deterministic guidance.

Reproduction using the actual Zustand store and controlled HTTP responses:

1. Start `fetchInsights()` while device A is selected, holding its response pending.
2. Complete `fetchInitialData()` for device B. The store correctly replaces history and uses rule-based guidance with `insightsOffline=true`.
3. Resolve A's pending AI response with `offline=false`.
4. The store still has device B selected, but now contains A's guidance and `insightsOffline=false`.

The response guard checks the authentication epoch, which does not change when devices switch. A device/context revision is absent. Impact: displayed guidance can describe the previous device; a later response can also replace newer rule guidance.

Suggested fix: associate requests/results with a device/context revision, invalidate pending results on source changes, and keep current threshold guidance authoritative. A device ID guard addresses cross-device switches; a context revision also protects changed readings/profile on the same device.

**Repaired and locally verified (2026-10-26):** the initial uncommitted revision-counter patch invalidated AI responses on unchanged summary polls and introduced an unused variable that failed typechecking/lint. It has been replaced with a stable signature of the selected source, readings, daily/latest activity, relevant profile fields, freshness state and active alerts. Responses still require the same authentication epoch. Unchanged polling, heartbeat timestamps and replayed older vitals do not invalidate guidance; changed context does. Store regressions cover the normal concurrent poll, actual A-to-B device switching, changed vitals/activity/profile, live critical readings, live activity before resync and freshness expiry. No visual-design files changed.

## Verdict on each pasted claim

| Claim | Verdict | Evidence |
|---|---|---|
| 1. Alert flapping fails to reset recovery state | Rejected | Both the escalation/repeat path (`telemetry.ts:53`) and ordinary deviation path (`:55`) reset `recovery_count=0`. Observed counters for HR `125,72,125,72,72,72` were `0,1,0,1,2,3`; the last row resolved. |
| 1. Two clean readings must resolve an episode | Incorrect requirement | `docs/FEATURES.md:25` specifies **three consecutive** fresh in-range readings. PostgreSQL evaluates the `CASE` against the old count, so `recovery_count>=2` resolves on the third increment. Alternating deviations and isolated clean readings are supposed to keep an episode active. |
| 1. Concurrent ingests race the partial unique index | Rejected for the reported path | `ingest()` locks the device row before reading episodes (`telemetry.ts:13`). Same-device ingest transactions serialize. The index includes device ID, so different devices do not collide on that key. Sixteen simultaneous same-device ingests all succeeded, leaving one active episode and no uniqueness error. This is evidence for that path, not a claim that arbitrary future writers cannot violate the invariant. |
| 1. Resolving an episode leaves a stale snapshot that suppresses its matching new flag | Rejected | Resolution occurs only when the current input has no matching metric/direction flag. That same input cannot simultaneously recreate that exact metric/direction. The next input re-reads active episodes. |
| 2. Counter reset discards previously accumulated daily steps | Rejected | Same-session counters `100,150,0,20`, delivered in sequence order `1,4,2,3`, produced **170**, retaining the pre-reset 150. A new session with `50,70` raised the combined total to **240**. The query recomputes preceding sequence rows from persisted data on each summary. |
| 2. Current producers reuse boot session IDs | Rejected | ESP32 setup generates a fresh UUID; simulator `run()` generates a UUID on each run. The API contract (`docs/API.md:52`) explicitly requires a new boot UUID. Reusing both session and sequence would collide with the documented deduplication identity; that would be a producer contract violation. Unsampled increments lost before a reboot cannot be reconstructed from cumulative samples alone. |
| 3. AI slot leak / abort holds capacity until the 35-second timeout | Rejected as stated | `app.ts:159` increments only admitted calls. A latch deduplicates release, and the close handler immediately aborts and releases the slot. Existing capacity tests passed. Cancellation of the API's outbound request does not establish cancellation of synchronous work already running in the Python service. |
| 3. Shared capacity permits one user to occupy all three slots | Real design tradeoff | The gate is shared within the application instance, in addition to the per-user request rate limit. Three pending requests can temporarily block other users. This is an explicit concurrency bound, not evidence of faulty accounting. Per-user concurrency or fair scheduling would be a product/availability improvement. `Retry-After: 5` is a retry interval, not a reservation guaranteeing acceptance after five seconds. |
| 4. History replacement on device switch is data loss | Rejected | `docs/FEATURES.md:7` says switching sources replaces the live window and daily activity. REST history is scoped to the selected source. Persisted database history is not deleted. Existing source-switch integration/store tests passed. |
| 4. Rule guidance is shown without source indication | Rejected | The summary assignment explicitly sets `insightsOffline=true` (`useHealthStore.ts:79`). Dashboard (`Dashboard.tsx:37`) and Wellness (`Wellness.tsx:25`) render **Rule-based guidance** versus **AI guidance**. A source-switch probe confirmed this flag. The different pending-response race above is real. |
| 5. Concurrent refresh rotation is single-use | Consistent with implementation | Refresh locks and rotates the same session row. Existing integration coverage rejects reuse of the old cookie after rotation. No refresh-rotation implementation defect was established. |
| 5. Refresh can undo logout revocation despite a usable bearer SID | Rejected | Forced overlapping transactions with an expired signed bearer left the session revoked and both credentials unusable (401). The cookie-only variant is confirmed above. |
| 6. Follower timeout causes a five-minute deterministic downgrade | Rejected | A timed-out follower returns `offline=true` and **does not write a fallback cache entry**. After simulating the leader's cache write for the same key, the next call immediately returned its AI result. A 30-second time bucket is also part of the cache signature (`ai/main.py:48`). |
| 6. The provider call is unbounded | Incorrect description | `ai/services/gemini.py:83` configures a 30,000 ms HTTP timeout and one attempt. This is not proof of an absolute 30-second wall-clock deadline across all local processing, but it contradicts the claim that there is no timeout. Returning explicit fallback after a bounded follower wait is a deliberate availability behavior; extending it requires revisiting the 35-second API budget. |
| Wellness score caps raise/contradict deduction totals | Rejected / design choice | `Math.min(score,60/80)` can only lower or preserve a score. Different penalty bands and alert thresholds are heuristic design choices. No numerical defect was established. No clinical validity assessment was performed. |

## Original verification before repair

- API unit/contract/boundary tests: **21 passed**.
- API integration tests against a newly created disposable local PostgreSQL database: **19 passed**.
- Existing frontend store tests: **15 passed**.
- AI endpoint/provider tests: **104 passed**, with provider calls mocked or disabled by the tests.
- Additional frontend probes: **2 passed**. One confirms correct source labelling; the other intentionally reproduces the stale-device response bug. These probe assertions describe observed buggy behavior, not a desired regression contract.
- Additional real PostgreSQL probes: flapping recovery, 16 concurrent ingests, out-of-order cumulative resets, session changes, and overlapping logout/refresh with and without a bearer SID.
- Additional AI control-flow probe: forced follower timeout, no cached fallback, immediate reuse of a simulated late leader result. The wait was simulated; no real 31-second provider stall or external AI request was performed.

Total existing tests: **159 passed**. The probes establish the concrete interleavings above, not exhaustive concurrency coverage. No production database or application service was used. The disposable PostgreSQL instance was stopped after verification.

Local reproduction/evidence files are under `.audit-runtime/`: `validate-pasted-review.cjs`, `pasted-review-database-evidence.json`, `validate-pasted-review-ai.py`, `pasted-review-ai-evidence.json`, and `pasted-review.probe.test.ts.txt`. The archived frontend probe belongs at `apps/web/src/store/pasted-review.probe.test.ts` when running it with the current Vitest config; it was removed from the source tree after verification.

The confirmed findings above were subsequently repaired. The original counts and probes in this section describe the pre-repair review, not verification of the new code. Do not implement the pasted alert or activity fixes without a separate failing example; their proposed premises do not hold for this checkout.

## Repair verification — 26 October 2026

The supported Node 24.22.1 launcher and Python 3.12.10 environment passed `pnpm verify`: project/reference checks, types, lint, API/frontend tests, builds and Python tests/lint.

- API: **44 passed**, including **23 real PostgreSQL integration tests**; none skipped.
- Frontend: **29 passed**, including the guidance-context regressions above.
- Python: **139 passed**. Provider calls in these tests are mocked or disabled; this is not new live-provider evaluation.
- Browser: **17 passed** against the separate disposable browser database. Existing tests covered all eleven signed-in pages at 320/390/768/1440 px, navigation/focus, reduced motion, automated accessibility, session/profile/SOS/history flows and Assistant boundaries.
- The existing Starlette/httpx deprecation warning remains; it did not fail verification.

Total after repair: **229 software/browser tests passed**. No CSS, page components, shared layout components, icons or visual assets changed. Hosted CI and physical/manual checks were not rerun.

Integration used a newly created `review_fix_integration_test` database in the dedicated `.audit-runtime/review-validation-pg` cluster, bound to loopback port 15439. Browser tests use a separate `review_fix_browser_test` database in that cluster. The normal Compose database, services and unrelated projects were not changed. Logs are ignored under `artifacts/pending-fixes-2026-10-26-*.log`.

Hardware, external HTTPS, qualified AI review and manual screen-reader evidence retain their existing open status. These repairs remain uncommitted pending review.
