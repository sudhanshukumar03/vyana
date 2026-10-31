#pragma once
#include <stdint.h>
#include <stdio.h>
#include <string>
#include <vector>
#include <deque>
#include <memory>
#include <string.h>
#include <time.h>
#include <stdlib.h>
#include <stdarg.h>

static uint32_t testMillis = 0;
static int testPins[40]{};
static uint16_t testADC = 2048;
static uint32_t testMillivolts = 1650;
inline uint32_t millis() { return testMillis; }
inline void delay(uint32_t duration) { testMillis += duration; }
constexpr int INPUT = 0, ADC_11db = 3;
static bool testADCChannelInitialized[40]{};
static bool testADCPinAttenuationApplied[40]{};
static unsigned testADCUninitializedAttenuationCalls = 0;
inline void pinMode(uint8_t, int) {}
inline void analogReadResolution(int) {}
inline void analogSetPinAttenuation(uint8_t pin, int) {
  // Arduino-ESP32 3.3.12 only configures attenuation on an attached channel.
  if (!testADCChannelInitialized[pin]) { ++testADCUninitializedAttenuationCalls; return; }
  testADCPinAttenuationApplied[pin] = true;
}
inline int digitalRead(uint8_t pin) { return testPins[pin]; }
inline uint16_t analogRead(uint8_t pin) {
  testADCChannelInitialized[pin] = true;
  return testADC;
}
inline uint32_t analogReadMilliVolts(uint8_t) { return testMillivolts; }
struct TestSerial {
  std::vector<std::string> lines;
  void begin(int) {}
  void println(const char* line) { lines.emplace_back(line); }
  void printf(const char* format, ...) {
    char line[1024]; va_list args; va_start(args, format);
    vsnprintf(line, sizeof(line), format, args); va_end(args); lines.emplace_back(line);
  }
};
static TestSerial Serial;

class String {
  std::string value;
public:
  String(const char* input) : value(input) {}
  String operator+(const char* suffix) const { return String((value + suffix).c_str()); }
  bool startsWith(const char* prefix) const { return value.find(prefix) == 0; }
  const char* c_str() const { return value.c_str(); }
  long toInt() const { return strtol(value.c_str(), nullptr, 10); }
};
#ifdef _WIN32
inline size_t strlcpy(char* destination, const char* source, size_t size) {
  if (size) { strncpy(destination, source, size - 1); destination[size - 1] = 0; }
  return strlen(source);
}
#endif
struct TestQueue { size_t capacity, itemSize; std::deque<std::vector<uint8_t>> records; };
using QueueHandle_t = TestQueue*;
static std::vector<std::unique_ptr<TestQueue>> testQueues;
static unsigned testQueueCreates = 0, testFailQueueAt = 0, testTaskCreates = 0, testFailTaskAt = 0;
constexpr int pdTRUE = 1, pdPASS = 1;
constexpr uint32_t portMAX_DELAY = UINT32_MAX;
inline uint32_t pdMS_TO_TICKS(uint32_t value) { return value; }
inline QueueHandle_t xQueueCreate(size_t capacity, size_t itemSize) {
  if (++testQueueCreates == testFailQueueAt) return nullptr;
  testQueues.emplace_back(new TestQueue{capacity, itemSize, {}});
  return testQueues.back().get();
}
inline int xQueueSend(QueueHandle_t queue, const void* item, uint32_t) {
  if (!queue || queue->records.size() >= queue->capacity) return 0;
  const auto* bytes = static_cast<const uint8_t*>(item);
  queue->records.emplace_back(bytes, bytes + queue->itemSize);
  return pdTRUE;
}
inline int xQueueReceive(QueueHandle_t queue, void* item, uint32_t) {
  if (!queue || queue->records.empty()) return 0;
  memcpy(item, queue->records.front().data(), queue->itemSize); queue->records.pop_front();
  return pdTRUE;
}
inline void vTaskDelay(uint32_t) {}
inline int xTaskCreatePinnedToCore(void (*)(void*), const char*, uint32_t, void*, int, void*, int) {
  return ++testTaskCreates == testFailTaskAt ? 0 : pdPASS;
}
inline uint32_t esp_random() { return 42; }
inline void esp_fill_random(void* bytes, size_t size) { memset(bytes, 42, size); }
inline void configTime(int, int, const char*, const char*) {}
struct TestESP { uint32_t getFreeHeap() { return 100000; } };
static TestESP ESP;
#ifdef _WIN32
inline tm* gmtime_r(const time_t* input, tm* output) {
  const tm* value = gmtime(input);
  if (!value) return nullptr;
  *output = *value; return output;
}
#endif
