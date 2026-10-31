#pragma once
#include <stddef.h>
#include <stdint.h>

struct ADBenchSample {
  uint64_t sequence = 0;
  uint32_t uptime = 0;
  uint16_t raw = 0;
  uint8_t loPlus = 0, loMinus = 0;
};
struct ADBenchBatch {
  uint64_t latest = 0, cursor = 0, missed = 0;
  size_t count = 0;
  bool reset = false;
};

// Caller provides synchronization. Consumers copy briefly, then serialize
// outside the lock so slow HTTP clients never hold the acquisition mutex.
template <size_t Capacity> class ADBenchBuffer {
  static_assert(Capacity > 0, "Sample buffer must not be empty");
  ADBenchSample entries[Capacity]{};
  uint64_t newest = 0;
public:
  void append(uint32_t uptime, uint16_t raw, uint8_t plus, uint8_t minus) {
    const uint64_t seq = ++newest;
    entries[(seq - 1) % Capacity] = {seq, uptime, raw, plus, minus};
  }
  ADBenchBatch copyAfter(uint64_t after, ADBenchSample* output, size_t limit) const {
    ADBenchBatch batch;
    batch.latest = newest;
    batch.cursor = after;
    if (!newest) { batch.reset = after != 0; batch.cursor = 0; return batch; }
    const uint64_t oldest = newest > Capacity ? newest - Capacity + 1 : 1;
    if (after > newest) { batch.reset = true; after = oldest - 1; batch.cursor = after; }
    uint64_t first = after + 1;
    if (first < oldest) { batch.missed = oldest - first; first = oldest; }
    for (uint64_t seq = first; seq <= newest && batch.count < limit; ++seq) {
      output[batch.count++] = entries[(seq - 1) % Capacity];
      batch.cursor = seq;
    }
    return batch;
  }
};
