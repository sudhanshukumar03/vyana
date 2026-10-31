#pragma once
#include "OneWire.h"
#include <string.h>
using DeviceAddress = uint8_t[8];
struct TestProbe {
  bool found = true, complete = true, requestSuccess = true, resolutionSuccess = true;
  uint8_t family = 0x28;
  float celsius = 36.5f;
  unsigned reads = 0;
};
static TestProbe testProbe;
struct DallasTemperature {
  explicit DallasTemperature(OneWire*) {}
  void begin() {}
  bool getAddress(uint8_t* address, uint8_t) {
    memset(address, 0, 8); address[0] = testProbe.family;
    return testProbe.found;
  }
  void setWaitForConversion(bool) {}
  bool setResolution(const uint8_t*, uint8_t) { return testProbe.resolutionSuccess; }
  bool requestTemperaturesByAddress(const uint8_t*) { return testProbe.found && testProbe.requestSuccess; }
  bool isConversionComplete() { return testProbe.complete; }
  float getTempC(const uint8_t*) { ++testProbe.reads; return testProbe.found ? testProbe.celsius : -127; }
};
