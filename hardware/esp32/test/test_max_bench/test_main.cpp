#include <unity.h>
#include <ArduinoJson.h>
#include <math.h>
#include "../../src/bench/max30102_bench.cpp"
#include "../../src/optical/MaximAlgorithm.cpp"

void setUp() {
  testMillis = 0; Wire = TwoWire{}; Serial.lines.clear(); setup();
}
void tearDown() {}

void latestReport(JsonDocument& doc, uint32_t now) {
  printMAXBenchReport(now);
  for (auto line = Serial.lines.rbegin(); line != Serial.lines.rend(); ++line) {
    if (!line->empty() && line->front() == '{') {
      TEST_ASSERT_FALSE(bool(deserializeJson(doc, *line))); return;
    }
  }
  TEST_FAIL_MESSAGE("Missing standalone MAX JSON report");
}
void standalone_setup_keeps_fixed_pins_and_clock() {
  TEST_ASSERT_EQUAL(21, Wire.sdaPin); TEST_ASSERT_EQUAL(22, Wire.sclPin);
  TEST_ASSERT_EQUAL(100000, Wire.clockHz);
  const unsigned begins = Wire.beginCalls;
  testMillis = 16000; loop(); testMillis = 32000; loop();
  TEST_ASSERT_EQUAL(begins, Wire.beginCalls); TEST_ASSERT_EQUAL(100000, Wire.clockHz);
  TEST_ASSERT_EQUAL(1, optical.initAttempts);
}
void raw_values_are_not_published_as_calculated_vitals() {
  Wire.push(100000, 120000); testMillis = 340; pollMAX30102(testMillis);
  StaticJsonDocument<2048> doc; latestReport(doc, testMillis);
  TEST_ASSERT_EQUAL(100000, doc["red"].as<unsigned>());
  TEST_ASSERT_EQUAL(120000, doc["ir"].as<unsigned>());
  TEST_ASSERT_TRUE(doc["heart_rate_bpm"].isNull()); TEST_ASSERT_TRUE(doc["spo2_percent"].isNull());
  TEST_ASSERT_FALSE(doc["heart_rate_valid"].as<bool>());
}
void measured_window_is_calculated_and_stale_or_failed_windows_are_withheld() {
  for (uint32_t i = 1; i <= 100; ++i) {
    const double phase = (i - 1) * 6.283185307179586 / 20;
    Wire.push(uint32_t(100000 + 5000 * sin(phase)), uint32_t(120000 + 10000 * sin(phase)));
    testMillis = 300 + i * 40; pollMAX30102(testMillis);
  }
  StaticJsonDocument<2048> doc; latestReport(doc, testMillis);
  TEST_ASSERT_TRUE(doc["heart_rate_valid"].as<bool>()); TEST_ASSERT_TRUE(doc["spo2_valid"].as<bool>());
  TEST_ASSERT_INT_WITHIN(5, 75, doc["heart_rate_bpm"].as<int>());
  TEST_ASSERT_INT_WITHIN(10, 95, doc["spo2_percent"].as<int>());
  optical.spo2Valid = 0; latestReport(doc, testMillis);
  TEST_ASSERT_TRUE(doc["heart_rate_valid"].as<bool>()); TEST_ASSERT_TRUE(doc["spo2_percent"].isNull());
  optical.spo2Valid = 1; latestReport(doc, testMillis + 2501);
  TEST_ASSERT_TRUE(doc["heart_rate_bpm"].isNull()); TEST_ASSERT_TRUE(doc["spo2_percent"].isNull());
  Wire.nack = true; testMillis += 40; pollMAX30102(testMillis); latestReport(doc, testMillis);
  TEST_ASSERT_TRUE(doc["heart_rate_bpm"].isNull()); TEST_ASSERT_TRUE(doc["spo2_percent"].isNull());
}
int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(standalone_setup_keeps_fixed_pins_and_clock);
  RUN_TEST(raw_values_are_not_published_as_calculated_vitals);
  RUN_TEST(measured_window_is_calculated_and_stale_or_failed_windows_are_withheld);
  return UNITY_END();
}
