#pragma once
#include <stdint.h>

#ifndef MAX30102_MIN_IR
#define MAX30102_MIN_IR 50000UL
#endif
#ifndef MAX30102_I2C_HZ
#define MAX30102_I2C_HZ 100000UL
#endif
#ifndef ECG_STREAM_SERIAL
#define ECG_STREAM_SERIAL 0
#endif
#ifndef BENCH_HTTP_CLOCK_FROM_API
#define BENCH_HTTP_CLOCK_FROM_API 0
#endif

static_assert(MAX30102_MIN_IR > 0 && MAX30102_MIN_IR < 262000, "Contact threshold must be inside the ADC range");
static_assert(MAX30102_I2C_HZ >= 10000 && MAX30102_I2C_HZ <= 400000, "I2C clock must be 10000-400000 Hz");
static_assert(ECG_STREAM_SERIAL == 0 || ECG_STREAM_SERIAL == 1, "ECG serial flag must be 0 or 1");
static_assert(BENCH_HTTP_CLOCK_FROM_API == 0 || BENCH_HTTP_CLOCK_FROM_API == 1, "Bench HTTP clock flag must be 0 or 1");

constexpr uint32_t REPORT_INTERVAL_MS = 5000;
constexpr uint32_t ECG_SAMPLE_INTERVAL_MS = 4; // Target 250 Hz, best-effort polling.
constexpr const char* VITALS_SOURCE = "ESP32_MAX30102_DS18B20_AD8232";
