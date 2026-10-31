#pragma once
#include "Arduino.h"
struct HTTPClient {
  template<class Client> bool begin(Client&, const String&) { return true; }
  void collectHeaders(const char**, int) {}
  void setConnectTimeout(int) {}
  void setTimeout(int) {}
  void addHeader(const char*, const char*) {}
  int POST(const String&) { return 200; }
  String header(const char*) { return String("0"); }
  void end() {}
};
