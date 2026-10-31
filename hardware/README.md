# ESP32 firmware: real sensor acquisition

Connect MAX30102, DS18B20 and AD8232 using the [current-code wiring diagram](wiring/esp32-current-code/README.md). Normal firmware publishes real sensor readings only. Steps and walking distance come from the separate Google Health web integration and require no motion sensor wiring, driver or firmware settings.

For the local app, follow [Connect an ESP32](CONNECT_ESP32.md): API network binding, device registration/activation, Wi-Fi settings, upload and delivery checks.

The default PlatformIO environment is `esp32dev`, the full Vyana firmware using all connected sensors. For temporary MAX30102-only troubleshooting, explicitly select `max30102_bench`: fixed D21/D22, fixed 100 kHz, USB serial only, no Wi-Fi or other sensor drivers. Build commands do not upload unless `--target upload` is specified.

| Equipment | Result | Mode |
|---|---|---|
| MAX30102 | Heart rate (BPM), SpO2 (%), raw red/IR, contact and validity | Real optical samples processed with a locally corrected Maxim algorithm |
| DS18B20 | Local probe temperature (degrees C), presence and validity | Real, asynchronous conversion |
| AD8232 | Raw ECG ADC, approximate millivolts, lead status, sample/min/max/clipping counts | Real signal acquisition; rhythm remains unclassified |

USB upload and local Wi-Fi/API delivery were verified on an ESP32-D0WD board. The [live sensor check](../docs/audit/esp32-live-sensors-2026-10-27.md) confirmed a DS18B20 reading near 25 C in Vyana. AD8232 ADC/status reached Vyana, but a usable ECG is unverified. MAX30102 later produced raw optical reports in an isolated test, with intermittent failures in other captures; reliable HR/SpO2 remains unverified. The [MAX-only audit](../docs/audit/max30102-only-check-2026-10-27.md) records those observations. The subsequent [code fixes](../docs/audit/max30102-code-fixes-2026-10-27.md) have local test/build validation only and require a separate board test.

## Configure, build and upload

The AD8232 implementation follows the [Analog Devices datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/AD8232.pdf) for lead-off and shutdown semantics, and the [Espressif Arduino ADC reference](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html) for ADC acquisition. The [driver](esp32/src/sensors/AD8232_Driver.h) uses GPIO34 for raw 12-bit ADC input, GPIO35 for LO+ and GPIO32 for LO-. It initializes the ADC channel before applying per-pin attenuation, retains actual raw readings during lead-off and reports unclassified rhythm. The millivolt estimate uses a separate conversion. No filtering or generated waveform is used to replace clipped readings.

The photographed module is marked **CJMCU-8232 V502**. Its SDN pull-up has not been verified; the SparkFun schematic documents the SparkFun board only. A compiled program does not verify this module's supply voltage, electrode contact or ECG quality.

For VS Code, open `hardware/esp32.code-workspace`. PlatformIO generates the firmware editor metadata from `platformio.ini`; the SDK helper exports only directories installed in the pinned package. This prevents optional, absent SDK folders appearing as missing include paths. The repository-root C/C++ configuration uses the same firmware toolchain and compilation database. Regenerate metadata after SDK or dependency changes:

```powershell
pio project init --project-dir hardware/esp32 --ide vscode --environment esp32dev
pio run --project-dir hardware/esp32 --environment esp32dev --target compiledb
```

These commands follow the official [PlatformIO project setup](https://docs.platformio.org/en/latest/core/userguide/project/cmd_init.html) and [compilation database](https://docs.platformio.org/en/latest/integration/compile_commands.html) workflows. They do not upload firmware.

Use Python 3.12, PlatformIO 6.2.0 and the pinned Espressif 8.0.0 environment:

```powershell
python -m pip install platformio==6.2.0
if (-not (Test-Path hardware/esp32/src/config.h)) {
  Copy-Item hardware/esp32/src/config.example.h hardware/esp32/src/config.h
}
python -m platformio run --project-dir hardware/esp32 --environment esp32dev --jobs 2
python -m platformio test --project-dir hardware/esp32 --environment native
```

Copy the example only when creating a new configuration; preserve an existing private `config.h`. Before uploading, edit it with Wi-Fi details, the provisioned device credential, API URL (including `/api/v1`) and HTTPS root CA. Create/select the device in **Settings > Your devices** using the [connection guide](CONNECT_ESP32.md), or provision through the operator CLI described in [setup](../docs/SETUP.md). Do not commit credentials. Use an API hostname or LAN address reachable from the board; `localhost` on an ESP32 means the ESP32 itself. Plain HTTP requires the explicit local-bench opt-in.

Upload to the intended board and use a 115200-baud monitor:

```powershell
python -m platformio run --project-dir hardware/esp32 --environment esp32dev --target upload --upload-port COM5
python -m platformio device monitor --port COM5 --baud 115200
```

Replace COM5 with that board's port. For body-connected ECG, follow the battery-only procedure in the wiring guide: disconnect computer USB and mains-connected equipment before attaching electrodes. USB programming/monitoring is for electrodes-off testing; use wireless or isolated onboard logging for body-connected operation.

## Equipment output

A JSON equipment report is generated every five seconds, independently of Wi-Fi or clock synchronization. A separate task writes complete diagnostic lines to serial through a bounded three-record queue; a full queue drops the newest diagnostic and increments `log_drops` without blocking acquisition. Objects are named `MAX30102`, `DS18B20` and `AD8232`; only real sensor acquisition is reported. Each optical channel is null until its own algorithm output is valid and fresh; a missing or stale temperature is null. A completed probe measurement outside the API's 20-45 C range is still shown locally, with `valid: false`. This makes individual sensor tests possible even when the API cannot accept a complete vital record.

MAX30102 reads checked six-byte red/IR frames directly from the hardware FIFO, bypassing the library's small software buffer. FIFO checks run at most every 10 ms, draining all pending frames; acquisition remains 25 frames/second. Short reads, NACKs and FIFO overflow invalidate the current window. An overflow drains and discards the complete pending backlog (32 frames when full pointers are equal), then starts a fresh window without rewriting live FIFO pointers. The vendor's setup already clears FIFO, so startup does not clear it a second time. Communication-fault recovery attempts one FIFO clear per 100 ms; three failed attempts defer to full initialization, retried every two seconds. Each initialization retry ends and restarts the ESP32 I2C controller on D21/D22 at the configured clock before checking sensor identity/configuration. An initial absence or configuration failure also retries every two seconds without rebooting. Attempts preserve cumulative counters and never reuse an old measurement window. Pins are fixed; startup does not swap SDA/SCL or scan unrelated addresses.

`io_errors` counts acquisition/recovery faults; `init_attempts`, `init_failures`, `recovery_attempts`, `bus_restarts` and `bus_restart_failures` distinguish operations. The error stage/register/code/byte counts/value describe one last failure, not a mixture of separate operations. A zero Wire code in a short-read stage means no Wire error code was available. Stages are 1 register-address write, 2 short read, 3 empty read buffer, 4 invalid pointer bits, 5 FIFO-clear write, 6 unexpected part ID, 7 configuration mismatch, 8 vendor initialization failure and 9 controller restart failure (code 1: end failed, code 2: begin failed). Recovery does not erase the last failure snapshot.

Initialization verifies identity and configured mode/rate. The locally corrected algorithm in `src/optical` preserves the upstream license and fixes a flat-peak array overrun, 32-bit product overflow and the IR peak index. MAX30102 collects red/IR at an effective 25 samples/second with a four-second window, updating the calculation every second. Keep the finger steady. Missing contact, ADC saturation, stale samples, invalid algorithm flags or a polling gap invalidate the result and require a fresh window. `MAX30102_MIN_IR` is a bench-tunable contact heuristic, not calibrated signal-quality assurance.

DS18B20 pins the discovered DS18B20 ROM address, checks resolution configuration and requests asynchronous conversions for that address. It verifies conversion completion before reading the CRC-checked scratchpad; a stalled conversion or failed request cannot refresh an old temperature. An absent sensor is rediscovered at two-second intervals and must complete a new conversion before publication. Its probe measures local contact temperature, not automatically core body temperature. Missing or out-of-range results never become a generated normal value.

AD8232 samples ADC1/GPIO34 with a target interval of 4 ms in a dedicated priority-2 task on core 1. Optical and temperature polling/reporting run on core 0; network delivery and diagnostics run at priority 1 on core 1. A short critical section protects ECG snapshots and summary resets; ADC conversions occur outside it. This prevents a slow OneWire or I2C operation from directly blocking the ECG polling loop. Scheduling and ADC/serial activity can still introduce gaps: acquisition remains best-effort, not a guaranteed 250 Hz recorder. Millivolts come from a separate calibrated ADC conversion; raw ADC and millivolts are not the same instantaneous sample. Lead-detached status is `Leads Off`; attached leads report `Unknown` because no rhythm classifier is implemented. ADC clipping is counted while leads are attached. GPIO inputs alone cannot establish whether an AD8232 module is installed; disconnected/floating pins are not a valid ECG test.

For an electrodes-off signal-generator test, enable `#define ECG_STREAM_SERIAL 1` in `config.h`. Additional lines have the format `ECG,uptime_ms,raw_adc,millivolts,leads_off`. Filter the `ECG,` prefix when capturing them; the same stream includes equipment/delivery logs. The serial stream is an optional bench output. Full firmware also uploads bounded raw sample batches to `ingest/ecg`, using a separate 512-sample ring and up to 128 samples per request. Sequence numbers and boot UUIDs expose loss/restarts. Health summaries keep delivery priority; waveform retries are bounded, and pending waveform requests older than 30 seconds are discarded. API storage expires after ten minutes and is capped at 1,200 batches per device. The app displays recorded raw ADC with gaps and clipping information, without rhythm classification. This build is compiled/tested locally but not yet uploaded or physically verified.


## API and delivery

Authenticated endpoints:

- `ingest/vitals`: real heart rate, SpO2, temperature and ECG lead status; source `ESP32_MAX30102_DS18B20_AD8232`.
- `device/status`: heartbeat, unmeasured battery null; source `ESP32_MAX30102_DS18B20_AD8232`. An optional timestamped `equipment` snapshot carries independently validated pulse, oxygen, probe temperature and ECG ADC/status/counts.

The complete vital endpoint requires all vital numbers in one record. If optical or temperature data is invalid, that vital upload is withheld while independent equipment and heartbeat continue. The latest equipment snapshot accepts a fresh, converted probe reading across its -55 to 125 C physical range; it does not create a complete vital or wellness score. Partial snapshots have their own account-owned history, and eligible observations participate in the configured SOS rules. Vyana displays available optical channels, local probe readings and unclassified ECG input independently, expiring equipment after 30 seconds. New explicit nulls clear older values. A DS18B20 absent at startup is rediscovered at two-second intervals and must complete a new conversion before publication. ECG `Unknown` also means the existing wellness score is unavailable. A boot UUID, sequence and acquisition UTC support deduplicated replay. Unsynchronized UTC withholds timestamped uploads, while local acquisition/reports continue.

SNTP starts after Wi-Fi connects. A default-off `BENCH_HTTP_CLOCK_FROM_API=1` setting can bootstrap an unset clock from a successful configured HTTP API response's Date header, only when `ALLOW_INSECURE_HTTP=true`. It trusts the local API clock and transport; use it only on a trusted bench network. SNTP remains enabled, and HTTPS certificate checks are unchanged.

The transport ring holds 64 records of at most 512 payload bytes, plus a 12-record producer queue. Overflow drops the newest record and increments a counter. Only 2xx acknowledges delivery; timeouts, 408, 429 and 5xx retry with bounded backoff and validated `Retry-After` delta-seconds (capped at 300 seconds). Retry waiting starts after the request completes. HTTP-date Retry-After values use the ordinary backoff instead. Buffers are volatile; acquisition does not wait indefinitely for Wi-Fi. A heartbeat indicates communication, not validity of all attached sensors.

## Verification and remaining bench work

For an AD8232-only electrical check, explicitly select `ad8232_bench`:

```powershell
pio run --project-dir hardware/esp32 -e ad8232_bench -t upload --upload-port COM3
pio device monitor --port COM3 --baud 115200
```

Keep electrodes off the body during computer USB use. This environment excludes
Wi-Fi, private configuration and the other sensors. It uses the existing AD8232
driver with OUT on GPIO34, LO+ on GPIO35 and LO− on GPIO32. It emits raw `ECG,`
CSV samples plus a JSON summary every second, including both lead pins, all-sample
clipping counts and maximum sample gap. Millivolts use a separate ADC conversion.
`Unknown` means unclassified, not a normal rhythm; changing ADC counts alone do
not establish an ECG. The [28 October check](../docs/audit/ad8232-only-check-2026-10-28.md)
records the observed baseline. The normal default remains `esp32dev`.

For standalone wireless AD8232 acquisition, use `ad8232_wifi_bench`:

SDN wiring depends on the breakout. The SparkFun AD8232 board has an onboard
10 kΩ pull-up (R15), so its SDN header pin can remain unconnected. The firmware
does not drive SDN. Do not add an external enable wire solely because the pin
is exposed; check the board schematic. See the [manufacturer schematic](https://cdn.sparkfun.com/datasheets/Sensors/Biometric/AD8232_Heart_Rate_Monitor_v10.pdf).

```powershell
pio run --project-dir hardware/esp32 -e ad8232_wifi_bench -t upload --upload-port COM3
```

Upload with electrodes off the body. This diagnostic joins the Wi-Fi network
already configured in ignored `src/config.h`, without sending data to the app
or using its API credential. A separate acquisition task fills a 2,048-sample
ring while HTTP clients request batches. The response includes sequence numbers,
a boot identifier, cursor, overflow count and both lead pins; gaps and restarts
must not be silently joined into one trace. The browser starts at the current
sample rather than counting pre-viewer history as capture loss.

The board serves a raw ADC viewer at its local IP, plus `/status` and
`/samples?after=N`. These require HTTP Basic authentication with username `vyana`
and a randomly generated password persisted in the `ecg-bench` NVS namespace.
The `ECG_WIFI_READY` serial line includes that password: retrieve it only with
electrodes off, keep it private and do not paste it into audit logs. This is a
trusted-LAN bench endpoint over HTTP, not an internet deployment. After upload,
disconnect computer USB and use standalone battery power that is not charging
before attaching electrodes; inspect readings wirelessly. The viewer shows raw
input, clipping and unclassified lead state, without a generated ECG or BPM.

The [wireless check](../docs/audit/ad8232-only-check-2026-10-28.md) records the
observed rates and signal limitations. Buffer ordering, pagination, overflow
and reset checks run with `pio test --project-dir hardware/esp32 -e native -f test_ad_bench`.

Build the MAX30102-only program without changing the board:

```powershell
pio run --project-dir hardware/esp32 -e max30102_bench --jobs 2
```

When ready for a physical test, explicitly upload that environment:

```powershell
pio run --project-dir hardware/esp32 -e max30102_bench -t upload --upload-port COM3
pio device monitor --port COM3 --baud 115200
```

This bench excludes Wi-Fi, private `config.h`, API credentials and other sensor drivers. It uses the checked acquisition driver and local calculation algorithm at a fixed 100 kHz throughout the run; it does not change clocks after 15 seconds. One JSON report per second contains raw red/IR, window sample count, initialization/recovery diagnostics and independently validated calculated BPM/SpO2. Unavailable, stale or invalid results remain null. Raw changing voltage/light counts are not calculated vital measurements. It needs no temperature sensor. The default full `esp32dev` build excludes bench sources and remains the target for all-sensor Vyana operation. Keep electrodes off the body during USB programming/testing.

The standalone report also exposes cached FIFO pointers, accepted/discarded frame counts, overflow events and gap resets without adding extra I2C reads to the acquisition loop. A separate explicit `max30102_verify` environment inspects device registers and performs a 15-second-per-phase rollover off/on/off raw-frame comparison. It is a temporary diagnostic, not a vital-measurement program or the normal default. See the [verified overflow-loop fix](../docs/audit/max30102-overflow-loop-2026-10-27.md) for the physical evidence.

`max30102_bus_diag` runs the same MAX bench with Arduino controller-error logging enabled. The [I2C dropout investigation](../docs/audit/max30102-i2c-dropout-2026-10-27.md) records error 259, bounded polling/controller recovery, hardware captures and their limits.

The [hardware review](../docs/audit/hardware-review-2026-10-27.md) records the findings and checks from 27 October 2026. The expanded suites exercise acquisition faults/recovery, synthetic optical windows, time rollover, step/rest timing, ECG serial output, actual firmware JSON/queue behavior, source separation and startup failures. Native tests use fake hardware/RTOS interfaces; they do not execute the ESP32 scheduler, ADC, Wi-Fi or a real sensor.

To capture actual firmware payloads for validation against the current strict API schemas, use Node 24.22.1+ (within 24.x) with the installed project dependencies:

```powershell
$env:FIRMWARE_CAPTURE_PATH = "$PWD/artifacts/firmware-payloads.json"
New-Item -ItemType Directory -Force artifacts | Out-Null
python -m platformio test --project-dir hardware/esp32 --environment native
node hardware/esp32/test/verify_api_payloads.mjs artifacts/firmware-payloads.json
```

On Linux, after installing the pinned native test libraries, run `sh test/run_sanitizers.sh` from `hardware/esp32` using a compiler with AddressSanitizer and UndefinedBehaviorSanitizer. The native suites compile optional ECG streaming as enabled; the normal board build defaults it off. Configuration overrides outside the documented ranges fail at compilation.

Before recording sensor results, test sensor presence/absence, finger removal and stable-contact recovery, temperature changes after conversion, lead removal and ADC clipping using an appropriate signal source. Check the published sources and activity counters. Then exercise Wi-Fi disconnect beyond buffer capacity, reconnect/deduplicated replay, 400/401/429/500 responses, reboot and historical replay. Record actual board/revision, power, duration, heap, retries/drops and UI results in [the audit ledger](../docs/audit/STATUS.md). Real sensor operation, long-duration stability and external HTTPS remain unverified.

Implementation references: [SparkFun SpO2 example](https://github.com/sparkfun/SparkFun_MAX3010x_Sensor_Library/blob/master/examples/Example8_SPO2/Example8_SPO2.ino), [bundled algorithm](https://github.com/sparkfun/SparkFun_MAX3010x_Sensor_Library/blob/master/src/spo2_algorithm.h), [Espressif ADC API](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html).
