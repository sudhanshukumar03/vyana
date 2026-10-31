#pragma once
#include "Arduino.h"
struct WiFiClient {};
constexpr int WL_CONNECTED = 3;
constexpr int WIFI_STA = 1;
struct TestWiFi {
  int stationMode = 0;
  bool automaticReconnect = false, sleeping = true, started = false;
  std::string hostname;
  void mode(int value) { stationMode=value; }
  void setHostname(const char* value) { hostname=value; }
  void setAutoReconnect(bool value) { automaticReconnect=value; }
  void setSleep(bool value) { sleeping=value; }
  void begin(const char*, const char*) { started=true; }
  void reconnect() {}
  int status() { return WL_CONNECTED; }
};
static TestWiFi WiFi;
