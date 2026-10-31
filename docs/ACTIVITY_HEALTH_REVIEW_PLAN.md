# Weight management and activity health review plan

Status: core software implemented on 2026-10-30. Automatic imports, optional provider-reported exercise, weekly reviews, recurring periods, timestamp matches, adult maintenance energy, structured goals and dated weight history are available. No daily questionnaire is included. Goal-specific calorie prescriptions, weight projections, goal-review dates and clinically reviewed automatic goal selection remain future work; the sections below retain the design policy for those later milestones.

## Intended result

Deliver automatic activity collection and an age- and lifestyle-aware weight-management review as the two foundations, followed by movement consistency, personal trends and readings recorded during activity. Build the data foundation first; the primary weight calculations remain BMI/reference range, selected goal and estimated maintenance energy. Pair measured observations with short educational explanations. Preserve the compact Activity design and existing timestamp access.

## Automatic activity recognition

### Collect without requiring the Activity page to be open

The phone or tracker records movement and uploads it to Google Health. While the Vyana backend is running, a server-side worker should refresh linked accounts at a bounded configurable interval, respecting provider limits, existing cooldowns and per-account locks. The current open-page sync remains a convenience rather than the only trigger. Closing the browser must not stop server-side import. A stopped local backend cannot collect cloud updates until it starts again.

Initial scheduling choice: a configurable two-minute target interval, with jitter and a global concurrency limit, without promising two-minute source uploads. Attach the worker to the normal API start/stop lifecycle. Manual sync and background sync must share a database-backed lease or advisory lock; the current in-process promise map and sixty-second attempt timestamp alone do not provide a cross-process job lease. Persist next-attempt/backoff state and record sanitized job outcomes so restarts do not create retry storms. Expired/revoked credentials require the existing reconnect flow, not repeated failed requests.

Backfill the required history once, then refresh a recent overlapping window during ordinary polls and periodically reconcile older history for corrections. Upsert/replace only windows that were actually fetched successfully. Do not repeatedly download fifteen days every two minutes or clear older cache rows during an incremental refresh. Preserve per-feed last attempt, last successful import and warning metadata; retained values must not acquire a false fresh timestamp when another metric succeeds. Recompute the review only when its source data or relevant profile changes.

Process new or corrected provider records idempotently and rebuild affected summaries. Retry transient failures with backoff, preserve prior data with a freshness warning, and stop work after disconnection or consent loss. No user should have to confirm walking or complete a form before activity appears.

### Identify movement and exercise type

- Use original step intervals to find recorded movement automatically. Calculate interval-average steps per minute only when the interval has sufficient temporal resolution; do not infer continuous cadence or running from an hourly/day total.
- Preserve light, moderate and vigorous minute counts separately as source-reported intensity. Vigorous minutes or a high heart-rate reading alone do not establish running.
- Import optional Google `exercise` sessions for provider-reported types such as WALKING and RUNNING, start/end times and available duration/pace metrics. Respect the exercise endpoint's separate page-size limit and bounded pagination; an exercise-feed failure must not stop the existing four metric feeds.
- Prefer a source-reported exercise type. Display its provenance. If there is no suitable type record, show recorded movement or a higher recorded step rate with an estimate/quality label; do not claim confirmed running from a universal cadence threshold.
- Describe exercise types as provider-reported, not independently confirmed or necessarily auto-detected by the phone. Preserve manual/automatic origin when the provider supplies it, and leave origin unknown otherwise. Cadence can be displayed as an interval-average value; any proposed categorical step-rate threshold needs validation before release.
- Merge overlapping evidence without adding exercise-summary calories/steps on top of the reconciled daily totals. Preserve corrections, source timestamps and uncertainty.

Google documents [exercise session types and timestamps](https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints#Exercise) and [supported operations, permissions and upload behavior](https://developers.google.com/health/data-types). Access to exercise data uses the existing read-only activity scope, but availability depends on the connected source. Automatic recognition inside Vyana does not guarantee that every phone/tracker supplies a running classification.

### Learn recurring active periods

Build frequency-by-local-time summaries across comparable recorded days. Show the number of observed days supporting each period, alongside activity amounts and source availability. For example, "Activity was recorded between 18:00 and 19:00 on 4 of 6 recorded days." This is illustrative wording, not a finding about this account.

Use a sustained history before describing a usual routine; one busy hour on one day is not a recurring pattern. Missing records do not count as inactivity. Handle timezone changes and daylight-saving transitions explicitly. Retain the existing busiest-recorded-period summary for dates with limited history.

### Update health context automatically

When new records arrive, refresh movement summaries, matched sensor observations and the structured review without manual check-ins. Match heart-rate observation times to activity intervals, but do not infer a cause or exercise clearance. Sustained activity patterns can inform a review of the estimated lifestyle category; one burst or a missing upload must not change food targets automatically.

Always distinguish when activity was recorded from when it was imported. Google synchronization can be delayed, so show dated recent activity and stale/unknown states rather than claiming the person is running now from an old session. Initial profile setup and optional weight updates remain separate from activity detection; neither requires a daily questionnaire.

## Weight-management workflow: implement first

### A. Profile and eligibility

Reuse date of birth, height, current weight, activity level, conditions and medications. Add the measurement date, a structured goal (maintain, reduce or gain), optional target weight and goal-review date. Collect the model-required sex input explicitly; do not infer it from a name or invent a value when the available profile category is unsupported. Use a one-time eligibility screen for pregnancy/breastfeeding and relevant clinician-managed conditions. This is profile setup, not a daily check-in.

Keep the first automatic adult planning path at age 20 and above, consistent with the existing adult-BMI boundary. Unknown ages and users under 20 do not receive adult weight targets or calorie-restriction plans. Pregnancy/breastfeeding, underweight, frailty/unintentional weight loss, relevant medical conditions or medication concerns route to an individual professional review rather than an automatic deficit. Older age is considered in energy estimation and suitability; it does not create a fabricated age-specific adult BMI cutoff. Missing heart-rate data does not block an otherwise eligible maintenance estimate.

### B. BMI, reference range and personal goal

Calculate BMI first: weight_kg / height_m squared. Show it as a screening measure with its existing adult interpretation. Derive an adult BMI-based reference weight range from height, clearly labelled as a reference rather than one optimal weight. Use unrounded BMI for category boundaries; round only the display. Do not select a universal midpoint as an ideal weight or infer a person's body composition from BMI.

Select a goal with the user, considering current weight, age, lifestyle, relevant health context and any clinician-provided target. The algorithm validates the goal and explains its assumptions; it cannot establish a unique medically optimal weight. Do not automatically recommend weight loss solely from a BMI category. An eligible weight-loss path should favour a gradual initial goal and review date over an immediate distant target; any automatic goal-setting policy needs clinical review before release.

Source: [CDC BMI interpretation](https://www.cdc.gov/bmi/faq/index.html). For gradual initial goals, see [NIDDK weight-management guidance](https://www.niddk.nih.gov/health-information/weight-management/choosing-a-safe-successful-weight-loss-program).

### C. Estimated maintenance calories

Use the published **2023 Dietary Reference Intakes Estimated Energy Requirement (EER)** equations as the initial maintenance-energy algorithm. They use age, the model's sex category, height, current weight and physical activity category. Implement the exact adult coefficients and units from the primary table, with model/version metadata and reference-case tests. Do not combine this method with a second resting-energy formula or extra arbitrary activity multipliers.

Use the existing profile lifestyle category as the initial estimate and review it against sustained automatically imported activity. Do not require daily lifestyle confirmation. Phone steps alone cannot identify the entire daily physical-activity level. An uncertain category should produce a clearly labelled estimate/range or request one-time profile clarification, not silently become sedentary. Check mappings from Vyana's existing sedentary/light/moderate/active labels to the model's inactive/low-active/active/very-active definitions rather than mapping by label alone.

Sources: [National Academies 2023 model summary](https://www.nationalacademies.org/read/26818/chapter/2), [published energy equations and activity definitions](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html), and [USDA calculator](https://www.nal.usda.gov/human-nutrition-and-food-safety/dri-calculator).

### D. Goal-specific intake and weight progress

Keep three distinct values in the UI: estimated maintenance energy, an eligible goal-specific intake estimate, and Google-reported active calories. Do not add all active calories onto an activity-adjusted EER; that would count activity twice. Do not subtract active calories from food intake and call the result a full daily energy balance.

Maintenance is the first calculation to release. A restriction/surplus recommendation needs a separately reviewed policy for appropriate goals, pace, nutrition adequacy and exclusions; do not apply a fixed deficit to everyone or ship unreviewed calorie floors. For time-to-target projections, evaluate a validated dynamic model such as the [NIDDK Body Weight Planner](https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner), within its intended population. Do not equate a fixed number of calories with guaranteed kilogram loss.

Release boundary: the first software milestone includes reference BMI/range, a user-selected eligible goal, an estimated maintenance requirement and observed weight/activity progress. Automated restriction/surplus targets and weight-loss timelines are a separate later milestone until their policy and population limits are specified and reviewed. Their unfinished policy must not prevent shipping the activity review or maintenance estimate. Do not put a fabricated default intake target in their place.

Save timestamped weight entries when users voluntarily update weight, allowing weekly or longer trend review without a daily questionnaire. Compare trends over multiple measurements rather than adjusting the plan after one day. Do not report food adherence or a measured calorie deficit without intake records; no food diary is added by this plan. Recalculate when the profile or goal changes, retaining the model version and assumptions behind each estimate.

### E. Heart-rate and lifestyle context

Heart rate provides timestamped context for activity. It does not directly determine optimal weight or act as an unvalidated calorie multiplier. Distinguish genuine resting observations from measurements taken during recorded movement; a quiet or missing activity interval alone does not prove rest. Account for source quality, observation age, repeated observations and relevant medications before giving an interpretation. A single elevated reading must not cause an automatic food-target change or exercise escalation.

Use the reading-overlap rules below for factual summaries. If data is missing or unsuitable, display that limitation while keeping any independently eligible profile-based estimate available. Heart-rate thresholds and exercise advice need separate validation; do not generate personalized exercise clearance from this data.

Source: [American Heart Association heart-rate context](https://www.heart.org/en/health-topics/high-blood-pressure/the-facts-about-high-blood-pressure/all-about-heart-rate-pulse).

### F. Presentation and existing-copy cleanup

Place the full weight-management view in Wellness, with a compact dashboard summary: reference range, selected goal, BMI, estimated maintenance calories, eligible intake estimate, and recorded progress. Show required missing profile fields instead of fabricated results. Keep Activity focused on recorded movement and the supporting review.

Replace the current BMI card's generic calorie-deficit and extra-steps advice with the reviewed goal/eligibility policy. Calculations and suitability flags stay deterministic on the server; the assistant explains those facts rather than choosing weight or calorie targets itself. Educational benefits remain separate from personal conclusions. Existing SOS and wellness-score algorithms remain outside this change.

## Current foundation

- Google Health already supplies steps, distance, active calories and active minutes.
- The normal importer currently requests seven days. The existing Activity page has an hourly chart, highest recorded period and exact interval records.
- Automatic cloud refresh is currently initiated by the open app; no account-wide background activity worker is running as part of the current API startup. Running-type sessions and separate intensity counts are not yet imported by this workflow.
- Sensor readings have observation timestamps. Google interval start/end times are stored separately from synchronization time.
- The AI context currently includes today's activity totals, but not a structured weekly review or matched sensor/activity intervals.
- Profile height, weight, age, lifestyle and health-context fields already exist. Adult BMI is calculated, but weight history, a structured weight goal, suitability screening and a documented maintenance-energy model are not yet implemented as this workflow.

## 1. Extend history for a fair comparison

Import and retain at least fourteen completed local days of daily totals, plus the current day. Keep the existing detailed intraday window bounded separately. Reuse the linked account and read-only permissions; preserve existing pagination, cooldown, disconnect and account-isolation protections.

Use explicit windows rather than changing one shared seven-day helper everywhere:

| Data | Planned available window | Purpose |
| --- | --- | --- |
| Daily totals | Fourteen completed local days plus today | Two completed-week comparisons and the current summary |
| Derived hourly summaries and their record counts/quality | Same fifteen-date window | Recurring time-of-day patterns after raw intervals expire |
| Exact step/distance/calorie/minute intervals | Existing seven-date window | The current exact-record and intraday UI |
| Optional exercise sessions | Fifteen-date window | Source-reported exercise types and activity context |
| Voluntary weight measurements | A separately documented weight-history policy | Longitudinal weight progress; no daily questionnaire |

Create hourly summaries for the full backfill before discarding raw intervals outside the detailed window. They must retain enough counts, source/version and cross-hour exclusions to avoid misrepresenting sparse data. Keep the existing seven-day timeline endpoint/date selector consistent; expose the longer comparison through the review response rather than offering dates whose exact records are unavailable. A pagination or payload cap is an incomplete import, not a successful complete week.

On a timezone change, invalidate affected derived comparisons and rebuild from available source data; do not merge old-zone and new-zone totals silently. Document retention and consent/disconnect cleanup for every new table. This plan does not authorize purging unrelated existing health history.

Use two adjacent seven-day periods ending yesterday in the profile timezone. Show their date ranges. Today remains available in the current Activity view, but does not enter completed-week comparisons.

Keep missing records distinct from explicit zero. Expose recorded-day counts, synchronization state and retained-data warnings. A day containing records does not establish all-day phone/tracker coverage.

## 2. Weekly activity review

Show the number of days with positive recorded steps, distance or active minutes, together with recorded steps, distance and active time for the period. Active calories may appear as an estimate. Do not use calories alone to establish a walking day.

Example template: "Movement was recorded on 5 days. Activity records are available for 6 of the last 7 completed days."

Use those denominators to explain data availability; never describe a missing day as inactivity or a failure to meet a goal.

## 3. Personal trend comparison

Compare the two completed periods using recorded steps, distance and active minutes. Calculate totals, absolute differences and percentages on the server. Display a change percentage only when both periods contain records for all seven days for the selected metric and neither has a known failed-refresh warning affecting it. Still label the result as a comparison of recorded activity, since device usage coverage is unknown.

When history is insufficient, display "More recorded days are needed for a weekly comparison." When the previous total is zero, show the absolute difference instead of an undefined percentage. Avoid interpreting reduced recorded walking as deteriorating health.

Example template: "Recorded steps were 12% lower than the preceding seven-day period."

## 4. Readings alongside activity

Match a reading's actual observation timestamp to a Google interval using start <= observed time < end. Use positive step intervals for wording about recorded steps; use the broader term "recorded activity" for active-minute intervals. Never join on Google synchronization time or server receipt time.

Restrict matches to the signed-in owner and selected sensor device. Consider separately recorded physical heart-rate observations as well as complete vital records, without counting the same observation twice. Exclude generated readings and records with invalid timestamps or explicit quality failures. Missing quality information must not become a claim of validated accuracy.

Show the measurement, its time and overlapping activity interval. If there is no eligible match, show "No matching sensor readings" without manufacturing a comparison.

Example template: "A heart-rate reading at 19:20 coincided with recorded steps between 19:18 and 19:22."

This establishes timing only. Do not infer a cause, classify recovery or exercise readiness, or turn coincidence into a diagnosis.

## 5. Explain health benefits

Use these as educational statements, visually separate from personal observations:

| Benefit | Copy |
| --- | --- |
| Heart health | Regular activity supports cardiovascular health. |
| Weight management | Movement contributes to energy expenditure and can support weight management. |
| Mood and mental wellbeing | Regular activity can reduce feelings of anxiety and improve wellbeing. |
| Better sleep | Regular physical activity can support better sleep. |
| Everyday fitness | Staying active helps maintain the ability to perform daily activities. |

Sources: [WHO physical activity guidance](https://www.who.int/news-room/fact-sheets/detail/physical-activity) and [CDC benefits of physical activity](https://www.cdc.gov/physical-activity-basics/benefits/index.html).

These statements do not establish an individual's improved sleep, mood, weight or cardiovascular health. The current active-minute total combines light, moderate and vigorous activity; intensity must be retained separately before adding guideline-based aerobic-minute progress. Active calories exclude resting expenditure and do not determine food intake or weight loss.

## 6. Compact presentation

- Dashboard: add a short Health review group within the existing Health insights panel, with up to three factual observations and a link to Activity. Keep AI-generated guidance clearly identified.
- Activity: show weekly consistency, comparison and eligible reading matches in one compact review section. Put the five educational benefits under a single "How activity supports health" disclosure.
- Keep the step dial, compact metrics, hourly chart, date selector and records disclosure. Do not create five permanent benefit cards or restore the removed duplicate chart/status panels.
- Keep all calculations deterministic. Supply the resulting structured facts to the assistant for explanations, without letting the model invent counts, comparisons or measurement matches.
- Minimize new AI context: send calculated age/eligibility, goal and review facts as needed. Do not automatically send raw dates of birth, newly collected pregnancy/medical screening answers or an unrestricted activity/weight history to the model. Preserve account ownership and consent boundaries.
- Do not add a daily check-in or change SOS decisions or the existing wellness-score calculation in this work.

## Implementation order

1. Define the new review contracts, per-feed freshness, history windows, profile eligibility, structured goals and timestamped weight records.
2. Add background sync with shared database locking/backoff, bounded backfill/incremental refresh, optional exercise/intensity imports and derived hourly history.
3. Implement deterministic BMI/reference ranges and maintenance EER estimates, replacing generic BMI-card advice with the eligibility policy.
4. Implement weekly consistency, comparable-period trends and recurring recorded activity times.
5. Implement time-overlap matching with owner/device/source/quality checks.
6. Integrate the compact Wellness/dashboard presentation, Activity review, sourced benefits and minimized assistant context.
7. Verify calculations, isolation, job lifecycle and UI behavior. Validate actual sensor quality and clock alignment separately when hardware is available.
8. Separately define and review the goal-specific intake/weight-projection policy before implementing that later milestone.

The data/API/UI work and automated verification can proceed without a connected sensor. Real sensor accuracy and reliable time alignment require a later hardware check; no hardware flash or body-contact test is required to prepare this software.

## Acceptance checks

- Automatic import while the browser is closed and backend is running; safe restarts, retries, cooldowns and consent/disconnect cancellation.
- Concurrent manual/background requests and multiple API processes cannot duplicate a sync; persisted backoff survives restart.
- Incremental refresh preserves unfetched history and per-feed freshness; full-window reconciliation handles source corrections without duplicate totals.
- Recurring-time summaries remain available after the seven-day raw cache expires; longer review dates never produce a broken exact-record selector.
- Provider-reported walking/running versus inferred step-rate evidence; missing exercise sessions, sparse/long intervals and optional-feed failures.
- No duplicate steps/calories from overlapping exercise summaries; corrected records refresh the affected periods.
- Recurring-time summaries show supporting days and data availability, and delayed records never become a false current-running status.
- Correct age boundaries, units, unrounded BMI classification, eligibility exclusions and missing/unsupported model inputs.
- Published EER reference cases, exact activity-category definitions, reproducible model versions and no double-counted activity calories.
- Goals remain within the reviewed policy; no automatic deficit for excluded profiles and no inferred optimal weight or exercise clearance from heart rate.
- Weight changes are timestamped and gradual trend review is distinguished from daily fluctuation; no claimed intake adherence without intake records.
- Correct local dates and completed-period boundaries, including midnight and daylight-saving changes.
- Missing versus zero, incomplete weeks, zero previous totals, failed/retained imports and insufficient history.
- Exact timestamp overlap, end-exclusive boundaries, mismatched owners/devices and generated or invalid readings.
- No stale review after logout, account switch, timezone change or Google disconnection.
- Facts remain separate from general benefit information and AI explanation.
- Responsive layout, accessible controls/tables and clear empty states.
- Existing automatic sync, exact timestamp records, sensor displays and SOS behavior remain functional.

All example observations above are illustrative, not findings about the linked account.
