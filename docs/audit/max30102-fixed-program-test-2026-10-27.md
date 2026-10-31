# Fixed MAX-only program hardware test — 27 October 2026

The user authorized testing after code fixes. Physical setup: only MAX30102 directly connected by jumpers to ESP32, computer USB on COM3. No ECG electrodes or other sensor modules were part of the test. The normal PlatformIO default remains all-sensor `esp32dev`; this test explicitly selected `max30102_bench`.

Before upload, saved flash addresses 0x000000-0x14ffff (1,376,256 bytes) to the ignored private `.audit-runtime/esp32-setup/pre-max-test-flash.bin`. This includes the previous bootloader/partition table/application and private flash data; it must remain uncommitted. Then built/uploaded the MAX-only program with fixed D21/D22, 100 kHz, checked acquisition/calculation, no Wi-Fi and no other sensor drivers. Upload and flash hash verification succeeded.

The 38-second serial capture produced 38 valid JSON reports. All reported initialized=true, present=true, red=0, ir=0 and window_samples=0. Every heart-rate and SpO2 value was null, with both validity flags false. No sensor measurement was established.

Cumulative startup/recovery counters were init_attempts=2, init_failures=0, recovery_attempts=4 and io_errors=5 at both the first and last report. They did not increase during the capture. The historical last error was a FIFO-clear write at register 0x04, Wire code 4 (generic other error); it is not evidence of new failures on every report. Acquisition remained stalled after recovery despite the initialized/present state.

Result: the code fixes passed host tests and uploaded successfully, but the physical acquisition test did not pass. This does not identify a defective sensor or prove a wiring fault. The next code-focused investigation is the sample-buffer behavior and remaining differences from the working Arduino sketch. No further settings, wiring or firmware were changed after this capture.

The ESP32 is currently running this temporary MAX-only USB test; it sends no data to Vyana. The all-sensor Vyana firmware remains available as `esp32dev` for the later combined-sensor stage. Raw evidence is in ignored `.audit-runtime/esp32-setup/max-fixed-program-test.log` and `max-fixed-program-reports.json`.
