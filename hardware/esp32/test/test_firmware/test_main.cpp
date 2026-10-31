#include <unity.h>
#include <Arduino.h>
#include <fstream>
#include <cstdlib>
static time_t testEpoch = 1800000000;
static time_t testTime(time_t*) { return testEpoch; }
#define time testTime
#include "../../src/main.cpp"
#undef time
#include "../../src/optical/MaximAlgorithm.cpp"

void setUp() {
  testQueues.clear(); testQueueCreates = testTaskCreates = testFailQueueAt = testFailTaskAt = 0;
  diagnosticQueue = xQueueCreate(3, sizeof(DiagnosticRecord));
  sensorDataQueue = xQueueCreate(12, sizeof(TransferRecord));
  diagnosticDrops.store(0); rejected.store(0); sequence = 0;
  waveformBuffer=ADBenchBuffer<512>{};waveformCursor=waveformPendingCursor=waveformDropped=0;waveformPending=false;
  testMillis = 5000; testEpoch = time(nullptr);
  Wire = TwoWire{}; WiFi = TestWiFi{}; testProbe = TestProbe{}; Serial.lines.clear();
  optical = OpticalReading{}; temperature = TemperatureReading{}; ecg = ECGReading{};
  strcpy(sessionId, "00000000-0000-4000-8000-000000000001");
}
void tearDown() {}
void waveform_batches_keep_exact_samples_offsets_and_retry_identity() {
  for(uint32_t i=0;i<128;++i)captureECGSample(4000+i*4,uint16_t(2000+i),i==2,false);
  TEST_ASSERT_TRUE(prepareECG(5000));
  StaticJsonDocument<12288> parsed;TEST_ASSERT_FALSE(bool(deserializeJson(parsed,waveformPayload)));
  TEST_ASSERT_EQUAL(128,parsed["samples"].size());TEST_ASSERT_EQUAL(1,parsed["sequence"].as<uint64_t>());
  TEST_ASSERT_EQUAL(0,parsed["samples"][0][0]);TEST_ASSERT_EQUAL(508,parsed["samples"][127][0]);
  TEST_ASSERT_EQUAL(2127,parsed["samples"][127][1]);TEST_ASSERT_EQUAL(1,parsed["samples"][2][2]);
  const std::string original(waveformPayload);captureECGSample(5000,3000,false,false);
  TEST_ASSERT_TRUE(prepareECG(5100));TEST_ASSERT_EQUAL_STRING(original.c_str(),waveformPayload);
  TEST_ASSERT_EQUAL(0,waveformCursor);
}
void waveform_overflow_exposes_sequence_loss_and_bounds_payload() {
  for(uint32_t i=0;i<700;++i)captureECGSample(1000+i*4,4095,false,false);
  TEST_ASSERT_TRUE(prepareECG(5000));TEST_ASSERT_EQUAL(188,waveformDropped);
  StaticJsonDocument<12288> parsed;TEST_ASSERT_FALSE(bool(deserializeJson(parsed,waveformPayload)));
  TEST_ASSERT_EQUAL(189,parsed["sequence"].as<uint64_t>());TEST_ASSERT_EQUAL(128,parsed["samples"].size());
  TEST_ASSERT_TRUE(strlen(waveformPayload)<sizeof(waveformPayload));
}
void waveform_clock_and_millis_rollover_are_bounded() {
  for(uint32_t i=0;i<128;++i)captureECGSample(UINT32_MAX-255+i*4,2000,false,false);
  testEpoch=0;TEST_ASSERT_FALSE(prepareECG(300));testEpoch=1800000000;
  TEST_ASSERT_TRUE(prepareECG(300));
  StaticJsonDocument<12288> parsed;TEST_ASSERT_FALSE(bool(deserializeJson(parsed,waveformPayload)));
  TEST_ASSERT_EQUAL(508,parsed["samples"][127][0]);
}
void primeRealVitals() {
  optical.initialized = optical.present = optical.contact = optical.computed = true;
  optical.heartRate = 72; optical.spo2 = 98; optical.heartRateValid = optical.spo2Valid = 1;
  optical.computedAt = 5000;
  temperature.present = temperature.converted = true; temperature.celsius = 36.5f; temperature.measuredAt = 5000;
}
void enqueue_rejects_json_pool_overflow_and_full_queue() {
  StaticJsonDocument<8> tooSmall; tooSmall["heart_rate"] = 72;
  TEST_ASSERT_TRUE(tooSmall.overflowed()); enqueue("ingest/vitals", tooSmall);
  TEST_ASSERT_EQUAL(1, rejected.load()); TEST_ASSERT_EQUAL(0, sensorDataQueue->records.size());
  StaticJsonDocument<128> small; small["connected"] = true;
  for (int i = 0; i < 13; ++i) enqueue("device/status", small);
  TEST_ASSERT_EQUAL(12, sensorDataQueue->records.size()); TEST_ASSERT_EQUAL(2, rejected.load());
}
void valid_vitals_publish_no_activity() {
  primeRealVitals(); publishReadings(5000, snapshotAD8232());
  TEST_ASSERT_EQUAL(2, sensorDataQueue->records.size());
  TransferRecord record;
  std::vector<std::string> capture;
  while (xQueueReceive(sensorDataQueue, &record, 0) == pdTRUE) {
    const std::string payload(record.payload);
    StaticJsonDocument<1024> parsed;
    TEST_ASSERT_FALSE(bool(deserializeJson(parsed, payload.c_str())));
    if (!strcmp(record.endpoint, "ingest/vitals")) {
      TEST_ASSERT_EQUAL_STRING(VITALS_SOURCE, parsed["source"]);
      TEST_ASSERT_EQUAL(72, parsed["heart_rate"]); TEST_ASSERT_EQUAL(98, parsed["spo2"]);
      TEST_ASSERT_EQUAL_STRING("Leads Off", parsed["ecg_status"]);
      TEST_ASSERT_EQUAL(1, parsed["sequence"]);
    } else {
      TEST_ASSERT_EQUAL_STRING(VITALS_SOURCE, parsed["source"]); TEST_ASSERT_TRUE(parsed["battery"].isNull());
    }
    capture.emplace_back(std::string("{\"endpoint\":\"") + record.endpoint + "\",\"payload\":" + payload + "}");
  }
  if (const char* filename = std::getenv("FIRMWARE_CAPTURE_PATH")) {
    std::ofstream file(filename); file << '[';
    TEST_ASSERT_TRUE(file.good());
    for (size_t i = 0; i < capture.size(); ++i) { if (i) file << ','; file << capture[i]; }
    file << ']';
  }
}
void real_mode_never_publishes_simulated_activity() {
  primeRealVitals(); publishReadings(5000);
  TEST_ASSERT_EQUAL(2, sensorDataQueue->records.size());
  TransferRecord record;
  while (xQueueReceive(sensorDataQueue, &record, 0)) {
    TEST_ASSERT_TRUE(strcmp(record.endpoint, "ingest/activity") != 0);
    StaticJsonDocument<1024> parsed;
    TEST_ASSERT_FALSE(bool(deserializeJson(parsed, record.payload)));
    TEST_ASSERT_EQUAL_STRING(VITALS_SOURCE, parsed["source"]);
  }
}
void invalid_vitals_keep_only_real_equipment_heartbeat() {
  primeRealVitals(); optical.heartRateValid = 0; publishReadings(5000);
  TEST_ASSERT_EQUAL(1, sensorDataQueue->records.size());
  TransferRecord record; TEST_ASSERT_TRUE(xQueueReceive(sensorDataQueue, &record, 0));
  TEST_ASSERT_EQUAL_STRING("device/status", record.endpoint);
}
void unsynchronized_clock_only_sends_heartbeat() {
  primeRealVitals(); testEpoch = 0; publishReadings(5000);
  TEST_ASSERT_EQUAL(1, sensorDataQueue->records.size());
  TransferRecord record; TEST_ASSERT_TRUE(xQueueReceive(sensorDataQueue, &record, 0));
  TEST_ASSERT_EQUAL_STRING("device/status", record.endpoint);
}
void temperature_reports_independently_without_complete_vitals() {
  primeRealVitals(); optical.heartRateValid=0; temperature.celsius=15.25f;
  publishReadings(5000);
  TEST_ASSERT_EQUAL(1,sensorDataQueue->records.size());
  TransferRecord record; xQueueReceive(sensorDataQueue,&record,0);
  TEST_ASSERT_EQUAL_STRING("device/status",record.endpoint);
  StaticJsonDocument<1024> parsed;
  TEST_ASSERT_FALSE(bool(deserializeJson(parsed,record.payload)));
  TEST_ASSERT_EQUAL_FLOAT(15.25f,parsed["equipment"]["temperature_c"].as<float>());
  TEST_ASSERT_EQUAL_STRING("Leads Off",parsed["equipment"]["ecg_status"]);
  TEST_ASSERT_TRUE(parsed["equipment"]["heart_rate"].isNull());
  TEST_ASSERT_EQUAL(98,parsed["equipment"]["spo2"]);
  TEST_ASSERT_EQUAL(0,rejected.load());
}
void optical_channels_report_independently_of_temperature_and_each_other() {
  for (unsigned invalidChannel=0; invalidChannel<2; ++invalidChannel) {
    primeRealVitals(); temperature = TemperatureReading{};
    optical.heartRateValid = invalidChannel != 0; optical.spo2Valid = invalidChannel != 1;
    publishReadings(5000);
    TransferRecord record;
    TEST_ASSERT_TRUE(xQueueReceive(sensorDataQueue,&record,0));
    TEST_ASSERT_EQUAL_STRING("device/status",record.endpoint);
    StaticJsonDocument<1024> parsed;
    TEST_ASSERT_FALSE(bool(deserializeJson(parsed,record.payload)));
    TEST_ASSERT_TRUE(parsed["equipment"]["temperature_c"].isNull());
    TEST_ASSERT_EQUAL(invalidChannel==0,parsed["equipment"]["heart_rate"].isNull());
    TEST_ASSERT_EQUAL(invalidChannel==1,parsed["equipment"]["spo2"].isNull());
    printEquipmentResults(5000);
    DiagnosticRecord line;
    while (xQueueReceive(diagnosticQueue,&line,0)) {
      if (line.payload[0]!='{') continue;
      StaticJsonDocument<2048> report;
      TEST_ASSERT_FALSE(bool(deserializeJson(report,line.payload)));
      TEST_ASSERT_EQUAL(invalidChannel==0,report["MAX30102"]["heart_rate_bpm"].isNull());
      TEST_ASSERT_EQUAL(invalidChannel==1,report["MAX30102"]["spo2_percent"].isNull());
    }
  }
  TEST_ASSERT_EQUAL(0,rejected.load());
}
void stale_channels_are_null_and_largest_status_fits_transport() {
  primeRealVitals(); publishReadings(8000);
  TransferRecord record;
  while (xQueueReceive(sensorDataQueue,&record,0)) {
    if (strcmp(record.endpoint,"device/status")) continue;
    StaticJsonDocument<1024> parsed;
    TEST_ASSERT_FALSE(bool(deserializeJson(parsed,record.payload)));
    TEST_ASSERT_TRUE(parsed["equipment"]["heart_rate"].isNull());
    TEST_ASSERT_TRUE(parsed["equipment"]["spo2"].isNull());
    TEST_ASSERT_TRUE(parsed["equipment"]["temperature_c"].isNull());
  }
  primeRealVitals(); optical.heartRate=300; optical.spo2=100;
  temperature.celsius=-54.9375f; ecg.raw=4095; ecg.millivolts=5000;
  ecg.samples=ecg.clipped=2147483647;
  publishReadings(5000);
  TEST_ASSERT_EQUAL(0,rejected.load());
  TEST_ASSERT_EQUAL(1,sensorDataQueue->records.size());
  while (xQueueReceive(sensorDataQueue,&record,0)) {
    TEST_ASSERT_LESS_THAN(sizeof(record.payload),strlen(record.payload));
    StaticJsonDocument<1024> parsed;
    TEST_ASSERT_FALSE(bool(deserializeJson(parsed,record.payload)));
  }
}
void equipment_report_is_complete_and_missing_values_are_null() {
  printEquipmentResults(5000);
  DiagnosticRecord record; TEST_ASSERT_TRUE(xQueueReceive(diagnosticQueue, &record, 0));
  StaticJsonDocument<2048> parsed;
  TEST_ASSERT_FALSE(bool(deserializeJson(parsed, record.payload)));
  TEST_ASSERT_TRUE(parsed["MAX30102"]["heart_rate_bpm"].isNull());
  TEST_ASSERT_TRUE(parsed["DS18B20"]["temperature_c"].isNull());
  TEST_ASSERT_EQUAL_STRING("real", parsed["AD8232"]["mode"]);
  TEST_ASSERT_FALSE(parsed.containsKey("MPU6050"));
  TEST_ASSERT_EQUAL(0, diagnosticDrops.load());
}
void equipment_report_includes_real_values_and_clipping() {
  primeRealVitals(); ecg.samples = 1000; ecg.clipped = 10; ecg.minimum = 0; ecg.maximum = 4095;
  printEquipmentResults(5000);
  DiagnosticRecord record; TEST_ASSERT_TRUE(xQueueReceive(diagnosticQueue, &record, 0));
  StaticJsonDocument<2048> parsed;
  TEST_ASSERT_FALSE(bool(deserializeJson(parsed, record.payload)));
  TEST_ASSERT_TRUE(parsed["MAX30102"]["valid"].as<bool>());
  TEST_ASSERT_EQUAL(72, parsed["MAX30102"]["heart_rate_bpm"]);
  TEST_ASSERT_EQUAL(10, parsed["AD8232"]["clipped_samples"]);
  TEST_ASSERT_EQUAL(4095, parsed["AD8232"]["max_adc"]);
  TEST_ASSERT_EQUAL(0, ecg.samples); TEST_ASSERT_EQUAL(0, diagnosticDrops.load());
}
void diagnostics_preserve_lines_and_count_overflow() {
  diagnosticLine("first"); diagnosticPrintf("ECG,%u,%u", 4U, 2048U); diagnosticLine("third");
  diagnosticLine("fourth"); TEST_ASSERT_EQUAL(1, diagnosticDrops.load());
  DiagnosticRecord record; TEST_ASSERT_TRUE(xQueueReceive(diagnosticQueue, &record, 0));
  TEST_ASSERT_EQUAL_STRING("first", record.payload);
  TEST_ASSERT_TRUE(xQueueReceive(diagnosticQueue, &record, 0));
  TEST_ASSERT_EQUAL_STRING("ECG,4,2048", record.payload);
  std::string tooLong(1536, 'x'); diagnosticLine(tooLong.c_str());
  diagnosticPrintf("%s", tooLong.c_str()); TEST_ASSERT_EQUAL(3, diagnosticDrops.load());
}
void startup_reports_queue_and_task_allocation_failures() {
  testQueueCreates = 0; testFailQueueAt = 1; setup();
  TEST_ASSERT_EQUAL(0, testTaskCreates); TEST_ASSERT_EQUAL_STRING("Queue allocation failed", Serial.lines.back().c_str());
  const char* errors[]={"ECG task allocation failed","Sensor task allocation failed","Delivery task allocation failed"};
  for (unsigned failure=2; failure<=4; ++failure) {
    testQueueCreates = testTaskCreates = 0; testFailQueueAt = 0; testFailTaskAt = failure; setup();
    TEST_ASSERT_EQUAL(failure, testTaskCreates);
    DiagnosticRecord record; TEST_ASSERT_TRUE(xQueueReceive(diagnosticQueue, &record, 0));
    TEST_ASSERT_EQUAL_STRING(errors[failure-2], record.payload);
  }
}
void startup_enables_automatic_wireless_delivery() {
  setup();
  TEST_ASSERT_EQUAL(WIFI_STA, WiFi.stationMode);
  TEST_ASSERT_TRUE(WiFi.automaticReconnect);
  TEST_ASSERT_FALSE(WiFi.sleeping);
  TEST_ASSERT_TRUE(WiFi.started);
  TEST_ASSERT_EQUAL_STRING("vyana-sensor-hub", WiFi.hostname.c_str());
  TEST_ASSERT_EQUAL(4, testTaskCreates);
}
int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(enqueue_rejects_json_pool_overflow_and_full_queue);
  RUN_TEST(waveform_batches_keep_exact_samples_offsets_and_retry_identity);
  RUN_TEST(waveform_overflow_exposes_sequence_loss_and_bounds_payload);
  RUN_TEST(waveform_clock_and_millis_rollover_are_bounded);
  RUN_TEST(valid_vitals_publish_no_activity);
  RUN_TEST(real_mode_never_publishes_simulated_activity);
  RUN_TEST(invalid_vitals_keep_only_real_equipment_heartbeat);
  RUN_TEST(unsynchronized_clock_only_sends_heartbeat);
  RUN_TEST(temperature_reports_independently_without_complete_vitals);
  RUN_TEST(optical_channels_report_independently_of_temperature_and_each_other);
  RUN_TEST(stale_channels_are_null_and_largest_status_fits_transport);
  RUN_TEST(equipment_report_is_complete_and_missing_values_are_null);
  RUN_TEST(equipment_report_includes_real_values_and_clipping);
  RUN_TEST(diagnostics_preserve_lines_and_count_overflow);
  RUN_TEST(startup_reports_queue_and_task_allocation_failures);
  RUN_TEST(startup_enables_automatic_wireless_delivery);
  return UNITY_END();
}
