#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include <math.h>
#include <Wire.h>
#include <atomic>
#include <stdarg.h>
#if defined(ARDUINO_ARCH_ESP32)
#include <sys/time.h>
#endif
#include "BenchClock.h"
#include "DiagnosticLog.h"
#include "DeliveryPolicy.h"
#if __has_include("config.h")
#include "config.h"
#else
#include "config.example.h"
#endif
#include "HardwareConfig.h"
#include "sensors/MAX30102_Driver.h"
#include "bench/ADBenchBuffer.h"
void captureECGSample(uint32_t now,uint16_t raw,bool plus,bool minus);
#define ECG_CAPTURE_SAMPLE(now,raw,plus,minus) captureECGSample(now,raw,plus,minus)
#include "sensors/AD8232_Driver.h"
#include "sensors/DS18B20_Driver.h"

struct TransferRecord { char endpoint[24]; char payload[512]; };
QueueHandle_t sensorDataQueue;
struct DiagnosticRecord { char payload[1536]; };
QueueHandle_t diagnosticQueue;
std::atomic<uint32_t> diagnosticDrops{0};
RingQueue<TransferRecord,64> offline;
char sessionId[37];
uint32_t sequence = 0;
std::atomic<uint32_t> rejected{0};
uint32_t retried = 0;

// Separate bounded waveform buffer; health-summary queues keep their priority.
ADBenchBuffer<512> waveformBuffer;
ADBenchSample waveformSamples[128];
StaticJsonDocument<12288> waveformDocument;
char waveformPayload[4096];
uint64_t waveformCursor=0,waveformPendingCursor=0,waveformDropped=0;
uint32_t waveformPendingAt=0;
bool waveformPending=false;

void captureECGSample(uint32_t now,uint16_t raw,bool plus,bool minus) {
  ECGStateGuard guard;waveformBuffer.append(now,raw,plus,minus);
}
bool prepareECG(uint32_t now) {
  if(waveformPending&&uint32_t(now-waveformPendingAt)<30000)return true;
  if(waveformPending){waveformCursor=waveformPendingCursor;waveformPending=false;}
  const time_t seconds=time(nullptr);if(seconds<1700000000)return false;
  ADBenchBatch batch;
  {ECGStateGuard guard;batch=waveformBuffer.copyAfter(waveformCursor,waveformSamples,128);}
  if(!batch.count||(batch.count<64&&uint32_t(now-waveformSamples[0].uptime)<1000))return false;
  waveformDropped+=batch.missed;
  int64_t epochMs=int64_t(seconds)*1000;
#if defined(ARDUINO_ARCH_ESP32)
  struct timeval clock{};gettimeofday(&clock,nullptr);epochMs=int64_t(clock.tv_sec)*1000+clock.tv_usec/1000;
#else
  epochMs+=now%1000;
#endif
  epochMs-=uint32_t(now-waveformSamples[0].uptime);
  time_t firstTime=epochMs/1000;struct tm utc{};gmtime_r(&firstTime,&utc);
  char date[24],observed[32];strftime(date,sizeof(date),"%Y-%m-%dT%H:%M:%S",&utc);
  snprintf(observed,sizeof(observed),"%s.%03uZ",date,unsigned(epochMs%1000));
  waveformDocument.clear();waveformDocument["session_id"]=sessionId;
  waveformDocument["sequence"]=waveformSamples[0].sequence;waveformDocument["observed_at"]=observed;
  waveformDocument["source"]=VITALS_SOURCE;
  JsonArray points=waveformDocument.createNestedArray("samples");
  size_t count=0;
  for(;count<batch.count;++count){
    const uint32_t offset=waveformSamples[count].uptime-waveformSamples[0].uptime;
    if(offset>2000)break;
    JsonArray point=points.createNestedArray();point.add(offset);point.add(waveformSamples[count].raw);
    point.add(unsigned(waveformSamples[count].loPlus)|(unsigned(waveformSamples[count].loMinus)<<1));
  }
  if(waveformDocument.overflowed()||measureJson(waveformDocument)>=sizeof(waveformPayload))return false;
  serializeJson(waveformDocument,waveformPayload,sizeof(waveformPayload));
  waveformPendingCursor=waveformSamples[count-1].sequence;waveformPendingAt=now;waveformPending=true;return true;
}

void diagnosticLine(const char* line) {
  DiagnosticRecord record{};
  if (!diagnosticQueue || strlen(line) >= sizeof(record.payload)) { ++diagnosticDrops; return; }
  strlcpy(record.payload, line, sizeof(record.payload));
  if (xQueueSend(diagnosticQueue, &record, 0) != pdTRUE) ++diagnosticDrops;
}
void diagnosticPrintf(const char* format, ...) {
  char line[256];
  va_list args; va_start(args, format);
  const int length = vsnprintf(line, sizeof(line), format, args);
  va_end(args);
  if (length < 0 || size_t(length) >= sizeof(line)) { ++diagnosticDrops; return; }
  diagnosticLine(line);
}
void diagnosticTask(void*) {
  DiagnosticRecord record;
  for (;;) {
    if (xQueueReceive(diagnosticQueue, &record, portMAX_DELAY) == pdTRUE) Serial.println(record.payload);
  }
}

void enqueue(const char* endpoint, JsonDocument& doc) {
  TransferRecord record{};
  strlcpy(record.endpoint, endpoint, sizeof(record.endpoint));
  if (doc.overflowed() || measureJson(doc) >= sizeof(record.payload)) { ++rejected; return; }
  serializeJson(doc, record.payload, sizeof(record.payload));
  if (xQueueSend(sensorDataQueue, &record, 0) != pdTRUE) ++rejected;
}
void envelope(JsonDocument& doc, const char* timestamp, const char* source) {
  doc["session_id"] = sessionId; doc["sequence"] = sequence;
  doc["observed_at"] = timestamp; doc["source"] = source;
}
void printEquipmentResults(uint32_t now, const ECGReading& signalReading) {
  StaticJsonDocument<1792> doc;
  doc["uptime_ms"] = now;
  doc["log_drops"] = diagnosticDrops.load();
  JsonObject pulse = doc.createNestedObject("MAX30102");
  pulse["mode"] = "real"; pulse["present"] = optical.present;
  pulse["contact"] = optical.contact; pulse["valid"] = opticalReadingReady(now);
  pulse["red"] = optical.red; pulse["ir"] = optical.ir;
  pulse["io_errors"] = optical.ioErrors;
  pulse["tx_errors"] = optical.txErrors; pulse["short_reads"] = optical.shortReads;
  pulse["empty_reads"] = optical.emptyReads; pulse["pointer_errors"] = optical.pointerErrors;
  pulse["clear_errors"] = optical.clearErrors;
  pulse["error_stage"] = optical.errorStage; pulse["error_register"] = optical.errorRegister;
  pulse["error_code"] = optical.errorCode; pulse["received_bytes"] = optical.receivedBytes;
  pulse["expected_bytes"] = optical.expectedBytes; pulse["error_value"] = optical.errorValue;
  pulse["init_attempts"] = optical.initAttempts; pulse["init_failures"] = optical.initFailures;
  pulse["recovery_attempts"] = optical.recoveryAttempts;
  pulse["bus_restarts"] = optical.busRestarts;
  pulse["bus_restart_failures"] = optical.busRestartFailures;
  char pointerHex[9];
  snprintf(pointerHex, sizeof(pointerHex), "%02x/%02x/%02x", optical.lastPointers[0], optical.lastPointers[1], optical.lastPointers[2]);
  pulse["fifo_pointers"] = pointerHex;
  if (opticalHeartRateReady(now)) pulse["heart_rate_bpm"] = optical.heartRate;
  else pulse["heart_rate_bpm"] = nullptr;
  if (opticalSpO2Ready(now)) pulse["spo2_percent"] = optical.spo2;
  else pulse["spo2_percent"] = nullptr;
  JsonObject temp = doc.createNestedObject("DS18B20");
  temp["mode"] = "real"; temp["present"] = temperature.present;
  temp["valid"] = temperatureReadingReady(now);
  if (temperature.present && temperatureProbeUsable(temperature.celsius, temperature.converted,
                                                  uint32_t(now-temperature.measuredAt))) temp["temperature_c"] = temperature.celsius;
  else temp["temperature_c"] = nullptr;
  JsonObject signal = doc.createNestedObject("AD8232");
  signal["mode"] = "real"; signal["status"] = ecgLeadStatus(signalReading.leadsOff);
  signal["raw_adc"] = signalReading.raw; signal["millivolts"] = signalReading.millivolts;
  signal["samples"] = signalReading.samples; signal["clipped_samples"] = signalReading.clipped;
  if (signalReading.samples) { signal["min_adc"] = signalReading.minimum; signal["max_adc"] = signalReading.maximum; }
  char line[sizeof(DiagnosticRecord::payload)];
  if (doc.overflowed() || measureJson(doc) >= sizeof(line)) diagnosticLine("Equipment report exceeds buffer.");
  else { serializeJson(doc, line, sizeof(line)); diagnosticLine(line); }
}
void printEquipmentResults(uint32_t now) { printEquipmentResults(now, snapshotAD8232(true)); }
void publishReadings(uint32_t now, const ECGReading& signalReading) {
    ++sequence;
    time_t epoch = time(nullptr);
    char observed[32]{};
    if (epoch > 1700000000) {
      struct tm utc; gmtime_r(&epoch, &utc);
      strftime(observed,sizeof(observed),"%Y-%m-%dT%H:%M:%SZ",&utc);
      // The existing API requires a complete vital record. Keep individual
      // equipment results on status and serial when another sensor is unavailable.
      if (opticalReadingReady(now) && temperatureReadingReady(now)) {
        StaticJsonDocument<512> doc;
        envelope(doc,observed,VITALS_SOURCE);
        doc["heart_rate"]=optical.heartRate;doc["spo2"]=optical.spo2;
        doc["temperature"]=temperature.celsius;doc["ecg_status"]=ecgLeadStatus(signalReading.leadsOff);enqueue("ingest/vitals",doc);
      } else diagnosticLine("Vitals withheld: real optical/temperature result unavailable; inspect equipment report.");
    } else diagnosticLine("Clock unsynchronised; timestamped samples withheld.");
    StaticJsonDocument<768> status;
    status["device_name"]="ESP32 prototype";status["connected"]=true;status["battery"]=nullptr;
    status["source"]=VITALS_SOURCE;
    if (observed[0]) {
      JsonObject equipment = status.createNestedObject("equipment");
      equipment["observed_at"] = observed;
      if (opticalHeartRateReady(now)) equipment["heart_rate"] = optical.heartRate;
      else equipment["heart_rate"] = nullptr;
      if (opticalSpO2Ready(now)) equipment["spo2"] = optical.spo2;
      else equipment["spo2"] = nullptr;
      if (temperature.present && temperatureProbeUsable(temperature.celsius, temperature.converted,
                                                       uint32_t(now-temperature.measuredAt)))
        equipment["temperature_c"] = temperature.celsius;
      else equipment["temperature_c"] = nullptr;
      equipment["ecg_status"] = ecgLeadStatus(signalReading.leadsOff);
      equipment["ecg_raw_adc"] = signalReading.raw; equipment["ecg_millivolts"] = signalReading.millivolts;
      equipment["ecg_samples"] = signalReading.samples; equipment["ecg_clipped_samples"] = signalReading.clipped;
    }
    enqueue("device/status",status);
}
void publishReadings(uint32_t now) { publishReadings(now, snapshotAD8232()); }
void ecgTask(void*) {
  for (;;) {
    pollAD8232(millis());
    // Always yield at least one RTOS tick, including configurations below 1 kHz.
    vTaskDelay(1);
  }
}
void sensorTask(void*) {
  uint32_t lastReport = millis();
  for (;;) {
    pollMAX30102(millis());
    pollDS18B20(millis());
    const uint32_t now = millis();
    if (uint32_t(now-lastReport) >= REPORT_INTERVAL_MS) {
      lastReport = now;
      const ECGReading signalReading = snapshotAD8232(true);
      publishReadings(now, signalReading);
      printEquipmentResults(now, signalReading);
    }
    vTaskDelay(1);
  }
}
void wifiTask(void*) {
  RetryWindow reconnect, retry, waveformRetry;unsigned attempt=0,waveformAttempt=0;
  bool clockConfigured = false;
  for (;;) {
    TransferRecord incoming;
    while (xQueueReceive(sensorDataQueue,&incoming,0)==pdTRUE) offline.push(incoming);
    const uint32_t now=millis();
    // Start SNTP after Wi-Fi has supplied an IP address and DNS servers.
    if (WiFi.status() == WL_CONNECTED && !clockConfigured) {
      configTime(0,0,"pool.ntp.org","time.google.com");
      clockConfigured = true;
      diagnosticLine("Wi-Fi connected; network clock synchronisation started.");
    }
    if(WiFi.status()!=WL_CONNECTED) {
      if(reconnect.ready(now)) {WiFi.reconnect();reconnect.start(now,10000);}
    } else if((offline.size() && retry.ready(now))||(!offline.size()&&waveformRetry.ready(now)&&prepareECG(now))) {
      const bool sendingWaveform=!offline.size();
      // HTTPClient retains a client pointer and uses it during destruction.
      // Construct clients first so they outlive HTTPClient at scope exit.
      WiFiClient plain;WiFiClientSecure secure;HTTPClient http;
      const String url=String(API_BASE)+"/"+(sendingWaveform?"ingest/ecg":offline.front().endpoint);
      bool ready=false;
      if(url.startsWith("https://") && strlen(ROOT_CA)>0) {secure.setCACert(ROOT_CA);ready=http.begin(secure,url);}
      else if(url.startsWith("http://") && ALLOW_INSECURE_HTTP) ready=http.begin(plain,url);
      if(ready) {
        const char* tracked[]={"Retry-After","Date"};http.collectHeaders(tracked,2);
        http.setConnectTimeout(2000);http.setTimeout(3000);
        http.addHeader("Content-Type","application/json");http.addHeader("X-Device-Key",DEVICE_KEY);
        const int status=http.POST(String(sendingWaveform?waveformPayload:offline.front().payload));
#if defined(ARDUINO_ARCH_ESP32)
        if (benchClockBootstrapAllowed(BENCH_HTTP_CLOCK_FROM_API, ALLOW_INSECURE_HTTP,
                                       url.c_str(), status, time(nullptr))) {
          const int64_t epoch = httpDateEpoch(http.header("Date").c_str());
          if (epoch) {
            struct timeval clockValue{}; clockValue.tv_sec = epoch;
            if (settimeofday(&clockValue, nullptr) == 0)
              diagnosticLine("Bench clock bootstrapped from configured local API Date; SNTP remains enabled.");
          }
        }
#endif
        const uint32_t serverDelay=boundedRetryAfter(http.header("Retry-After").c_str());http.end();
        const uint32_t completedAt=millis();
        if(sendingWaveform){
          if(deliveryAccepted(status)||!deliveryRetryable(status)){
            waveformCursor=waveformPendingCursor;waveformPending=false;waveformAttempt=0;waveformRetry.start(completedAt,200);
            if(!deliveryAccepted(status))++rejected;
          }else{++retried;waveformRetry.start(completedAt,retryDelay(waveformAttempt++,serverDelay)+(esp_random()%250));}
        }
        else if(deliveryAccepted(status)) {offline.pop();attempt=0;retry.start(completedAt,0);}
        else if(deliveryRetryable(status)) {++retried;retry.start(completedAt,retryDelay(attempt++,serverDelay)+(esp_random()%250));}
        else {++rejected;offline.pop();attempt=0;retry.start(completedAt,1000);}
        diagnosticPrintf("delivery=%d queued=%u dropped=%u rejected=%u retries=%u heap=%u",status,unsigned(offline.size()),unsigned(offline.dropped),unsigned(rejected.load()),unsigned(retried),unsigned(ESP.getFreeHeap()));
      } else {
        diagnosticLine("Transport configuration invalid; HTTPS requires ROOT_CA.");
        if(sendingWaveform)waveformRetry.start(millis(),30000);else retry.start(millis(),30000);
      }
    }
    vTaskDelay(pdMS_TO_TICKS(100));
  }
}
void setup() {
  Serial.begin(115200);
  Serial.println("VYANA_SENSOR_HUB: full Wi-Fi/API firmware; real readings only. Activity comes from Google Health.");
  uint8_t random[16];esp_fill_random(random,sizeof(random));
  random[6]=(random[6]&0x0f)|0x40;random[8]=(random[8]&0x3f)|0x80;
  snprintf(sessionId,sizeof(sessionId),"%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",random[0],random[1],random[2],random[3],random[4],random[5],random[6],random[7],random[8],random[9],random[10],random[11],random[12],random[13],random[14],random[15]);
  sensorDataQueue=xQueueCreate(12,sizeof(TransferRecord));
  if(!sensorDataQueue) {Serial.println("Queue allocation failed");return;}
  diagnosticQueue=xQueueCreate(3,sizeof(DiagnosticRecord));
  if(!diagnosticQueue) {Serial.println("Diagnostic queue allocation failed");return;}
  WiFi.mode(WIFI_STA);
  WiFi.setHostname("vyana-sensor-hub");
  WiFi.setAutoReconnect(true);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID,WIFI_PASSWORD);
  Wire.begin(21,22,MAX30102_I2C_HZ);Wire.setTimeOut(20);
  initMAX30102();initAD8232();initDS18B20();
  if(xTaskCreatePinnedToCore(diagnosticTask,"Diagnostics",4096,nullptr,1,nullptr,1)!=pdPASS) {
    Serial.println("Diagnostic task allocation failed");return;
  }
  if(xTaskCreatePinnedToCore(ecgTask,"ECG",4096,nullptr,2,nullptr,1)!=pdPASS) {
    diagnosticLine("ECG task allocation failed");return;
  }
  // Equipment JSON, serialization and nested diagnostic frames exceed 8 KiB
  // on the ESP32 toolchain. Leave room for those frames and RTOS context saves.
  if(xTaskCreatePinnedToCore(sensorTask,"Sensors",16384,nullptr,1,nullptr,0)!=pdPASS) {
    diagnosticLine("Sensor task allocation failed");return;
  }
  if(xTaskCreatePinnedToCore(wifiTask,"Delivery",8192,nullptr,1,nullptr,1)!=pdPASS)
    diagnosticLine("Delivery task allocation failed");
}
void loop() {vTaskDelay(pdMS_TO_TICKS(1000));}
