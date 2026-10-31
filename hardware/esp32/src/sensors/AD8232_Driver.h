#pragma once
#include <Arduino.h>
#include "../HardwareConfig.h"
#include "../MeasurementPolicy.h"
#include "../DiagnosticLog.h"

// Manufacturer references for this acquisition interface:
// https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html
// https://www.analog.com/media/en/technical-documentation/data-sheets/AD8232.pdf
// GPIO34 uses ADC1 on the original ESP32; either lead-off output HIGH means
// lead-off indicated. SDN bias depends on the actual breakout schematic.
constexpr uint8_t LO_PLUS = 35, LO_MINUS = 32, ECG_OUTPUT = 34;
#ifndef ECG_CAPTURE_SAMPLE
#define ECG_CAPTURE_SAMPLE(now,raw,plus,minus) ((void)0)
#endif
struct ECGReading {
  bool leadsOff = true;
  bool loPlus = true, loMinus = true;
  uint16_t raw = 0, minimum = 4095, maximum = 0;
  uint32_t millivolts = 0, samples = 0, clipped = 0, sampledAt = 0;
} ecg;

#if defined(ARDUINO_ARCH_ESP32)
portMUX_TYPE ecgStateMutex = portMUX_INITIALIZER_UNLOCKED;
#endif
class ECGStateGuard {
public:
  ECGStateGuard() {
#if defined(ARDUINO_ARCH_ESP32)
    portENTER_CRITICAL(&ecgStateMutex);
#endif
  }
  ~ECGStateGuard() {
#if defined(ARDUINO_ARCH_ESP32)
    portEXIT_CRITICAL(&ecgStateMutex);
#endif
  }
};

ECGReading snapshotAD8232(bool resetWindow = false) {
  ECGStateGuard guard;
  const ECGReading result = ecg;
  if (resetWindow) {
    ecg.minimum = 4095; ecg.maximum = 0; ecg.samples = ecg.clipped = 0;
  }
  return result;
}

void initAD8232() {
  pinMode(LO_PLUS, INPUT);
  pinMode(LO_MINUS, INPUT);
  pinMode(ECG_OUTPUT, INPUT);
  analogReadResolution(12);
  // The pinned Arduino-ESP32 core applies per-pin attenuation only after
  // analogRead attaches the ADC channel. Discard this setup conversion.
  (void)analogRead(ECG_OUTPUT);
  analogSetPinAttenuation(ECG_OUTPUT, ADC_11db);
  Serial.println("AD8232: real ADC1/GPIO34 signal and lead detection; rhythm unclassified.");
}
void pollAD8232(uint32_t now) {
  if (uint32_t(now - ecg.sampledAt) < ECG_SAMPLE_INTERVAL_MS) return;
  // Latch both inputs once for this observation, even when LO+ is already HIGH.
  // Consumers must use this snapshot rather than re-read GPIOs after the ADC.
  const bool plus = digitalRead(LO_PLUS) != 0, minus = digitalRead(LO_MINUS) != 0;
  const uint16_t raw = analogRead(ECG_OUTPUT);
  // A second ADC conversion provides a calibrated voltage estimate.
  const uint32_t millivolts = analogReadMilliVolts(ECG_OUTPUT);
  {
    // ADC conversions can block; protect only the short state copy/update.
    ECGStateGuard guard;
    ecg.sampledAt = now; ecg.loPlus = plus; ecg.loMinus = minus;
    ecg.leadsOff = plus || minus; ecg.raw = raw; ecg.millivolts = millivolts;
    if (!ecg.leadsOff) {
      if (raw < ecg.minimum) ecg.minimum = raw;
      if (raw > ecg.maximum) ecg.maximum = raw;
      ++ecg.samples;
      if (raw <= 5 || raw >= 4090) ++ecg.clipped;
    }
  }
  ECG_CAPTURE_SAMPLE(now,raw,plus,minus);
#if ECG_STREAM_SERIAL
  diagnosticPrintf("ECG,%lu,%u,%lu,%u", (unsigned long)now, ecg.raw,
                (unsigned long)ecg.millivolts, unsigned(ecg.leadsOff));
#endif
}
const char* readECGStatus() { return ecgLeadStatus(snapshotAD8232().leadsOff); }
void resetECGSummary() {
  snapshotAD8232(true);
}
