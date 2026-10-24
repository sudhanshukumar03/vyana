#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include <math.h>
#include "DeliveryPolicy.h"
#if __has_include("config.h")
#include "config.h"
#else
#include "config.example.h"
#endif
#include "sensors/MAX30102_Driver.h"
#include "sensors/AD8232_Driver.h"
#include "sensors/DS18B20_Driver.h"
#include "sensors/MPU6050_Driver.h"

struct TransferRecord { char endpoint[24]; char payload[512]; };
QueueHandle_t sensorDataQueue;
RingQueue<TransferRecord,64> offline;
char sessionId[37];
uint32_t sequence = 0;
uint32_t rejected = 0, retried = 0;

void enqueue(const char* endpoint, JsonDocument& doc) {
  TransferRecord record{};
  strlcpy(record.endpoint, endpoint, sizeof(record.endpoint));
  if (measureJson(doc) >= sizeof(record.payload)) { ++rejected; return; }
  serializeJson(doc, record.payload, sizeof(record.payload));
  if (xQueueSend(sensorDataQueue, &record, 0) != pdTRUE) ++rejected;
}
void envelope(JsonDocument& doc, const char* timestamp) {
  doc["session_id"] = sessionId; doc["sequence"] = sequence;
  doc["observed_at"] = timestamp; doc["source"] = "ESP32_SimulatedDSP";
}
void sensorTask(void*) {
  uint32_t steps=0;
  for (;;) {
    ++sequence;
    time_t now = time(nullptr);
    if (now > 1700000000) {
      struct tm utc; gmtime_r(&now, &utc); char observed[32];
      strftime(observed,sizeof(observed),"%Y-%m-%dT%H:%M:%SZ",&utc);
      float temperature = readTemperature();
      if (isfinite(temperature) && temperature >= 20 && temperature <= 45) {
        StaticJsonDocument<512> doc;
        envelope(doc,observed);doc["heart_rate"]=readHeartRate();doc["spo2"]=readSpO2();
        doc["temperature"]=temperature;doc["ecg_status"]=readECGStatus();enqueue("ingest/vitals",doc);
      } else Serial.println("Temperature unavailable; no normal value substituted.");
      // Explicit simulated activity until real DSP is implemented.
      steps += 10;
      StaticJsonDocument<512> activity;envelope(activity,observed);
      activity["steps"]=steps;activity["distance_km"]=steps*0.000762;activity["calories"]=int(steps*0.04);
      activity["active_minutes"]=int(sequence*5/60);enqueue("ingest/activity",activity);
    } else Serial.println("Clock unsynchronised; timestamped samples withheld.");
    StaticJsonDocument<256> status;
    status["device_name"]="ESP32 prototype";status["connected"]=true;status["battery"]=nullptr;
    status["source"]="ESP32_SimulatedDSP";enqueue("device/status",status);
    vTaskDelay(pdMS_TO_TICKS(5000));
  }
}
void wifiTask(void*) {
  uint32_t reconnectAt=0, retryAt=0;unsigned attempt=0;
  for (;;) {
    TransferRecord incoming;
    while (xQueueReceive(sensorDataQueue,&incoming,0)==pdTRUE) offline.push(incoming);
    const uint32_t now=millis();
    if(WiFi.status()!=WL_CONNECTED) {
      if(int32_t(now-reconnectAt)>=0) {WiFi.reconnect();reconnectAt=now+10000;}
    } else if(offline.size() && int32_t(now-retryAt)>=0) {
      HTTPClient http;WiFiClient plain;WiFiClientSecure secure;
      const String url=String(API_BASE)+"/"+offline.front().endpoint;
      bool ready=false;
      if(url.startsWith("https://") && strlen(ROOT_CA)>0) {secure.setCACert(ROOT_CA);ready=http.begin(secure,url);}
      else if(url.startsWith("http://") && ALLOW_INSECURE_HTTP) ready=http.begin(plain,url);
      if(ready) {
        const char* tracked[]={"Retry-After"};http.collectHeaders(tracked,1);
        http.setConnectTimeout(2000);http.setTimeout(3000);
        http.addHeader("Content-Type","application/json");http.addHeader("X-Device-Key",DEVICE_KEY);
        const int status=http.POST(String(offline.front().payload));
        const uint32_t serverDelay=http.header("Retry-After").toInt();http.end();
        if(deliveryAccepted(status)) {offline.pop();attempt=0;retryAt=now;}
        else if(deliveryRetryable(status)) {++retried;retryAt=now+retryDelay(attempt++,serverDelay)+(esp_random()%250);}
        else {++rejected;offline.pop();attempt=0;retryAt=now+1000;}
        Serial.printf("delivery=%d queued=%u dropped=%u rejected=%u retries=%u heap=%u\n",status,unsigned(offline.size()),unsigned(offline.dropped),unsigned(rejected),unsigned(retried),unsigned(ESP.getFreeHeap()));
      } else {Serial.println("Transport configuration invalid; HTTPS requires ROOT_CA.");retryAt=now+30000;}
    }
    vTaskDelay(pdMS_TO_TICKS(100));
  }
}
void setup() {
  Serial.begin(115200);
  uint8_t random[16];esp_fill_random(random,sizeof(random));
  random[6]=(random[6]&0x0f)|0x40;random[8]=(random[8]&0x3f)|0x80;
  snprintf(sessionId,sizeof(sessionId),"%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",random[0],random[1],random[2],random[3],random[4],random[5],random[6],random[7],random[8],random[9],random[10],random[11],random[12],random[13],random[14],random[15]);
  sensorDataQueue=xQueueCreate(12,sizeof(TransferRecord));
  if(!sensorDataQueue) {Serial.println("Queue allocation failed");return;}
  WiFi.begin(WIFI_SSID,WIFI_PASSWORD);configTime(0,0,"pool.ntp.org","time.google.com");
  initMAX30102();initAD8232();initDS18B20();initMPU6050();
  xTaskCreatePinnedToCore(sensorTask,"Sensors",6144,nullptr,1,nullptr,0);
  xTaskCreatePinnedToCore(wifiTask,"Delivery",8192,nullptr,1,nullptr,1);
}
void loop() {vTaskDelay(pdMS_TO_TICKS(1000));}
