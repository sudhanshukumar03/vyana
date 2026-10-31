#pragma once
#include "Wire.h"
constexpr uint32_t I2C_SPEED_STANDARD = 100000;
struct MAX30105 {
  bool begin(TwoWire&, uint32_t) { return Wire.present; }
  void setup(int, int, int, int, int, int) {
    // Vendor setup performs a soft reset and FIFO clear itself.
    Wire.frames.clear();
    Wire.registers[0x04] = Wire.registers[0x05] = Wire.registers[0x06] = 0;
    ++Wire.clearAttempts;
    Wire.registers[0x08] = 0x40;
    Wire.registers[0x09] = 0x03;
    Wire.registers[0x0a] = Wire.badConfiguration ? 0 : 0x27;
  }
  void disableFIFORollover() {}
};
