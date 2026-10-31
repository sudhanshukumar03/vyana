# ESP32 live sensor check — 27 October 2026

Follow-up to the initial connection check. ESP32-D0WD on COM3, computer USB, electrodes-off bench procedure. The user requested checking the other sensors while leaving MAX30102 troubleshooting aside.

| Channel | Observed result | Interpretation |
|---|---|---|
| DS18B20 | Present, fresh conversion, 24.9375 C in the final serial capture and device snapshot; Vyana displays 24.94 C / Live probe | Real local probe acquisition and delivery work; body-temperature accuracy unverified |
| AD8232 | ADC 0/4095, separate calibrated conversion 142 mV, status Unknown; all 1197-1209 samples per report clipped | ADC/status path reaches Vyana; a usable ECG signal and module function are unverified |
| MAX30102 | No I2C response; no valid HR/SpO2 | Unavailable; no generated replacement readings |
| MPU6050 activity | Source ESP32_MPU6050_Simulated; counters advance during simulated walking | Demo only, no physical motion measurement |

The final 22-second serial capture contained five equipment reports and ten HTTP 200 deliveries, with zero reported retries, rejected/dropped transport records or diagnostic drops. Heap stayed around 123 kB. No panic was observed in this capture. This is a short delivery check, not long-duration qualification.

Vyana Health Vitals was checked in the browser: temperature 24.94 C / Live probe, ECG Unknown / Input clipping detected, ADC/count details visible, heart rate and blood oxygen No data. Dashboard likewise showed the independent temperature and ECG status. The selected device was connected; no complete vital records were fabricated.

## Changes supporting the check

- Start SNTP after Wi-Fi connects. On this trusted local HTTP bench, enable the private, default-off BENCH_HTTP_CLOCK_FROM_API opt-in: an unset UTC clock can use the configured successful API response's Date header. It also requires ALLOW_INSECURE_HTTP; SNTP and HTTPS verification behavior remain intact. This trusts the local API time, not an authenticated time service.
- Add a latest, owner-scoped equipment snapshot to device/status, independent of complete HR/SpO2/temperature ingest. Fresh probe temperature and unclassified ECG ADC/status/counts can reach Vyana even without MAX30102. Historical vital/alert/score requirements remain unchanged.
- Display only fresh equipment from an active connected device; label probe readings without interpreting them as core body temperature. Show ECG clipping and counts without generating a waveform or rhythm classification.

## Validation

- Firmware native: 42 tests passed, including physical probe range/age policy, clock parsing/opt-in policy and actual independent serialized equipment payload.
- Captured firmware payloads passed all three strict API schemas.
- API: 52 tests passed across six suites using a separately named disposable test database; includes owner isolation, revoked keys, snapshot ordering and range validation.
- Web: 33 tests passed across four suites, including independent equipment freshness and disconnected/stale rejection.
- API/web type checks passed. Production build and ESP32 upload completed; the flashed firmware's new equipment snapshot was then observed in the live API and browser.

No valid ECG waveform, real motion data, optical measurements, external HTTPS path or medical accuracy has been established. Keep electrodes off the body while using computer USB. The initial connection audit is historical; its missing-temperature observation precedes this successful probe reading.

## Subsequent AD8232-only check

With only AD8232 connected, startup initially revealed a different MAX30102-only test sketch. Restored the existing configured Vyana firmware on COM3; upload and flash hashes succeeded. The saved Vyana-ESP32 hotspot was off and was restarted without changing its credentials. HTTP 200 delivery resumed and the queued reports drained without reported drops or rejections.

Initially the ECG input remained at zero or was heavily clipped. Later serial reports showed changing raw ADC values (1367, 1578, 1731), including one five-second window with zero clipped samples of 1227 and range 321-3360. Later windows had occasional clipping. Vyana Health Vitals visibly showed changing ADC/millivolt/count summaries; the saved screenshot shows 2032/4095, 1832 mV, 14 clipped of 1238. The lead status was Unknown (unclassified). This confirms responsive acquisition and delivery, not that the variation is an ECG waveform or that a rhythm is valid. No multimeter or signal-generator validation was available. No ADC jumper test was needed or performed.
