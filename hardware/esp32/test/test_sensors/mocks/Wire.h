#pragma once
#include <stdint.h>
#include <array>
#include <deque>
#include <vector>

// Protocol fake: registers 0x04..06 track the hardware FIFO; 0x07 consumes a
// six-byte red/IR frame. Faults exercise the real driver's checked I2C reads.
struct TwoWire {
  bool present = true, nack = false, badConfiguration = false, missingByte = false, failClear = false, stickyOverflow = false;
  int shortRegister = -1;
  uint8_t registers[256]{}, selected = 0;
  unsigned clearAttempts = 0, beginCalls = 0;
  unsigned endCalls = 0;
  bool controllerStuck = false, failEnd = false, failBegin = false;
  int sdaPin = -1, sclPin = -1, clockHz = 0;
  TwoWire() { registers[0xff] = 0x15; }
  std::vector<uint8_t> tx;
  std::deque<uint8_t> rx;
  std::deque<std::array<uint8_t, 6>> frames;
  bool end() { ++endCalls; if (failEnd) return false; controllerStuck = false; return true; }
  bool begin(int sda, int scl, int clock) {
    ++beginCalls; sdaPin = sda; sclPin = scl; clockHz = clock; return !failBegin;
  }
  void setTimeOut(int) {}
  void beginTransmission(uint8_t) { tx.clear(); }
  size_t write(uint8_t value) { tx.push_back(value); return 1; }
  uint8_t endTransmission(bool = true) {
    selected = tx[0];
    if (selected == 0x04 && tx.size() == 2) ++clearAttempts;
    if (controllerStuck) return 4;
    if (!present || nack) return 2;
    if (failClear && selected >= 0x04 && selected <= 0x06 && tx.size() == 2) return 2;
    for (size_t i = 1; i < tx.size(); ++i) {
      const uint8_t target = uint8_t(selected + i - 1);
      if (!(stickyOverflow && target == 0x05)) registers[target] = tx[i];
    }
    if (selected == 0x04 && tx.size() == 2) frames.clear();
    return 0;
  }
  uint8_t requestFrom(uint8_t, uint8_t count) {
    rx.clear();
    if (!present || nack || controllerStuck) return 0;
    const uint8_t returned = selected == shortRegister ? count - 1 : count;
    if (selected == 0x07) {
      if (frames.empty()) return 0;
      for (uint8_t i = 0; i < returned; ++i) rx.push_back(frames.front()[i]);
      frames.pop_front();
      registers[0x06] = (registers[0x06] + 1) % 32;
      registers[0x05] = 0;
    } else {
      for (uint8_t i = 0; i < returned; ++i) rx.push_back(registers[uint8_t(selected + i)]);
    }
    if (missingByte && !rx.empty()) rx.pop_back();
    return returned;
  }
  int read() {
    if (rx.empty()) return -1;
    const int value = rx.front(); rx.pop_front(); return value;
  }
  void push(uint32_t red, uint32_t ir) {
    frames.push_back({uint8_t(red >> 16), uint8_t(red >> 8), uint8_t(red),
                      uint8_t(ir >> 16), uint8_t(ir >> 8), uint8_t(ir)});
    registers[0x04] = (registers[0x04] + 1) % 32;
  }
};
static TwoWire Wire;
