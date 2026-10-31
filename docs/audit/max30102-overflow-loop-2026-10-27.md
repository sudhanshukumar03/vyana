# MAX30102 overflow/reset loop verification — 27 October 2026

User report: the MAX's red sensing light was active, but the current program reported zero red/IR. Setup remained MAX only, directly wired to ESP32 D21/D22 and powered by computer USB. No wiring or supply-voltage change was made. This is a temporary isolated test; all-sensor `esp32dev` remains the normal project default.

## Controlled hardware evidence

A separate diagnostic (`-e max30102_verify`) kept clock 100 kHz, LED drive 60, averaging 4, red/IR mode, 100 SPS, 411 us and 4096 nA range fixed. It read checked six-byte frames without the application's pointer-reset recovery, comparing rollover off/on/off for 15 seconds each. Device ID was 0x15, mode 0x03, SpO2 configuration 0x27 and both LED amplitudes 0x3c. FIFO configuration was 0x4f/0x5f/0x4f as requested.

The phases received 406, 407 and 406 nonzero frames respectively (1219 total), with zero read failures and zero invalid pointer values. Thus rollover selection did not explain the earlier zero readings, and the hardware could produce raw light samples under the same pin/clock/LED settings. No HR/SpO2 claim is based on this raw diagnostic.

Removing a redundant second startup FIFO clear alone did not resolve the production reader. Passive counters then showed 626 overflow-handling events, zero accepted frames, zero gap resets and zero I2C errors around 25 seconds of uptime. The reader repeatedly popped one old frame and reset the live write/read pointers, never admitting fresh frames into the calculation.

## Fix and direct verification

On overflow, invalidate the measurement window and drain/discard the entire pending backlog. Equal pointers plus overflow mean 32 frames. Do not rewrite live pointers after draining; hardware clears its overflow count when complete frames are popped. Keep the startup retry, rate-limited communication-fault recovery, saturation/contact checks and fresh-window requirements. The library setup already clears FIFO; the extra startup clear remains removed.

The same normal MAX-only program was uploaded with this change. In the following 25-second capture, all 26 reports had nonzero red/IR. Accepted frames advanced from 525 at 21.413 seconds to 1152 at 46.465 seconds, approximately 25 frames/second. There was exactly one startup overflow event, 32 discarded old frames, no further overflow growth, zero gap resets, zero I2C errors, one initialization attempt and zero recovery attempts. This verifies that the software overflow/reset loop caused the observed zero-data state and that draining restored sustained raw acquisition on this board.

The final raw report was red=1193 and IR=973, below the configured contact threshold. No fresh pulse window or valid BPM/SpO2 was established in this capture. Finger placement confirmation was requested separately; absence of contact is not proof of a defective optical sensor. Pulse accuracy and the later all-sensor Vyana stage remain unverified.

## Checks and artifacts

52 native tests passed, including a new full-FIFO regression: discard all 32 old frames, perform no extra live pointer clear, withhold stale measurements, then accept a newly arrived frame. The production startup mock now models the vendor's own reset/clear. The MAX-only firmware built/uploaded successfully with flash hash verification. The full all-sensor target also built successfully (87,032 bytes static RAM, 1,262,132 bytes flash), without uploading it during this stage. Existing vendor-library warnings remain. `git diff --check` passed.

Ignored evidence: `.audit-runtime/esp32-setup/max-fifo-verify.log` / `.json`, `max-passive-counters.log` / `.json`, `max-no-duplicate-clear.log` / `.json`, and `max-drain-fix.log` / `.json`. The original pre-test flash backup remains private and unchanged. The board currently runs the corrected MAX-only program, not the temporary off/on/off diagnostic.

Manufacturer reference: [MAX30102 data sheet](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX30102.pdf), FIFO read/overflow behavior on pages 13-17. Software source: `src/sensors/MAX30102_Driver.h`; normal-default selection was preserved.

## Subsequent confirmed-fingertip capture

After the user confirmed fingertip placement, read 29 reports over 28 seconds without changing firmware, settings or resetting the board. Seven reports indicated contact, six had an algorithm-valid HR output (57-136 BPM) and five had an algorithm-valid SpO2 output (99-100%). Initial red/IR were approximately 199339/208883. This establishes that finger contact, acquisition and calculation can operate; the fluctuating HR outputs are not stable or clinically validated measurements.

Communication then dropped during the capture. Cumulative I/O faults rose from 0 to 26, recovery attempts reached 23 and initialization attempts reached 4 with one failure. The final report was initialized=false, present=false, with a short ID-register read at 0xff (0 of 1 byte) and null calculated values. Therefore the zero-data overflow/reset software issue was corrected in the earlier controlled capture, but intermittent communication remains unresolved under this finger test. No specific electrical, wiring or controller cause has been established. Evidence: ignored `.audit-runtime/esp32-setup/max-finger-confirmed.log` and `.json`.
