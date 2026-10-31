# Live-only recovery: 28 October 2026

The user reported that the presentation showed simulated results while physical sensors were unavailable.

## Findings

- The display hook enabled generated fallback readings by default, including when browser storage was unavailable. It also restored old demo preferences.
- Backend simulator readings and generated ESP32 steps could appear in live-only mode. Saved history and CSV did not identify their source.
- The last recorded board upload was `ad8232_wifi_bench`. That standalone sketch provides its own wireless viewer and does not publish to the Vyana API.
- During this investigation Windows/PlatformIO detected no serial ports, and the existing wireless viewer returned 503 because the saved device address was unreachable. The Vyana API and localhost:5173 web app were reachable. The selected device's last stored API observation was 27 October at 14:47:32 UTC, with no complete vital records.

## Changes

Live-only is the default on every reload. Demo mode requires an explicit session-only opt-in, visibly identifies generated readings, and cannot be restored by old storage preferences. Live cards and analytics hide generated backend values; stale current values stay unavailable. Genuine recorded history remains intact. History and CSV now identify simulated sources. Live equipment still shows independent optical/probe channels without requiring a complete vital record. The dashboard also exposes actual ECG input summaries with the generated trace disabled by default.

Normal firmware defaults `ENABLE_SIMULATED_ACTIVITY` to zero, suppresses generated activity uploads and identifies its full Wi-Fi/API sketch at boot. Optional demo activity retains its distinct source. No sensor algorithm validity checks were relaxed.

## Software validation

- 47 frontend tests and 65 native firmware tests passed.
- Seven browser scenarios passed against a newly created disposable database, including temperature-only equipment, stale readings, simulated history provenance and demo reset on reload. Their sensor inputs are software fixtures.
- Frontend lint, TypeScript/production build and API build passed. Captured native payloads passed the three strict API schemas.
- The final `esp32dev` image compiled successfully. Compilation is not a physical sensor result.

## Physical verification pending

No firmware was uploaded and no new physical measurement was confirmed during this investigation. Reconnect the board with ECG electrodes off the body for USB work, restore `esp32dev`, then verify one sensor through serial acquisition, HTTP delivery and a fresh dashboard equipment value. Start with the DS18B20 probe; its independent result does not require MAX30102 operation. A successful compile, software fixture, HTTP heartbeat or changing raw ECG input alone does not prove a usable physical vital measurement.
