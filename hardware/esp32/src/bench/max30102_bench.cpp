// Standalone MAX30102 acquisition and calculation. Fixed pins/settings, no
// Wi-Fi, API credentials or other sensor drivers. No generated vital values.
#include <Arduino.h>
#include <Wire.h>
#include "../sensors/MAX30102_Driver.h"

uint32_t benchLastReport = 0;

// This sketch has one writer and no application diagnostic task.
void diagnosticLine(const char* line) { Serial.println(line); }

void printMAXBenchReport(uint32_t now) {
  const bool fresh = optical.present && optical.contact && optical.computed &&
                     uint32_t(now - optical.computedAt) <= 2500;
  const bool hrValid = fresh && optical.heartRateValid && optical.heartRate > 0 && optical.heartRate <= 300;
  const bool spo2Valid = fresh && optical.spo2Valid && optical.spo2 >= 0 && optical.spo2 <= 100;
  char hr[16] = "null", oxygen[16] = "null";
  if (hrValid) snprintf(hr, sizeof(hr), "%ld", (long)optical.heartRate);
  if (spo2Valid) snprintf(oxygen, sizeof(oxygen), "%ld", (long)optical.spo2);
  Serial.printf("{\"sensor\":\"MAX30102\",\"uptime_ms\":%lu,\"initialized\":%s,\"present\":%s,"
                "\"contact\":%s,\"red\":%lu,\"ir\":%lu,\"window_samples\":%u,"
                "\"heart_rate_bpm\":%s,\"heart_rate_valid\":%s,\"spo2_percent\":%s,\"spo2_valid\":%s,"
                "\"init_attempts\":%lu,\"init_failures\":%lu,\"recovery_attempts\":%lu,\"io_errors\":%lu,"
                "\"bus_restarts\":%lu,\"bus_restart_failures\":%lu,"
                "\"error_stage\":%u,\"error_register\":%u,\"wire_error\":%u,"
                "\"received_bytes\":%u,\"expected_bytes\":%u,\"error_value\":%u,"
                "\"fifo_write\":%u,\"fifo_overflow\":%u,\"fifo_read\":%u,"
                "\"overflow_events\":%lu,\"gap_resets\":%lu,\"frames_read\":%lu,\"discarded_frames\":%lu,"
                "\"last_overflow_write\":%u,\"last_overflow_count\":%u,\"last_overflow_read\":%u}",
                (unsigned long)now, optical.initialized ? "true" : "false", optical.present ? "true" : "false",
                optical.contact ? "true" : "false", (unsigned long)optical.red, (unsigned long)optical.ir,
                unsigned(opticalSamples), hr, hrValid ? "true" : "false", oxygen, spo2Valid ? "true" : "false",
                (unsigned long)optical.initAttempts, (unsigned long)optical.initFailures,
                (unsigned long)optical.recoveryAttempts, (unsigned long)optical.ioErrors,
                (unsigned long)optical.busRestarts, (unsigned long)optical.busRestartFailures,
                unsigned(optical.errorStage), unsigned(optical.errorRegister), unsigned(optical.errorCode),
                unsigned(optical.receivedBytes), unsigned(optical.expectedBytes), unsigned(optical.errorValue),
                unsigned(optical.lastPointers[0]), unsigned(optical.lastPointers[1]), unsigned(optical.lastPointers[2]),
                (unsigned long)optical.overflowEvents, (unsigned long)optical.gapResets, (unsigned long)optical.framesRead,
                (unsigned long)optical.discardedFrames, unsigned(optical.lastOverflowPointers[0]),
                unsigned(optical.lastOverflowPointers[1]), unsigned(optical.lastOverflowPointers[2]));
  Serial.println("");
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("MAX30102 ONLY: SDA=D21 SCL=D22; no Wi-Fi or other sensors.");
  Serial.printf("Fixed I2C clock: %lu Hz. HR/SpO2 stay null until calculated and valid.\n",
                (unsigned long)MAX30102_I2C_HZ);
  Wire.begin(21, 22, MAX30102_I2C_HZ);
  Wire.setTimeOut(20);
  initMAX30102();
  benchLastReport = millis();
}

void loop() {
  pollMAX30102(millis());
  const uint32_t now = millis();
  if (uint32_t(now - benchLastReport) >= 1000) {
    benchLastReport = now;
    printMAXBenchReport(now);
  }
  delay(1);
}
