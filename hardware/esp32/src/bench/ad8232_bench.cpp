// Standalone AD8232 electrical bench. No Wi-Fi, API, private config or other
// sensor drivers. Computer USB must only be used with electrodes off the body.
#include <Arduino.h>
#include <stdarg.h>
#include "../sensors/AD8232_Driver.h"

uint32_t lastReport = 0, windowSamples = 0, windowClipped = 0;
uint32_t windowLeadsOff = 0, windowMaxGap = 0, lastSample = 0;
uint16_t windowMinimum = 4095, windowMaximum = 0;

void diagnosticLine(const char* line) { Serial.println(line); }
void diagnosticPrintf(const char* format, ...) {
  char line[128];
  va_list args;
  va_start(args, format);
  vsnprintf(line, sizeof(line), format, args);
  va_end(args);
  Serial.println(line);
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("AD8232 ONLY: OUT=GPIO34 LO+=GPIO35 LO-=GPIO32, 3.3V/GND.");
  Serial.println("USB bench: electrodes OFF BODY. ECG CSV is raw input, not a verified rhythm.");
  Serial.println("ECG,uptime_ms,raw_adc,separate_adc_millivolts,leads_off");
  initAD8232();
  lastReport = millis();
}

void loop() {
  const uint32_t previous = ecg.sampledAt;
  pollAD8232(millis());
  if (ecg.sampledAt != previous) {
    const uint32_t gap = uint32_t(ecg.sampledAt - lastSample);
    if (lastSample && gap > windowMaxGap) windowMaxGap = gap;
    lastSample = ecg.sampledAt;
    ++windowSamples;
    if (ecg.leadsOff) ++windowLeadsOff;
    if (ecg.raw <= 5 || ecg.raw >= 4090) ++windowClipped;
    if (ecg.raw < windowMinimum) windowMinimum = ecg.raw;
    if (ecg.raw > windowMaximum) windowMaximum = ecg.raw;
  }
  const uint32_t now = millis();
  if (uint32_t(now - lastReport) >= 1000) {
    Serial.printf("{\"sensor\":\"AD8232\",\"uptime_ms\":%lu,\"window_ms\":%lu,"
                  "\"raw_adc\":%u,\"millivolts\":%lu,\"lo_plus\":%d,\"lo_minus\":%d,"
                  "\"status\":\"%s\",\"samples\":%lu,\"leads_off_samples\":%lu,"
                  "\"min_adc\":%u,\"max_adc\":%u,\"clipped_samples\":%lu,\"max_gap_ms\":%lu}\n",
                  (unsigned long)now, (unsigned long)uint32_t(now - lastReport),
                  unsigned(ecg.raw), (unsigned long)ecg.millivolts,
                  int(ecg.loPlus), int(ecg.loMinus), readECGStatus(),
                  (unsigned long)windowSamples, (unsigned long)windowLeadsOff,
                  unsigned(windowMinimum), unsigned(windowMaximum),
                  (unsigned long)windowClipped, (unsigned long)windowMaxGap);
    lastReport = now;
    windowSamples = windowClipped = windowLeadsOff = windowMaxGap = 0;
    windowMinimum = 4095;
    windowMaximum = 0;
    resetECGSummary();
  }
  delay(1);
}
