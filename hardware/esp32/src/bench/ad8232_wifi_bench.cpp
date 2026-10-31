// Upload with electrodes OFF BODY. Body-connected operation requires standalone
// battery power, no computer USB/mains connections, and wireless monitoring.
#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <ESPmDNS.h>
#include "../config.h"
#ifdef ECG_STREAM_SERIAL
#undef ECG_STREAM_SERIAL
#endif
#define ECG_STREAM_SERIAL 0
#include "../sensors/AD8232_Driver.h"
#include "ADBenchBuffer.h"
#include "ADBenchViewer.h"

WebServer ecgServer(80);
ADBenchBuffer<2048> ecgRing;
ADBenchSample responseSamples[256];
portMUX_TYPE ecgMutex = portMUX_INITIALIZER_UNLOCKED;
String benchPassword, bootId;
bool acquisitionReady = false;
bool mdnsReady = false;
uint32_t lastNetworkLog = 0;

void diagnosticLine(const char* line) { Serial.println(line); }
void diagnosticPrintf(const char*, ...) {} // No per-sample serial streaming.

void acquireSamples(void*) {
  for (;;) {
    const uint32_t previous = ecg.sampledAt;
    pollAD8232(millis());
    if (ecg.sampledAt != previous) {
      portENTER_CRITICAL(&ecgMutex);
      ecgRing.append(ecg.sampledAt, ecg.raw, ecg.loPlus, ecg.loMinus);
      portEXIT_CRITICAL(&ecgMutex);
    }
    vTaskDelay(pdMS_TO_TICKS(1));
  }
}
String randomToken() {
  char value[33];
  snprintf(value,sizeof(value),"%08lx%08lx%08lx%08lx",
           (unsigned long)esp_random(),(unsigned long)esp_random(),
           (unsigned long)esp_random(),(unsigned long)esp_random());
  return String(value);
}
bool authorized() {
  if (ecgServer.authenticate("vyana",benchPassword.c_str())) return true;
  ecgServer.requestAuthentication(BASIC_AUTH,"Vyaana ECG bench"); return false;
}
void noCache() { ecgServer.sendHeader("Cache-Control","no-store"); }
void samplesResponse() {
  if (!authorized()) return;
  const String query=ecgServer.arg("after");
  if (query.length()>18) { ecgServer.send(400,"text/plain","Invalid cursor"); return; }
  for (size_t i=0;i<query.length();++i) if (query[i]<'0'||query[i]>'9') {
    ecgServer.send(400,"text/plain","Invalid cursor"); return;
  }
  const uint64_t after=strtoull(query.c_str(),nullptr,10);
  portENTER_CRITICAL(&ecgMutex);
  const ADBenchBatch batch=ecgRing.copyAfter(after,responseSamples,256);
  portEXIT_CRITICAL(&ecgMutex);
  String output; output.reserve(12000);
  char head[250];
  snprintf(head,sizeof(head),"{\"boot_id\":\"%s\",\"latest_seq\":%llu,\"cursor\":%llu,\"missed_samples\":%llu,\"reset\":%s,\"samples\":[",
           bootId.c_str(),(unsigned long long)batch.latest,(unsigned long long)batch.cursor,
           (unsigned long long)batch.missed,batch.reset?"true":"false");
  output+=head;
  for (size_t i=0;i<batch.count;++i) {
    const auto& sample=responseSamples[i]; char row[100];
    snprintf(row,sizeof(row),"%s[%llu,%lu,%u,%u,%u]",i?",":"",
             (unsigned long long)sample.sequence,(unsigned long)sample.uptime,
             unsigned(sample.raw),unsigned(sample.loPlus),unsigned(sample.loMinus));
    output+=row;
  }
  output+="]}"; noCache(); ecgServer.send(200,"application/json",output);
}
void setup() {
  Serial.begin(115200); delay(300);
  Serial.println("AD8232 WIRELESS: OUT=34 LO+=35 LO-=32. SDN is not driven; follow the breakout schematic.");
  Serial.println("USB upload/debug: electrodes OFF BODY. Battery-only for body-connected wireless operation.");
  WiFi.mode(WIFI_STA); WiFi.setHostname("vyana-ecg"); WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  Preferences credentials;
  if (!credentials.begin("ecg-bench",false)) {
    Serial.println("ECG bench credential storage failed; wireless server disabled."); return;
  }
  benchPassword=credentials.getString("password","");
  if (benchPassword.length()!=32) {
    benchPassword=randomToken();
    if (credentials.putString("password",benchPassword)!=32) {
      credentials.end(); Serial.println("ECG credential persistence failed; server disabled."); return;
    }
  }
  credentials.end(); bootId=randomToken();
  initAD8232();
  acquisitionReady=xTaskCreatePinnedToCore(acquireSamples,"ad8232-capture",4096,nullptr,2,nullptr,1)==pdPASS;
  if (!acquisitionReady) { Serial.println("ECG acquisition task failed; server disabled."); return; }
  ecgServer.on("/",HTTP_GET,[]{
    if (!authorized()) return;
    noCache(); ecgServer.sendHeader("X-Content-Type-Options","nosniff");
    ecgServer.send_P(200,"text/html",AD_BENCH_VIEWER);
  });
  ecgServer.on("/samples",HTTP_GET,samplesResponse);
  ecgServer.on("/status",HTTP_GET,[]{
    if (!authorized()) return;
    portENTER_CRITICAL(&ecgMutex);
    auto batch=ecgRing.copyAfter(0,responseSamples,0);
    portEXIT_CRITICAL(&ecgMutex);
    char value[240];
    snprintf(value,sizeof(value),"{\"sensor\":\"AD8232\",\"boot_id\":\"%s\",\"uptime_ms\":%lu,\"latest_seq\":%llu,\"target_interval_ms\":4,\"raw_adc_max\":4095}",
             bootId.c_str(),(unsigned long)millis(),(unsigned long long)batch.latest);
    noCache(); ecgServer.send(200,"application/json",value);
  });
  ecgServer.onNotFound([]{ecgServer.send(404,"text/plain","Not found");});
  WiFi.begin(WIFI_SSID,WIFI_PASSWORD); ecgServer.begin();
}
void loop() {
  if (!acquisitionReady) { delay(50); return; }
  ecgServer.handleClient();
  if (uint32_t(millis()-lastNetworkLog)>=5000) {
    lastNetworkLog=millis();
    if (WiFi.status()==WL_CONNECTED) {
      if (!mdnsReady) mdnsReady=MDNS.begin("vyana-ecg");
      // Capture this privately with electrodes off; never put it in audit logs.
      Serial.printf("ECG_WIFI_READY {\"ip\":\"%s\",\"username\":\"vyana\",\"password\":\"%s\"}\n",
                    WiFi.localIP().toString().c_str(),benchPassword.c_str());
    } else Serial.println("ECG_WIFI_WAIT: waiting for saved Wi-Fi network; acquisition continues.");
  }
  delay(1);
}
