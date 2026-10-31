#pragma once
#include <math.h>
#include <stdint.h>

inline bool opticalUsable(bool hrValid, int32_t hr, bool spo2Valid, int32_t spo2,
                          bool computed, uint32_t ageMs) {
  return computed && ageMs <= 2500 && hrValid && spo2Valid &&
         hr > 0 && hr <= 300 && spo2 >= 0 && spo2 <= 100;
}
inline bool temperatureProbeUsable(float temperature, bool converted, uint32_t ageMs) {
  return converted && ageMs <= 2500 && isfinite(temperature) &&
         temperature >= -55 && temperature <= 125;
}
inline bool temperatureUsable(float temperature, bool converted, uint32_t ageMs) {
  return temperatureProbeUsable(temperature, converted, ageMs) && temperature >= 20 && temperature <= 45;
}
inline const char* ecgLeadStatus(bool leadsOff) {
  // Connected electrodes alone cannot establish a normal ECG rhythm.
  return leadsOff ? "Leads Off" : "Unknown";
}
