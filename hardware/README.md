# ESP32 firmware

Physical-board checks are deferred because components are unavailable. Compilation and native transport tests have passed; they do not establish real sensor accuracy or network reliability.

## Build

Use Python 3.12, PlatformIO 6.2.0 and the pinned Espressif 8.0.0 environment:

```powershell
python -m pip install platformio==6.2.0
pio run --project-dir hardware/esp32 --environment esp32dev
pio test --project-dir hardware/esp32 --environment native
```

Native tests need a C++ compiler. CI provides one. To configure a board, copy [config.example.h](esp32/src/config.example.h) to ignored `config.h`; set Wi-Fi, the provisioned device credential, API URL and HTTPS root CA. Plain HTTP requires an explicit local-bench opt-in. Upload only to the intended connected board.

## Runtime behavior

The transport ring holds 64 records, each with at most 512 payload bytes. Overflow drops the newest record and increments a counter. A separate FreeRTOS queue holds 12 sensor readings.

Only 2xx responses acknowledge delivery. Timeouts, 408, 429 and 5xx retry with bounded backoff/Retry-After. Invalid input and credential failures are reported explicitly. Buffers are volatile; acquisition does not wait indefinitely for Wi-Fi.

A boot UUID, sequence and acquisition UTC support replay deduplication. Unsynchronized clocks withhold timestamped samples. Missing temperature is not replaced with a normal value.

Heart-rate/SpO2 processing and activity are simulated; the source is `ESP32_SimulatedDSP`. ECG checks lead status, not a diagnostic waveform. Battery is null.

## Deferred bench

Provision the intended board and trusted transport. Record board/revision, power, duration, heap range, retry/drop counters and UI results while checking:

- Owned vitals, activity, heartbeat and source.
- Disconnect beyond queue capacity, reconnect and deduplicated replay.
- 400/401/429/500 responses, reboot/session reset and sensor absence.
- Historical replay without false current alerts.

Record actual evidence in [the audit ledger](../docs/audit/STATUS.md). External HTTPS is also deferred.
