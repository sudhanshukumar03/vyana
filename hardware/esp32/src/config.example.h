#pragma once
// Copy to config.h (ignored by Git). Use a credential provisioned for this device.
constexpr const char* WIFI_SSID = "CONFIGURE_WIFI";
constexpr const char* WIFI_PASSWORD = "CONFIGURE_WIFI_PASSWORD";
constexpr const char* API_BASE = "https://your-deployment.example/api/v1";
constexpr const char* DEVICE_KEY = "CONFIGURE_A_PROVISIONED_DEVICE_CREDENTIAL";
constexpr const char* ROOT_CA = ""; // PEM root CA for the deployment; HTTPS fails closed without it.
constexpr bool ALLOW_INSECURE_HTTP = false; // Explicit local bench testing only.

// Optional overrides; defaults live in HardwareConfig.h and also work with an
// existing config.h. Activity is imported independently through Google Health.
// #define MAX30102_MIN_IR 50000UL       // Contact threshold; tune on the bench.
// #define MAX30102_I2C_HZ 50000UL       // Optional slower bench clock; default 100000.
// #define ECG_STREAM_SERIAL 1          // CSV: ECG,uptime_ms,raw_adc,millivolts,leads_off
// #define BENCH_HTTP_CLOCK_FROM_API 1   // Trusted local HTTP API Date bootstrap if NTP is unavailable; also requires ALLOW_INSECURE_HTTP.
