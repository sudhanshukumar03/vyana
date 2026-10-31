#pragma once
#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include "../MeasurementPolicy.h"

constexpr uint8_t ONE_WIRE_BUS = 4;
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature temperatureSensor(&oneWire);
DeviceAddress temperatureAddress{};
struct TemperatureReading {
  bool initialized = false, present = false, converted = false, pending = false;
  float celsius = NAN;
  uint32_t requestedAt = 0, measuredAt = 0, discoveryAt = 0;
} temperature;

void requestProbeConversion() {
  temperature.pending = bool(temperatureSensor.requestTemperaturesByAddress(temperatureAddress));
  temperature.requestedAt = millis();
  if (!temperature.pending) {
    temperature.present = temperature.converted = false;
    temperature.celsius = NAN;
  }
}
void discoverDS18B20() {
  temperature.discoveryAt = millis();
  temperatureSensor.begin();
  temperature.initialized = temperatureSensor.getAddress(temperatureAddress, 0) &&
                            temperatureAddress[0] == 0x28;
  temperatureSensor.setWaitForConversion(false);
  if (temperature.initialized) {
    temperature.initialized = temperatureSensor.setResolution(temperatureAddress, 12);
    temperature.present = temperature.initialized;
    if (temperature.initialized) requestProbeConversion();
  }
}
void initDS18B20() {
  temperature = TemperatureReading{};
  discoverDS18B20();
  Serial.println(temperature.present ? "DS18B20: real temperature, asynchronous conversion." :
                                      "DS18B20: not found; temperature unavailable.");
}
void pollDS18B20(uint32_t now) {
  if (!temperature.initialized) {
    if (uint32_t(now - temperature.discoveryAt) >= 2000) discoverDS18B20();
    return;
  }
  if (uint32_t(now - temperature.requestedAt) < 1000) return;
  // Check completion before any bus reset/read of the scratchpad. A stalled
  // conversion must not turn a previous CRC-valid temperature into fresh data.
  temperature.converted = false;
  temperature.celsius = NAN;
  if (temperature.pending && temperatureSensor.isConversionComplete()) {
    const float measured = temperatureSensor.getTempC(temperatureAddress);
    temperature.converted = isfinite(measured) && measured >= -55 && measured <= 125;
    if (temperature.converted) {
      temperature.celsius = measured;
      temperature.measuredAt = now;
    }
  }
  temperature.present = temperature.converted;
  requestProbeConversion();
}
bool temperatureReadingReady(uint32_t now) {
  return temperature.present && temperatureUsable(temperature.celsius, temperature.converted,
                           uint32_t(now - temperature.measuredAt));
}
