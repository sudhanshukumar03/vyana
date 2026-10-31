#include <unity.h>
#include <stdarg.h>
#include <math.h>
#include <random>
#include "../../src/sensors/MAX30102_Driver.h"
#include "../../src/sensors/DS18B20_Driver.h"
#include "../../src/sensors/AD8232_Driver.h"
// Native environments deliberately do not build main.cpp or Arduino sources.
#include "../../src/optical/MaximAlgorithm.cpp"

std::vector<std::string> diagnosticLines;
void diagnosticLine(const char* line) { diagnosticLines.emplace_back(line); }
void diagnosticPrintf(const char* format, ...) {
  char line[256]; va_list args; va_start(args, format);
  vsnprintf(line, sizeof(line), format, args); va_end(args); diagnosticLine(line);
}
void setUp() {
  testMillis = 0; Wire = TwoWire{}; testProbe = TestProbe{};
  memset(testPins, 0, sizeof(testPins)); testADC = 2048; testMillivolts = 1650;
  ecg = ECGReading{}; diagnosticLines.clear();
  initMAX30102(); initDS18B20(); initAD8232();
}
void tearDown() {}
void pollAt(uint32_t now) { testMillis = now; pollMAX30102(now); }
void fifo_returns_current_frame_in_order() {
  TEST_ASSERT_EQUAL(1, Wire.clearAttempts); // Vendor startup clear only; no second live reset.
  Wire.push(101000, 121000); Wire.push(102000, 122000); Wire.push(103000, 123000);
  pollAt(40);
  TEST_ASSERT_EQUAL(3, opticalSamples);
  TEST_ASSERT_EQUAL(121000, irBuffer[0]); TEST_ASSERT_EQUAL(122000, irBuffer[1]);
  TEST_ASSERT_EQUAL(123000, irBuffer[2]); TEST_ASSERT_EQUAL(103000, optical.red);
}
void short_reads_and_nacks_invalidate_immediately() {
  Wire.push(101000, 121000); pollAt(40);
  optical.computed = true; optical.heartRateValid = optical.spo2Valid = 1;
  optical.heartRate = 72; optical.spo2 = 98; optical.computedAt = 40;
  TEST_ASSERT_TRUE(opticalReadingReady(40));
  Wire.push(102000, 122000); Wire.shortRegister = 0x07; pollAt(80);
  TEST_ASSERT_FALSE(opticalReadingReady(80)); TEST_ASSERT_EQUAL(0, opticalSamples);
  TEST_ASSERT_FALSE(optical.present); TEST_ASSERT_EQUAL(1, optical.ioErrors);
  TEST_ASSERT_EQUAL(1, optical.shortReads); TEST_ASSERT_EQUAL(2, optical.errorStage);
  TEST_ASSERT_EQUAL(0x07, optical.errorRegister); TEST_ASSERT_EQUAL(5, optical.receivedBytes);
  Wire.shortRegister = -1; Wire.nack = true; pollAt(180);
  TEST_ASSERT_EQUAL(2, optical.ioErrors); TEST_ASSERT_FALSE(optical.present);
  TEST_ASSERT_EQUAL(0, optical.txErrors); TEST_ASSERT_EQUAL(1, optical.clearErrors);
}
void falsely_reported_byte_count_is_rejected() {
  Wire.missingByte = true; pollAt(40);
  TEST_ASSERT_EQUAL(1, optical.ioErrors); TEST_ASSERT_FALSE(optical.present);
  TEST_ASSERT_EQUAL(1, optical.emptyReads); TEST_ASSERT_EQUAL(3, optical.errorStage);
}
void optical_polling_is_bounded_without_losing_queued_frames() {
  Wire.push(100000, 120000);
  for (uint32_t t = 1; t < 10; ++t) pollAt(t);
  TEST_ASSERT_EQUAL(0, optical.framesRead); TEST_ASSERT_EQUAL(1, Wire.frames.size());
  pollAt(10); TEST_ASSERT_EQUAL(1, optical.framesRead);
  Wire.push(100100, 120100); pollAt(19);
  TEST_ASSERT_EQUAL(1, optical.framesRead);
  Wire.push(100200, 120200); pollAt(20);
  TEST_ASSERT_EQUAL(3, optical.framesRead); TEST_ASSERT_EQUAL(3, opticalSamples);
  TEST_ASSERT_EQUAL(120200, irBuffer[2]); TEST_ASSERT_EQUAL(0, optical.gapResets);
}
void failed_flush_requires_resynchronization_before_more_samples() {
  Wire.failClear = true; Wire.shortRegister = 0x07;
  Wire.push(100000, 120000); pollAt(40); TEST_ASSERT_TRUE(optical.needsReset);
  Wire.shortRegister = -1; Wire.push(100000, 120000); pollAt(80);
  TEST_ASSERT_EQUAL(0, opticalSamples); TEST_ASSERT_TRUE(optical.needsReset);
  TEST_ASSERT_EQUAL(0, optical.recoveryAttempts);
  pollAt(140); TEST_ASSERT_EQUAL(1, optical.recoveryAttempts);
  TEST_ASSERT_TRUE(optical.needsReset);
  Wire.failClear = false; pollAt(240); TEST_ASSERT_FALSE(optical.needsReset);
  TEST_ASSERT_EQUAL(0, opticalSamples);
  Wire.push(100000, 120000); pollAt(280); TEST_ASSERT_EQUAL(1, opticalSamples);
  Wire.push(0x3ffff, 120000); pollAt(320);
  TEST_ASSERT_EQUAL(0, opticalSamples); TEST_ASSERT_FALSE(optical.contact);
}
void fifo_overflow_and_scheduling_gap_restart_window() {
  Wire.push(101000, 121000); pollAt(40); TEST_ASSERT_EQUAL(1, opticalSamples);
  Wire.push(99000, 119000); Wire.registers[5] = 1; pollAt(80);
  TEST_ASSERT_EQUAL(0, opticalSamples); TEST_ASSERT_EQUAL(0, Wire.registers[5]);
  Wire.push(101000, 121000); pollAt(120); TEST_ASSERT_EQUAL(1, opticalSamples);
  Wire.push(102000, 122000); pollAt(400);
  TEST_ASSERT_EQUAL(0, opticalSamples); TEST_ASSERT_FALSE(optical.contact);
}
void overflow_recovery_pops_old_frame_and_requires_fresh_data() {
  Wire.stickyOverflow = true;
  Wire.push(101000, 121000); Wire.registers[5] = 31;
  pollAt(40);
  TEST_ASSERT_EQUAL(0, Wire.registers[5]);
  TEST_ASSERT_EQUAL(0, opticalSamples); TEST_ASSERT_FALSE(optical.computed);
  TEST_ASSERT_FALSE(optical.contact); TEST_ASSERT_EQUAL(0, optical.ioErrors);
  Wire.push(102000, 122000); pollAt(80);
  TEST_ASSERT_EQUAL(1, opticalSamples); TEST_ASSERT_EQUAL(122000, irBuffer[0]);
}
void full_fifo_overflow_is_drained_without_rewriting_live_pointers() {
  for (unsigned i = 0; i < 32; ++i) Wire.push(99000 + i, 119000 + i);
  Wire.registers[5] = 31; Wire.stickyOverflow = true;
  const unsigned clears = Wire.clearAttempts;
  pollAt(40);
  TEST_ASSERT_TRUE(Wire.frames.empty()); TEST_ASSERT_EQUAL(0, Wire.registers[5]);
  TEST_ASSERT_EQUAL(clears, Wire.clearAttempts); TEST_ASSERT_EQUAL(32, optical.discardedFrames);
  TEST_ASSERT_EQUAL(0, optical.framesRead); TEST_ASSERT_EQUAL(0, opticalSamples);
  TEST_ASSERT_FALSE(opticalReadingReady(40));
  Wire.push(101000, 121000); pollAt(80);
  TEST_ASSERT_EQUAL(1, optical.framesRead); TEST_ASSERT_EQUAL(1, opticalSamples);
  TEST_ASSERT_EQUAL(121000, irBuffer[0]); TEST_ASSERT_EQUAL(clears, Wire.clearAttempts);
}
void finger_removal_and_recovery_require_fresh_window() {
  for (uint32_t i = 1; i <= 90; ++i) { Wire.push(100000, 120000); pollAt(i * 40); }
  Wire.push(0, 0); pollAt(3640); TEST_ASSERT_EQUAL(0, opticalSamples);
  TEST_ASSERT_FALSE(optical.computed); TEST_ASSERT_FALSE(optical.contact);
  for (uint32_t i = 1; i <= 99; ++i) { Wire.push(100000, 120000); pollAt(3640 + i * 40); }
  TEST_ASSERT_FALSE(optical.computed);
  Wire.push(100000, 120000); pollAt(7640);
  TEST_ASSERT_TRUE(optical.computed); TEST_ASSERT_EQUAL(75, opticalSamples);
  TEST_ASSERT_FALSE(opticalReadingReady(7640)); // Flat light is not a pulse.
}
void absent_and_misconfigured_optical_sensor_stay_unavailable() {
  Wire.present = false; initMAX30102(); TEST_ASSERT_FALSE(optical.initialized);
  pollAt(40); TEST_ASSERT_FALSE(opticalReadingReady(40));
  Wire = TwoWire{}; Wire.badConfiguration = true; initMAX30102();
  TEST_ASSERT_FALSE(optical.initialized); TEST_ASSERT_FALSE(optical.present);
}
void stalled_optical_sensor_and_rollover() {
  testMillis = UINT32_MAX - 59; initMAX30102();
  Wire.push(100000, 120000); pollAt(UINT32_MAX - 19);
  Wire.push(100000, 120000); pollAt(20); TEST_ASSERT_EQUAL(2, opticalSamples);
  for (uint32_t t = 60; t <= 260; t += 40) pollAt(t);
  TEST_ASSERT_FALSE(optical.contact); TEST_ASSERT_EQUAL(0, opticalSamples);
}
void failed_startup_retries_without_resetting_counters_or_accepting_old_samples() {
  testMillis = 100; Wire.present = false; initMAX30102();
  TEST_ASSERT_EQUAL(1, optical.initAttempts); TEST_ASSERT_EQUAL(1, optical.initFailures);
  Wire.present = true; Wire.push(100000, 120000);
  pollAt(2099); TEST_ASSERT_EQUAL(1, optical.initAttempts);
  pollAt(2100); TEST_ASSERT_TRUE(optical.initialized);
  TEST_ASSERT_EQUAL(2, optical.initAttempts); TEST_ASSERT_EQUAL(1, optical.initFailures);
  TEST_ASSERT_EQUAL(0, opticalSamples); TEST_ASSERT_FALSE(opticalReadingReady(2100));
  Wire.push(100000, 120000); pollAt(2140); TEST_ASSERT_EQUAL(1, opticalSamples);
}
void retry_intervals_survive_millis_rollover() {
  testMillis = UINT32_MAX - 999; Wire.present = false; initMAX30102();
  Wire.present = true; pollAt(999); TEST_ASSERT_EQUAL(1, optical.initAttempts);
  pollAt(1000); TEST_ASSERT_EQUAL(2, optical.initAttempts); TEST_ASSERT_TRUE(optical.initialized);
  Wire.nack = true; pollAt(UINT32_MAX - 49);
  const unsigned attempts = Wire.clearAttempts;
  pollAt(49); TEST_ASSERT_EQUAL(attempts, Wire.clearAttempts);
  pollAt(50); TEST_ASSERT_EQUAL(attempts + 1, Wire.clearAttempts);
}
void reset_recovery_is_rate_limited_and_escalates_after_three_failures() {
  const unsigned attempts = Wire.clearAttempts;
  Wire.nack = true; pollAt(40);
  TEST_ASSERT_EQUAL(attempts, Wire.clearAttempts); // Failed read does not recursively reset.
  pollAt(139); TEST_ASSERT_EQUAL(attempts, Wire.clearAttempts);
  pollAt(140); TEST_ASSERT_EQUAL(attempts + 1, Wire.clearAttempts);
  pollAt(141); TEST_ASSERT_EQUAL(attempts + 1, Wire.clearAttempts);
  pollAt(240); pollAt(340);
  TEST_ASSERT_EQUAL(attempts + 3, Wire.clearAttempts);
  TEST_ASSERT_EQUAL(3, optical.recoveryAttempts); TEST_ASSERT_EQUAL(3, optical.clearErrors);
  TEST_ASSERT_FALSE(optical.initialized);
  Wire.nack = false; pollAt(2339); TEST_ASSERT_FALSE(optical.initialized);
  pollAt(2340); TEST_ASSERT_TRUE(optical.initialized);
  TEST_ASSERT_EQUAL(2, optical.initAttempts); TEST_ASSERT_EQUAL(3, optical.recoveryAttempts);
  TEST_ASSERT_FALSE(opticalReadingReady(2340));
}
void diagnostic_snapshot_never_reuses_another_failures_code_or_count() {
  uint8_t bytes[6];
  Wire.nack = true; TEST_ASSERT_FALSE(readOpticalBytes(0x04, bytes, 1));
  TEST_ASSERT_EQUAL(2, optical.errorCode); TEST_ASSERT_EQUAL(1, optical.expectedBytes);
  Wire.nack = false; Wire.shortRegister = 0x07; Wire.push(100000, 120000);
  TEST_ASSERT_FALSE(readOpticalBytes(0x07, bytes, 6, true));
  TEST_ASSERT_EQUAL(2, optical.errorStage); TEST_ASSERT_EQUAL(0, optical.errorCode);
  TEST_ASSERT_EQUAL(5, optical.receivedBytes); TEST_ASSERT_EQUAL(6, optical.expectedBytes);
  Wire.shortRegister = -1; Wire.missingByte = true;
  TEST_ASSERT_FALSE(readOpticalBytes(0x04, bytes, 1));
  TEST_ASSERT_EQUAL(3, optical.errorStage); TEST_ASSERT_EQUAL(0, optical.receivedBytes);
  TEST_ASSERT_EQUAL(1, optical.expectedBytes); TEST_ASSERT_EQUAL(0, optical.errorValue);
}
void stuck_controller_is_restarted_only_after_bounded_recovery_and_requires_new_samples() {
  Wire.push(100000, 120000); pollAt(40);
  Wire.controllerStuck = true; pollAt(80);
  pollAt(180); pollAt(280); pollAt(380);
  TEST_ASSERT_FALSE(optical.initialized); TEST_ASSERT_EQUAL(0, Wire.endCalls);
  pollAt(2379); TEST_ASSERT_EQUAL(0, Wire.endCalls);
  pollAt(2380);
  TEST_ASSERT_TRUE(optical.initialized); TEST_ASSERT_EQUAL(1, Wire.endCalls);
  TEST_ASSERT_EQUAL(1, optical.busRestarts); TEST_ASSERT_EQUAL(0, optical.busRestartFailures);
  TEST_ASSERT_EQUAL(21, Wire.sdaPin); TEST_ASSERT_EQUAL(22, Wire.sclPin);
  TEST_ASSERT_EQUAL(MAX30102_I2C_HZ, Wire.clockHz);
  TEST_ASSERT_EQUAL(4, optical.ioErrors); TEST_ASSERT_EQUAL(3, optical.recoveryAttempts);
  TEST_ASSERT_EQUAL(0, opticalSamples); TEST_ASSERT_FALSE(opticalReadingReady(2380));
  Wire.push(100100, 120100); pollAt(2420);
  TEST_ASSERT_EQUAL(1, opticalSamples); TEST_ASSERT_EQUAL(120100, irBuffer[0]);
}
void failed_bus_restart_stays_unavailable_and_retries_at_two_seconds() {
  Wire.present = false; initMAX30102(); Wire.present = true; Wire.failEnd = true;
  pollAt(2000);
  TEST_ASSERT_FALSE(optical.initialized); TEST_ASSERT_EQUAL(9, optical.errorStage);
  TEST_ASSERT_EQUAL(1, optical.errorCode); TEST_ASSERT_EQUAL(1, optical.busRestartFailures);
  TEST_ASSERT_EQUAL(0, Wire.beginCalls);
  Wire.failEnd = false; Wire.failBegin = true; pollAt(3999);
  TEST_ASSERT_EQUAL(1, Wire.endCalls);
  pollAt(4000); TEST_ASSERT_EQUAL(2, optical.errorCode);
  TEST_ASSERT_EQUAL(2, optical.busRestartFailures); TEST_ASSERT_FALSE(optical.initialized);
  Wire.failBegin = false; pollAt(6000); TEST_ASSERT_TRUE(optical.initialized);
  TEST_ASSERT_EQUAL(3, optical.busRestarts); TEST_ASSERT_EQUAL(2, optical.busRestartFailures);
  TEST_ASSERT_FALSE(opticalReadingReady(6000));
}
void wrong_identity_and_configuration_are_reported_and_can_recover() {
  Wire.registers[0xff] = 0xff; initMAX30102();
  TEST_ASSERT_FALSE(optical.initialized); TEST_ASSERT_EQUAL(6, optical.errorStage);
  TEST_ASSERT_EQUAL(0xff, optical.errorValue);
  Wire.registers[0xff] = 0x15; Wire.badConfiguration = true; pollAt(2000);
  TEST_ASSERT_FALSE(optical.initialized); TEST_ASSERT_EQUAL(7, optical.errorStage);
  TEST_ASSERT_EQUAL(0x0a, optical.errorRegister); TEST_ASSERT_EQUAL(0, optical.errorCode);
  Wire.badConfiguration = false; pollAt(4000); TEST_ASSERT_TRUE(optical.initialized);
  TEST_ASSERT_EQUAL(3, optical.initAttempts); TEST_ASSERT_EQUAL(2, optical.initFailures);
}
void temperature_waits_for_completed_conversion() {
  testMillis = 999; pollDS18B20(999);
  TEST_ASSERT_EQUAL(0, testProbe.reads); TEST_ASSERT_FALSE(temperature.converted);
  testProbe.complete = false; testMillis = 1000; pollDS18B20(1000);
  TEST_ASSERT_EQUAL(0, testProbe.reads); TEST_ASSERT_FALSE(temperatureReadingReady(1000));
  testProbe.complete = true; testMillis = 2000; pollDS18B20(2000);
  TEST_ASSERT_EQUAL(1, testProbe.reads); TEST_ASSERT_TRUE(temperatureReadingReady(2000));
  TEST_ASSERT_FLOAT_WITHIN(.01, 36.5, temperature.celsius);
}
void temperature_disconnect_recovery_and_errors() {
  testMillis = 1000; pollDS18B20(1000); TEST_ASSERT_TRUE(temperatureReadingReady(1000));
  testProbe.found = false; testMillis = 2000; pollDS18B20(2000);
  TEST_ASSERT_FALSE(temperatureReadingReady(2000)); TEST_ASSERT_TRUE(isnan(temperature.celsius));
  testProbe.found = true; testMillis = 3000; pollDS18B20(3000);
  TEST_ASSERT_FALSE(temperature.converted); // Request restarted, not yet completed.
  testMillis = 4000; pollDS18B20(4000); TEST_ASSERT_TRUE(temperatureReadingReady(4000));
  testProbe.celsius = 85; testMillis = 5000; pollDS18B20(5000);
  TEST_ASSERT_FALSE(temperatureReadingReady(5000));
  testProbe.celsius = -127; testMillis = 6000; pollDS18B20(6000);
  TEST_ASSERT_FALSE(temperature.converted); TEST_ASSERT_TRUE(isnan(temperature.celsius));
}
void absent_wrong_family_and_failed_conversion_request() {
  testProbe.found = false; initDS18B20(); TEST_ASSERT_FALSE(temperature.initialized);
  testProbe.found = true; testProbe.family = 0x10; initDS18B20();
  TEST_ASSERT_FALSE(temperature.initialized);
  testProbe.family = 0x28; testProbe.requestSuccess = false; initDS18B20();
  TEST_ASSERT_FALSE(temperature.pending); TEST_ASSERT_FALSE(temperature.present);
  testProbe.requestSuccess = true; testProbe.resolutionSuccess = false; initDS18B20();
  TEST_ASSERT_FALSE(temperature.initialized); TEST_ASSERT_FALSE(temperature.present);
}
void temperature_rollover_keeps_conversion_delay() {
  testMillis = UINT32_MAX - 499; initDS18B20();
  testMillis = 499; pollDS18B20(499); TEST_ASSERT_FALSE(temperature.converted);
  testMillis = 500; pollDS18B20(500); TEST_ASSERT_TRUE(temperatureReadingReady(500));
}
void temperature_absent_at_boot_recovers_with_bounded_discovery() {
  testMillis=UINT32_MAX-999; testProbe.found=false; initDS18B20();
  testProbe.found=true; testMillis=999; pollDS18B20(999);
  TEST_ASSERT_FALSE(temperature.initialized);
  testMillis=1000; pollDS18B20(1000);
  TEST_ASSERT_TRUE(temperature.initialized); TEST_ASSERT_TRUE(temperature.pending);
  TEST_ASSERT_FALSE(temperatureReadingReady(1000)); TEST_ASSERT_EQUAL(0,testProbe.reads);
  testMillis=1999; pollDS18B20(1999); TEST_ASSERT_EQUAL(0,testProbe.reads);
  testMillis=2000; pollDS18B20(2000); TEST_ASSERT_TRUE(temperatureReadingReady(2000));
}
void ecg_applies_pin_attenuation_to_an_initialized_channel() {
  testADCChannelInitialized[ECG_OUTPUT] = false;
  testADCPinAttenuationApplied[ECG_OUTPUT] = false;
  testADCUninitializedAttenuationCalls = 0;
  initAD8232();
  TEST_ASSERT_EQUAL(0, testADCUninitializedAttenuationCalls);
  TEST_ASSERT_TRUE(testADCPinAttenuationApplied[ECG_OUTPUT]);
  // The setup conversion initializes hardware; it is not a published sample.
  TEST_ASSERT_EQUAL(0, ecg.sampledAt);
  TEST_ASSERT_EQUAL(0, ecg.samples);
  TEST_ASSERT_TRUE(diagnosticLines.empty());
}
void ecg_snapshot_reset_keeps_new_samples_in_next_window() {
  testADC=1000; pollAD8232(4); testADC=4095; pollAD8232(8);
  const ECGReading first=snapshotAD8232(true);
  TEST_ASSERT_EQUAL(2,first.samples); TEST_ASSERT_EQUAL(1,first.clipped);
  TEST_ASSERT_EQUAL(1000,first.minimum); TEST_ASSERT_EQUAL(4095,first.maximum);
  testADC=2000; pollAD8232(12);
  const ECGReading second=snapshotAD8232();
  TEST_ASSERT_EQUAL(1,second.samples); TEST_ASSERT_EQUAL(0,second.clipped);
  TEST_ASSERT_EQUAL(2000,second.minimum); TEST_ASSERT_EQUAL(2000,second.maximum);
  TEST_ASSERT_EQUAL(2,first.samples); TEST_ASSERT_EQUAL(8,first.sampledAt);
}
void ecg_leads_clipping_and_csv() {
  testPins[35] = 1; pollAD8232(4);
  TEST_ASSERT_EQUAL_STRING("Leads Off", readECGStatus()); TEST_ASSERT_EQUAL(0, ecg.samples);
  testPins[35] = 0; testADC = 0; pollAD8232(8);
  testADC = 4095; pollAD8232(12);
  TEST_ASSERT_EQUAL_STRING("Unknown", readECGStatus()); TEST_ASSERT_EQUAL(2, ecg.samples);
  TEST_ASSERT_EQUAL(2, ecg.clipped); TEST_ASSERT_EQUAL(0, ecg.minimum); TEST_ASSERT_EQUAL(4095, ecg.maximum);
  TEST_ASSERT_EQUAL_STRING("ECG,12,4095,1650,0", diagnosticLines.back().c_str());
  resetECGSummary(); TEST_ASSERT_EQUAL(0, ecg.samples); TEST_ASSERT_EQUAL(0, ecg.clipped);
}
void ecg_lead_snapshot_survives_pin_changes_until_next_sample() {
  testPins[35] = 1; testPins[32] = 0; testADC = 1730;
  pollAD8232(4);
  TEST_ASSERT_TRUE(ecg.loPlus); TEST_ASSERT_FALSE(ecg.loMinus);
  TEST_ASSERT_TRUE(ecg.leadsOff); TEST_ASSERT_EQUAL(1730, ecg.raw);

  // A lead transition between acquisition and publication must not relabel
  // the previous raw observation. An early poll must not refresh it either.
  testPins[35] = 0; testPins[32] = 1; testADC = 2010;
  pollAD8232(6);
  TEST_ASSERT_EQUAL(4, ecg.sampledAt); TEST_ASSERT_EQUAL(1730, ecg.raw);
  TEST_ASSERT_TRUE(ecg.loPlus); TEST_ASSERT_FALSE(ecg.loMinus);

  pollAD8232(8);
  TEST_ASSERT_EQUAL(8, ecg.sampledAt); TEST_ASSERT_EQUAL(2010, ecg.raw);
  TEST_ASSERT_FALSE(ecg.loPlus); TEST_ASSERT_TRUE(ecg.loMinus);
  TEST_ASSERT_TRUE(ecg.leadsOff);

  testPins[32] = 0; pollAD8232(12);
  TEST_ASSERT_FALSE(ecg.loPlus); TEST_ASSERT_FALSE(ecg.loMinus);
  TEST_ASSERT_FALSE(ecg.leadsOff);
  TEST_ASSERT_EQUAL_STRING("Unknown", readECGStatus());
}
void synthetic_pulse_is_processed_from_actual_fifo() {
  for (uint32_t i = 1; i <= 100; ++i) {
    const double phase = (i - 1) * 6.283185307179586 / 20;
    Wire.push(uint32_t(100000 + 5000 * sin(phase)), uint32_t(120000 + 10000 * sin(phase)));
    pollAt(i * 40);
  }
  TEST_ASSERT_TRUE(opticalReadingReady(4000));
  TEST_ASSERT_INT_WITHIN(5, 75, optical.heartRate);
  TEST_ASSERT_INT_WITHIN(10, 95, optical.spo2);
}
void peak_plateau_at_end_is_not_read_past_boundary() {
  int32_t values[100]{}, locations[15]{}, count = 0;
  for (int i = 90; i < 100; ++i) values[i] = 100;
  optical_algorithm::maxim_peaks_above_min_height(locations, &count, values, 100, 30);
  TEST_ASSERT_EQUAL(0, count);
}
void algorithm_handles_high_amplitude_and_malformed_windows() {
  uint32_t ir[100], red[100];
  int32_t oxygen, hr; int8_t oxygenValid, hrValid;
  for (int i = 0; i < 100; ++i) {
    const double phase = i * 6.283185307179586 / 20;
    ir[i] = uint32_t(140000 + 100000 * sin(phase));
    red[i] = uint32_t(120000 + 50000 * sin(phase));
  }
  optical_algorithm::calculate(ir, 100, red, &oxygen, &oxygenValid, &hr, &hrValid);
  TEST_ASSERT_TRUE(hrValid); TEST_ASSERT_TRUE(oxygenValid);
  TEST_ASSERT_INT_WITHIN(5, 75, hr); TEST_ASSERT_INT_WITHIN(10, 95, oxygen);
  optical_algorithm::calculate(ir, 99, red, &oxygen, &oxygenValid, &hr, &hrValid);
  TEST_ASSERT_FALSE(hrValid); TEST_ASSERT_FALSE(oxygenValid);
  ir[0] = 0x40000;
  optical_algorithm::calculate(ir, 100, red, &oxygen, &oxygenValid, &hr, &hrValid);
  TEST_ASSERT_FALSE(hrValid); TEST_ASSERT_FALSE(oxygenValid);
}
void algorithm_adversarial_windows_stay_in_range() {
  std::mt19937 random(6050);
  uint32_t ir[100], red[100];
  int32_t oxygen, hr; int8_t oxygenValid, hrValid;
  for (unsigned example = 0; example < 2000; ++example) {
    for (int i = 0; i < 100; ++i) { ir[i] = random() & 0x3ffff; red[i] = random() & 0x3ffff; }
    optical_algorithm::calculate(ir, 100, red, &oxygen, &oxygenValid, &hr, &hrValid);
    if (oxygenValid) TEST_ASSERT_TRUE(oxygen >= 0 && oxygen <= 100);
    if (hrValid) TEST_ASSERT_TRUE(hr > 0 && hr <= 300);
  }
}
int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(fifo_returns_current_frame_in_order);
  RUN_TEST(short_reads_and_nacks_invalidate_immediately);
  RUN_TEST(falsely_reported_byte_count_is_rejected);
  RUN_TEST(optical_polling_is_bounded_without_losing_queued_frames);
  RUN_TEST(failed_flush_requires_resynchronization_before_more_samples);
  RUN_TEST(fifo_overflow_and_scheduling_gap_restart_window);
  RUN_TEST(overflow_recovery_pops_old_frame_and_requires_fresh_data);
  RUN_TEST(full_fifo_overflow_is_drained_without_rewriting_live_pointers);
  RUN_TEST(finger_removal_and_recovery_require_fresh_window);
  RUN_TEST(absent_and_misconfigured_optical_sensor_stay_unavailable);
  RUN_TEST(stalled_optical_sensor_and_rollover);
  RUN_TEST(failed_startup_retries_without_resetting_counters_or_accepting_old_samples);
  RUN_TEST(retry_intervals_survive_millis_rollover);
  RUN_TEST(reset_recovery_is_rate_limited_and_escalates_after_three_failures);
  RUN_TEST(diagnostic_snapshot_never_reuses_another_failures_code_or_count);
  RUN_TEST(stuck_controller_is_restarted_only_after_bounded_recovery_and_requires_new_samples);
  RUN_TEST(failed_bus_restart_stays_unavailable_and_retries_at_two_seconds);
  RUN_TEST(wrong_identity_and_configuration_are_reported_and_can_recover);
  RUN_TEST(temperature_waits_for_completed_conversion);
  RUN_TEST(temperature_disconnect_recovery_and_errors);
  RUN_TEST(absent_wrong_family_and_failed_conversion_request);
  RUN_TEST(temperature_rollover_keeps_conversion_delay);
  RUN_TEST(temperature_absent_at_boot_recovers_with_bounded_discovery);
  RUN_TEST(ecg_applies_pin_attenuation_to_an_initialized_channel);
  RUN_TEST(ecg_snapshot_reset_keeps_new_samples_in_next_window);
  RUN_TEST(ecg_leads_clipping_and_csv);
  RUN_TEST(ecg_lead_snapshot_survives_pin_changes_until_next_sample);
  RUN_TEST(synthetic_pulse_is_processed_from_actual_fifo);
  RUN_TEST(peak_plateau_at_end_is_not_read_past_boundary);
  RUN_TEST(algorithm_handles_high_amplitude_and_malformed_windows);
  RUN_TEST(algorithm_adversarial_windows_stay_in_range);
  return UNITY_END();
}
