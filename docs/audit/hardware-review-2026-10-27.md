# Hardware code review - 27 October 2026

The review covered the ESP32 firmware prepared for real MAX30102, DS18B20 and AD8232 readings with simulated MPU6050 activity, its native tests, configuration and setup instructions. It found and corrected bugs beyond those exercised by the initial 11 tests. The findings below are fixed in the working tree; physical operation remains unverified.

## Corrections

| Finding | Resulting behavior |
|---|---|
| The optical library's software FIFO exposes a preceding sample, has only four slots, and does not check every I2C read result | The [optical driver](../../hardware/esp32/src/sensors/MAX30102_Driver.h) reads checked hardware FIFO frames directly; NACKs, short reads, overflow and timing gaps invalidate the window. A failed FIFO flush must recover before acquisition resumes. Startup verifies mode/rate settings. |
| The upstream optical algorithm can read past an end-of-array plateau, overflow 32-bit products, and use the red peak index when computing IR amplitude | A [local copy](../../hardware/esp32/src/optical/MaximAlgorithm.cpp), with the upstream license retained, bounds the scan, widens ratio products, corrects the IR index, avoids unsigned subtraction and checks window/input bounds. |
| Waiting a fixed delay alone does not establish that a temperature conversion completed | The [temperature driver](../../hardware/esp32/src/sensors/DS18B20_Driver.h) checks completion, pins the probe ROM, checks configuration/requests and clears unavailable measurements. A previous scratchpad value cannot become fresh after a stalled conversion. |
| Concurrent serial writes could split JSON/CSV records and serial backpressure could stall acquisition | One diagnostic task owns runtime serial output. A bounded three-record queue drops newest diagnostics without blocking acquisition and exposes `log_drops`. Shared rejection/drop counters are atomic. |
| Measuring serialized JSON length alone does not detect an exhausted JSON memory pool | Upload enqueueing rejects `doc.overflowed()` as well as oversized output. Equipment reports check both limits. |
| Retry waiting was measured from before a potentially slow HTTP request; malformed negative Retry-After values could become large unsigned delays | Waiting starts after completion. Delta-seconds are parsed strictly and capped at 300; unsupported HTTP-date values use ordinary backoff. |
| Signed deadline comparisons could stall retry/reconnect after roughly 25 days in the opposite network state | Elapsed-time retry windows handle clock rollover and long idle periods without the signed half-range stall. |
| Invalid simulation settings could wrap through unsigned conversion | Compile-time assertions reject out-of-range cadence, durations, estimates, contact threshold and serial flags. |
| Task allocation failures were ignored | Startup reports failed queue/task creation explicitly. |

The retained AD8232 behavior reports detached leads as `Leads Off` and attached leads as `Unknown`; it does not diagnose rhythm. Distance/calories remain estimates derived from simulated steps. The app's illustrated ECG remains synthetic; raw ADC data is local diagnostic output.

## Verification

| Check | Observed result |
|---|---|
| PlatformIO native tests on Windows | **39 passed**: six transport, eight measurement/simulation, 17 sensor/algorithm, eight actual firmware report/payload/queue/startup tests |
| GCC 13 AddressSanitizer + UndefinedBehaviorSanitizer on Linux | The same **39 passed**, including 2,000 deterministic adversarial optical windows; no sanitizer findings |
| Negative reproduction against the unmodified library 1.1.2 | AddressSanitizer reproduced the flat-peak stack-buffer-overflow; UBSan reproduced signed overflow for `90451 * 240000`. These are expected failing controls, not failures in the corrected implementation. |
| Strict current API schemas | Captured firmware vitals, activity and device/status payloads all passed the source Zod schemas, with distinct real/simulated sources |
| Configuration checks | Default accepted; seven invalid overrides rejected by their compile-time assertions |
| Default ESP32 build | Passed; 86,960 bytes static RAM (26.5%), 1,241,276 bytes flash (94.7% of the default application partition) |
| ESP32 build with `ECG_STREAM_SERIAL=1` | Passed; 86,960 bytes static RAM (26.5%), 1,241,336 bytes flash (94.7%) |
| Linked default ELF inspection | Contains `optical_algorithm::calculate`; the unmodified `maxim_heart_rate_and_oxygen_saturation` function is not linked |

Native tests exercise the real driver/control/JSON code against fake Arduino, I2C, probe and RTOS interfaces. The algorithm and JSON library execute normally. Tests cover FIFO ordering, partial/NACK reads, failed flush recovery, contact loss, fresh-window recovery, boot absence, stalls, rollover, conversion completion, lead states, clipping, CSV, JSON pool/queue limits, missing data, UTC gating, source labels and allocation failures.

Reproduce native tests with the [firmware guide](../../hardware/README.md). The [sanitizer runner](../../hardware/esp32/test/run_sanitizers.sh) runs on Linux after the pinned native libraries are installed. The [API contract checker](../../hardware/esp32/test/verify_api_payloads.mjs) validates a capture produced by setting `FIRMWARE_CAPTURE_PATH` during native tests.

The first parallel compilation attempts exhausted host memory; serial native runs and ESP32 builds with `--jobs 2` passed. Existing SparkFun/OneWire compiler warnings remain. The default binary SHA-256 is `a2d048ca1f79a78ca9f2fea14c44619841b050fb8d0918ea8a95f28bb5a3f456`.

## Remaining limits

No board was flashed or connected for this review. Real sensor accuracy, electrode behavior, timing/jitter, task stack/heap margins, UART throughput/drop rates, radio/TLS/reconnect behavior and physical replay still require the bench checks in the firmware guide. Static RAM usage does not include runtime heap allocations. Flash has about 68 KiB remaining in the default application partition.

There is no rhythm classifier or guaranteed-rate ECG recorder. The API requires a complete vital record, so invalid optical/temperature data withholds that upload while activity and heartbeat continue. A module absent at startup requires correction and reboot. Sensor processing and contact heuristics are not clinically validated.

These checks support confidence in the reviewed behavior; they cannot establish that the firmware is 100% bug-free. The unrelated application changes already present in the workspace were not part of this hardware review. Nothing was published.

Implementation references: [MAX30102 FIFO specification](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX30102.pdf), [DS18B20 conversion protocol](https://www.analog.com/media/en/technical-documentation/data-sheets/ds18b20.pdf), [upstream Maxim/SparkFun implementation](https://github.com/sparkfun/SparkFun_MAX3010x_Sensor_Library/blob/master/src/spo2_algorithm.cpp).
