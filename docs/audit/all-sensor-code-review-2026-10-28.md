# All sensor code review 28 October 2026

The firmware-to-dashboard path passed the software checks below. The user requested code verification only and deferred physical testing. No board upload or new sensor capture was performed. The compiled files do not replace the previously installed AD8232 wireless bench firmware.

## Changes

- Heart rate and oxygen saturation now travel independently in the equipment snapshot. A missing temperature probe or invalid sibling optical channel no longer suppresses an otherwise valid optical result. The complete historical vital endpoint retains its existing requirements.
- Both serial diagnostics and equipment uploads validate optical channels independently and reject stale results. Temperature diagnostics also withhold stale readings. A DS18B20 absent during startup is rediscovered at bounded two-second intervals and requires a new conversion before publication.
- AD8232 acquisition runs in a separate task from optical/OneWire work. ADC conversions stay outside a short critical section; reporting obtains one consistent snapshot and resets the completed statistics window atomically. The target remains best-effort 250 Hz, requiring physical timing verification.
- The API accepts optional nullable optical equipment fields without a database migration. Owner isolation, replay ordering, null clearing and legacy payload compatibility remain covered.
- Dashboard and vitals cards use the newer equipment observation. Explicit nulls clear older saved values; older equipment cannot overwrite a newer vital reading. The live critical-reading banner follows the same values. Probe temperatures are identified as local probe readings.
- The ECG panel presents actual telemetry summaries and clipping status. The prior generated waveform was removed. The main firmware sends no raw waveform stream to the app and supplies no rhythm classifier.
- Product labels use “ESP32 sensor hub” and “Activity estimate.” Internal source identifiers still distinguish measured vital acquisition from the generated activity feed. This change does not implement a physical MPU6050 driver.

## Verification

| Check | Result |
|---|---|
| PlatformIO native regression tests | 64 passed across six suites |
| Captured native firmware payloads against current strict API schemas | All three endpoints passed |
| Combined `esp32dev` compilation | Passed; static RAM 87,056 / 327,680 bytes; flash 1,267,148 / 1,310,720 bytes |
| `ad8232_bench` and `ad8232_wifi_bench` compilation | Both passed |
| API tests with PostgreSQL | 53 passed across six suites; disposable `healthguard_soak_test` on port 55434 only |
| Frontend unit/store/service tests | 39 passed across four files |
| API/frontend type checks, lint and production builds | Passed |
| New equipment browser regressions | Four passed; one selector was narrowed after it matched two valid source labels |
| Browser fixture coverage | Independent optical values without temperature, generated activity delivery, null invalidation of an older critical reading, clipped ECG input and stale equipment despite a recent heartbeat |
| Visual checks | Desktop 1440 px and mobile 320 px; reviewed upper page and scrolled ECG panel; no horizontal overflow |
| Project references and encoding | Passed |

The API suite intentionally injects a database failure in an existing error-handling test; its logged `P0001` error is expected. Initial sandbox process-spawn restrictions were resolved by rerunning checks with the required execution permission. No source repair was needed for those restrictions.

Build output, schema-checked native payloads, browser screenshots, source hashes and compiled-image hashes are retained under `artifacts/all-sensor-code-review-2026-10-28/`. Browser inputs are software fixtures, not new physical sensor observations. Tests cover known regression cases and do not establish every hardware condition or clinical accuracy.

## Remaining physical verification

Check optical contact and stable calculated HR/SpO2, temperature conversion, ECG lead detection and clipping, and combined acquisition timing on the actual wiring. Flash usage is 96.7% of the current application partition, leaving limited room for future code growth. Task stack headroom and real sample gaps require a physical run. Existing noisy/clipped ECG captures remain unresolved; passing code checks do not turn them into a valid ECG.

SDN remains breakout-dependent. The SparkFun board's onboard pull-up makes an extra SDN wire unnecessary; the firmware does not drive SDN. See the [earlier correction and capture record](ad8232-only-check-2026-10-28.md).
