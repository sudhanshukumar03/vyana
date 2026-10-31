#pragma once
#include <Arduino.h>
#include <Wire.h>
#include <MAX30105.h>
#include <string.h>
#include "../optical/MaximAlgorithm.h"
#include "../HardwareConfig.h"
#include "../MeasurementPolicy.h"
#include "../DiagnosticLog.h"

MAX30105 particleSensor;
struct OpticalReading {
  bool initialized = false, present = false, contact = false, computed = false, needsReset = false;
  int32_t heartRate = 0, spo2 = 0;
  int8_t heartRateValid = 0, spo2Valid = 0;
  uint32_t red = 0, ir = 0, computedAt = 0, ioErrors = 0;
  uint32_t txErrors = 0, shortReads = 0, emptyReads = 0, pointerErrors = 0, clearErrors = 0;
  uint32_t initAttempts = 0, initFailures = 0, recoveryAttempts = 0;
  uint32_t busRestarts = 0, busRestartFailures = 0;
  uint32_t overflowEvents = 0, gapResets = 0, framesRead = 0, discardedFrames = 0;
  uint32_t lastInitAttempt = 0, lastRecoveryAttempt = 0;
  uint8_t consecutiveRecoveryFailures = 0;
  uint8_t errorStage = 0, errorRegister = 0, errorCode = 0, receivedBytes = 0;
  uint8_t expectedBytes = 0, errorValue = 0;
  uint8_t lastPointers[3]{};
  uint8_t lastOverflowPointers[3]{};
} optical;
uint32_t irBuffer[100]{}, redBuffer[100]{};
uint16_t opticalSamples = 0;
uint32_t opticalLastPoll = 0, opticalLastSample = 0;
constexpr uint8_t OPTICAL_ADDRESS = 0x57;
constexpr uint32_t OPTICAL_INIT_RETRY_MS = 2000, OPTICAL_FIFO_RETRY_MS = 100;
constexpr uint32_t OPTICAL_POLL_INTERVAL_MS = 10;
constexpr uint8_t OPTICAL_MAX_RECOVERY_FAILURES = 3;

// One coherent last-failure snapshot. Zero Wire code means no Wire code was
// available for that stage, not that a previous transaction's code applies.
void recordOpticalError(uint8_t stage, uint8_t reg, uint8_t code = 0,
                        uint8_t received = 0, uint8_t expected = 0, uint8_t value = 0) {
  optical.errorStage = stage; optical.errorRegister = reg; optical.errorCode = code;
  optical.receivedBytes = received; optical.expectedBytes = expected; optical.errorValue = value;
}

bool readOpticalBytes(uint8_t reg, uint8_t* bytes, uint8_t count, bool stopAfterRegister = false) {
  Wire.beginTransmission(OPTICAL_ADDRESS);
  Wire.write(reg);
  const uint8_t code = Wire.endTransmission(stopAfterRegister);
  if (code != 0) {
    ++optical.txErrors; recordOpticalError(1, reg, code, 0, count);
    return false;
  }
  const uint8_t received = Wire.requestFrom(OPTICAL_ADDRESS, count);
  if (received != count) {
    ++optical.shortReads; recordOpticalError(2, reg, 0, received, count);
    return false;
  }
  for (uint8_t i = 0; i < count; ++i) {
    const int value = Wire.read();
    if (value < 0) {
      ++optical.emptyReads; recordOpticalError(3, reg, 0, i, count);
      return false;
    }
    bytes[i] = uint8_t(value);
  }
  return true;
}
bool clearOpticalFIFO() {
  // Match the vendor's separate pointer writes, checking every transaction.
  for (uint8_t reg = 0x04; reg <= 0x06; ++reg) {
    Wire.beginTransmission(OPTICAL_ADDRESS);
    Wire.write(reg); Wire.write(uint8_t(0));
    const uint8_t code = Wire.endTransmission();
    if (code != 0) {
      ++optical.clearErrors; recordOpticalError(5, reg, code, 0, 2);
      return false;
    }
  }
  return true;
}
void resetOpticalWindow() {
  opticalSamples = 0;
  optical.computed = false;
  optical.heartRateValid = optical.spo2Valid = 0;
}
void invalidateOpticalIO() {
  ++optical.ioErrors;
  optical.present = optical.contact = false;
  resetOpticalWindow();
  optical.red = optical.ir = 0;
  optical.needsReset = true;
  optical.consecutiveRecoveryFailures = 0;
  optical.lastRecoveryAttempt = millis();
}
bool tryInitializeOptical() {
  ++optical.initAttempts;
  optical.initialized = optical.present = optical.contact = optical.needsReset = false;
  optical.red = optical.ir = 0;
  optical.consecutiveRecoveryFailures = 0;
  resetOpticalWindow();
  // Wire.begin() on an already started ESP32 bus is a no-op. Sensor setup
  // alone cannot recover a failed controller. Recreate it on bounded retries,
  // preserving the same pins, clock, counters and fresh-window requirement.
  if (optical.initAttempts > 1) {
    ++optical.busRestarts;
    const bool ended = Wire.end();
    const bool started = ended && Wire.begin(21, 22, MAX30102_I2C_HZ);
    Wire.setTimeOut(20);
    if (!started) {
      ++optical.busRestartFailures; ++optical.initFailures;
      recordOpticalError(9, 0, ended ? 2 : 1);
      optical.lastInitAttempt = millis();
      opticalLastPoll = opticalLastSample = millis();
      return false;
    }
  }
  uint8_t partId = 0;
  const bool idRead = readOpticalBytes(0xff, &partId, 1);
  bool configured = false;
  if (idRead && partId != 0x15) recordOpticalError(6, 0xff, 0, 1, 1, partId);
  if (idRead && partId == 0x15 && particleSensor.begin(Wire, MAX30102_I2C_HZ)) {
    // 100 SPS / 4 averaging = 25 FIFO samples/s, red + IR, 18-bit ADC.
    particleSensor.setup(60, 4, 2, 100, 411, 4096);
    particleSensor.disableFIFORollover();
    uint8_t configuration[3];
    const bool configurationRead = readOpticalBytes(0x08, &configuration[0], 1) &&
        readOpticalBytes(0x09, &configuration[1], 1) && readOpticalBytes(0x0a, &configuration[2], 1);
    if (configurationRead) {
      const uint8_t masks[] = {0xf0, 0xc7, 0x7f}, expected[] = {0x40, 0x03, 0x27};
      configured = true;
      for (uint8_t i = 0; i < 3; ++i) {
        if ((configuration[i] & masks[i]) != expected[i]) {
          recordOpticalError(7, uint8_t(0x08 + i), 0, 1, 1, configuration[i]);
          configured = false; break;
        }
      }
      // setup() already resets and clears the FIFO. A second pointer reset
      // after conversions have started can disrupt the live FIFO state.
    }
  } else if (idRead && partId == 0x15) {
    recordOpticalError(8, 0xff); // Library initialization failed after checked ID.
  }
  optical.initialized = optical.present = configured;
  optical.lastInitAttempt = millis();
  opticalLastPoll = opticalLastSample = millis();
  if (!configured) ++optical.initFailures;
  return configured;
}
void initMAX30102() {
  optical = OpticalReading{};
  const bool ready = tryInitializeOptical();
  Serial.println(ready ? "MAX30102: configured; collecting a fresh four-second window." :
                        "MAX30102: initialization failed; retrying every 2 seconds.");
}
void pollMAX30102(uint32_t now) {
  if (!optical.initialized) {
    if (uint32_t(now - optical.lastInitAttempt) >= OPTICAL_INIT_RETRY_MS) {
      if (tryInitializeOptical()) diagnosticLine("MAX30102: initialization recovered; fresh samples required.");
    }
    return;
  }
  const bool gap = uint32_t(now - opticalLastPoll) >= 120;
  // The FIFO produces one frame per 40 ms. Polling its pointers every loop
  // flooded the bus with empty reads. Check at 100 Hz and drain all pending
  // frames, leaving the other sensors' loop cadence unchanged.
  if (!optical.needsReset && !gap && uint32_t(now - opticalLastPoll) < OPTICAL_POLL_INTERVAL_MS) return;
  opticalLastPoll = now;
  if (optical.needsReset) {
    if (uint32_t(now - optical.lastRecoveryAttempt) < OPTICAL_FIFO_RETRY_MS) return;
    ++optical.recoveryAttempts;
    const bool cleared = clearOpticalFIFO(); // One attempt; never recursively clear again.
    optical.lastRecoveryAttempt = millis();
    if (cleared) {
      optical.needsReset = false; optical.present = true;
      optical.consecutiveRecoveryFailures = 0;
      opticalLastPoll = opticalLastSample = millis();
    } else {
      ++optical.ioErrors;
      if (++optical.consecutiveRecoveryFailures >= OPTICAL_MAX_RECOVERY_FAILURES) {
        optical.initialized = optical.present = optical.needsReset = false;
        optical.lastInitAttempt = millis();
      }
    }
    return; // Never append data until a failed/partial read has been flushed.
  }
  if (gap) {
    ++optical.gapResets;
    optical.contact = false;
    resetOpticalWindow();
    if (!clearOpticalFIFO()) invalidateOpticalIO();
    return;
  }
  uint8_t pointers[3];
  if (!readOpticalBytes(0x04, &pointers[0], 1) || !readOpticalBytes(0x05, &pointers[1], 1) ||
      !readOpticalBytes(0x06, &pointers[2], 1)) { invalidateOpticalIO(); return; }
  optical.present = true;
  memcpy(optical.lastPointers, pointers, sizeof(pointers));
  if ((pointers[0] | pointers[1] | pointers[2]) & 0xe0) {
    ++optical.pointerErrors;
    for (uint8_t i = 0; i < 3; ++i)
      if (pointers[i] & 0xe0) { recordOpticalError(4, uint8_t(0x04 + i), 0, 1, 1, pointers[i]); break; }
    invalidateOpticalIO(); return;
  }
  if (pointers[1]) { // FIFO overflow means a discontinuous acquisition window.
    ++optical.overflowEvents;
    memcpy(optical.lastOverflowPointers, pointers, sizeof(pointers));
    optical.contact = false;
    resetOpticalWindow();
    // Drain the entire discontinuous backlog, then collect only fresh data.
    // Rewriting active pointers here caused a repeated overflow/reset loop on
    // the board. Popping complete frames clears OVF_COUNTER in hardware.
    uint8_t count = uint8_t((pointers[0] - pointers[2] + 32) % 32);
    if (!count) count = 32; // A full FIFO can have equal read/write pointers.
    for (uint8_t i = 0; i < count; ++i) {
      uint8_t discarded[6];
      if (!readOpticalBytes(0x07, discarded, 6, true)) { invalidateOpticalIO(); return; }
      ++optical.discardedFrames;
    }
    return;
  }
  const uint8_t count = (pointers[0] - pointers[2] + 32) % 32;
  // Read checked hardware FIFO frames directly. The library's four-slot
  // software FIFO can expose the previous sample and silently lose frames.
  for (uint8_t sample = 0; sample < count; ++sample) {
    uint8_t frame[6];
    // The vendor FIFO reader sends STOP after selecting FIFO_DATA.
    if (!readOpticalBytes(0x07, frame, 6, true)) { invalidateOpticalIO(); return; }
    ++optical.framesRead;
    optical.red = ((uint32_t(frame[0]) << 16) | (uint32_t(frame[1]) << 8) | frame[2]) & 0x3ffff;
    optical.ir = ((uint32_t(frame[3]) << 16) | (uint32_t(frame[4]) << 8) | frame[5]) & 0x3ffff;
    opticalLastSample = now;
    optical.contact = optical.ir >= MAX30102_MIN_IR && optical.red > 0 &&
                      optical.ir < 262000 && optical.red < 262000;
    if (!optical.contact) { resetOpticalWindow(); continue; }
    irBuffer[opticalSamples] = optical.ir;
    redBuffer[opticalSamples++] = optical.red;
    if (opticalSamples == 100) {
      optical_algorithm::calculate(irBuffer, 100, redBuffer, &optical.spo2,
          &optical.spo2Valid, &optical.heartRate, &optical.heartRateValid);
      optical.computed = true;
      optical.computedAt = now;
      memmove(irBuffer, irBuffer + 25, 75 * sizeof(uint32_t));
      memmove(redBuffer, redBuffer + 25, 75 * sizeof(uint32_t));
      opticalSamples = 75;
    }
  }
  if (uint32_t(now - opticalLastSample) > 200) {
    optical.contact = false;
    resetOpticalWindow();
  }
}
bool opticalWindowFresh(uint32_t now) {
  return optical.present && optical.contact && optical.computed &&
         uint32_t(now - optical.computedAt) <= 2500;
}
bool opticalHeartRateReady(uint32_t now) {
  return opticalWindowFresh(now) && optical.heartRateValid &&
         optical.heartRate > 0 && optical.heartRate <= 300;
}
bool opticalSpO2Ready(uint32_t now) {
  return opticalWindowFresh(now) && optical.spo2Valid && optical.spo2 >= 0 && optical.spo2 <= 100;
}
bool opticalReadingReady(uint32_t now) {
  return opticalHeartRateReady(now) && opticalSpO2Ready(now);
}
