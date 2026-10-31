# ESP32 USB and local API connection — 27 October 2026

Connected board: ESP32-D0WD, revision v1.0, through a CP2102 USB-UART interface on COM3. The signed Silicon Labs CP210x driver was installed from Espressif's official driver mirror; its catalogue signature verified as Microsoft Windows Hardware Compatibility Publisher. PlatformIO uploaded the firmware and verified flash hashes.

The board uses the password-protected Windows `Vyana-ESP32` hotspot at 2.4 GHz. The API listens on port 8000; firmware connects through the hotspot gateway. The user explicitly approved an inbound firewall rule limited to TCP8000 from 192.168.137.0/24 to 192.168.137.1. Wi-Fi and device credentials are stored only in ignored private configuration, not in this report. The registered ESP32 is selected for the user-requested account. The local dashboard runs at http://localhost:5173.

Two crashes were observed and corrected during physical connection testing:

- The sensor task's original 8 KiB stack overflowed while generating the first equipment report. The compiled equipment function alone reserved 6,336 bytes, and its nested diagnostic function reserved another 1,600 bytes before serializer and RTOS context overhead. The sensor task now has 16 KiB.
- After the first HTTP200 response, HTTPClient's destructor used an already-destroyed transport client. Its clients are now constructed first, so HTTPClient is destroyed while its transport objects remain alive.

After the corrections, a 50-second serial capture covering approximately 70–115 seconds of uninterrupted uptime recorded ten equipment reports, ten `delivery=200` messages, zero panics, and zero diagnostic drops. Reported free heap settled near 123,460 bytes. A database query independently confirmed that the selected ESP32 had `connected=true` and a recent heartbeat with source `ESP32_RealVitals_SimulatedSteps`.

Limitations: the MAX30102 and DS18B20 were not detected. No real vital measurements were produced or validated. AD8232 ADC output does not establish module presence or ECG accuracy. MPU6050 activity was simulated locally. NTP remained unsynchronized during this check, so timestamped activity/vitals were withheld; the API connection was verified through heartbeats. Long-duration stability, sensor operation, external HTTPS and failure/recovery scenarios remain unverified.

The [current-code wiring diagram](../../hardware/wiring/esp32-current-code/README.md) records the actual firmware's GPIO assignments.
