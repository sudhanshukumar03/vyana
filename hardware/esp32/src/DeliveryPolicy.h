#pragma once
#include <stddef.h>
#include <stdint.h>

inline bool deliveryAccepted(int status) { return status >= 200 && status < 300; }
inline bool deliveryRetryable(int status) { return status <= 0 || status == 408 || status == 429 || status >= 500; }
class RetryWindow {
  uint32_t startedAt = 0, waitMs = 0;
public:
  bool ready(uint32_t now) const { return uint32_t(now - startedAt) >= waitMs; }
  void start(uint32_t now, uint32_t delayMs) { startedAt = now; waitMs = delayMs; }
};
inline uint32_t boundedRetryAfter(const char* value) {
  if (!value) return 0;
  while (*value == ' ' || *value == '\t') ++value;
  if (*value < '0' || *value > '9') return 0;
  uint32_t seconds = 0;
  while (*value >= '0' && *value <= '9') {
    const uint32_t next = seconds * 10 + uint32_t(*value++ - '0');
    seconds = next > 300 ? 300 : next;
  }
  while (*value == ' ' || *value == '\t') ++value;
  return *value ? 0 : seconds;
}
inline uint32_t retryDelay(unsigned attempt, uint32_t retryAfterSeconds = 0) {
  const uint32_t bounded = attempt > 6 ? 6 : attempt;
  const uint32_t exponential = 1000U << bounded;
  const uint32_t server = retryAfterSeconds > 300 ? 300000U : retryAfterSeconds * 1000U;
  return server > exponential ? server : exponential;
}

template<typename T, size_t Capacity> class RingQueue {
  T records[Capacity];
  size_t head = 0, count = 0;
public:
  size_t dropped = 0;
  bool push(const T& record) {
    if (count == Capacity) { ++dropped; return false; } // Drop newest; preserve queued acquisition order.
    records[(head + count) % Capacity] = record; ++count; return true;
  }
  T& front() { return records[head]; }
  void pop() { if (count) { head = (head + 1) % Capacity; --count; } }
  size_t size() const { return count; }
};
