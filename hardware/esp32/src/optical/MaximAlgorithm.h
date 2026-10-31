#pragma once
#include <stdint.h>

// Patched MAXREFDES117 algorithm, 100 samples at 25 Hz, 18-bit inputs.
// Called only from the acquisition task; internal working buffers are shared.
namespace optical_algorithm {
void calculate(const uint32_t* ir, int32_t length, const uint32_t* red,
               int32_t* spo2, int8_t* spo2Valid, int32_t* heartRate, int8_t* heartRateValid);
}
