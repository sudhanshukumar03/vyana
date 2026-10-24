#pragma once
// Copy to config.h (ignored by Git). Use a credential provisioned for this device.
constexpr const char* WIFI_SSID = "CONFIGURE_WIFI";
constexpr const char* WIFI_PASSWORD = "CONFIGURE_WIFI_PASSWORD";
constexpr const char* API_BASE = "https://your-deployment.example/api/v1";
constexpr const char* DEVICE_KEY = "CONFIGURE_A_PROVISIONED_DEVICE_CREDENTIAL";
constexpr const char* ROOT_CA = ""; // PEM root CA for the deployment; HTTPS fails closed without it.
constexpr bool ALLOW_INSECURE_HTTP = false; // Explicit local bench testing only.
