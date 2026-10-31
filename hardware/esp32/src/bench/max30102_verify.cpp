// Diagnostic only: inspect real registers and drain checked six-byte frames.
// Same pins, clock, current and sampling settings in all phases. Compare FIFO
// rollover off / on / off, 15 seconds each. No HR/SpO2 estimates or Wi-Fi.
#include <Arduino.h>
#include <Wire.h>
#include <MAX30105.h>

MAX30105 verifySensor;
constexpr uint8_t address = 0x57;
uint32_t phaseStarted = 0, lastReport = 0, frames = 0, nonzeroFrames = 0;
uint32_t readFailures = 0, invalidPointers = 0, lastFrameAt = 0, red = 0, ir = 0;
uint8_t phase = 0, lastRegister = 0, lastCode = 0, lastReceived = 0;
uint8_t lastPointers[3]{};
bool configured = false, finished = false;

bool checkedRead(uint8_t reg, uint8_t* data, uint8_t count, bool stop = false) {
  Wire.beginTransmission(address); Wire.write(reg);
  const uint8_t code = Wire.endTransmission(stop);
  const uint8_t received = code == 0 ? Wire.requestFrom(address, count) : 0;
  if (code || received != count) {
    ++readFailures; lastRegister = reg; lastCode = code; lastReceived = received; return false;
  }
  for (uint8_t i = 0; i < count; ++i) {
    const int value = Wire.read();
    if (value < 0) {
      ++readFailures; lastRegister = reg; lastCode = 0; lastReceived = i; return false;
    }
    data[i] = uint8_t(value);
  }
  return true;
}

int registerValue(uint8_t reg) {
  uint8_t value = 0;
  return checkedRead(reg, &value, 1) ? int(value) : -1;
}

void report() {
  // Low-rate snapshots only; these are read-only configuration registers.
  const int id = registerValue(0xff), fifo = registerValue(0x08), mode = registerValue(0x09);
  const int rate = registerValue(0x0a), ledRed = registerValue(0x0c), ledIR = registerValue(0x0d);
  Serial.printf("{\"diagnostic\":\"MAX_FIFO_VERIFY\",\"phase\":%u,\"rollover\":%s,\"ms\":%lu,"
                "\"configured\":%s,\"frames\":%lu,\"nonzero_frames\":%lu,\"red\":%lu,\"ir\":%lu,"
                "\"fifo_write\":%u,\"fifo_overflow\":%u,\"fifo_read\":%u,\"last_frame_ms\":%lu,"
                "\"part_id\":%d,\"fifo_config\":%d,\"mode\":%d,\"spo2_config\":%d,\"led_red\":%d,\"led_ir\":%d,"
                "\"read_failures\":%lu,\"invalid_pointers\":%lu,\"last_register\":%u,\"wire_code\":%u,\"received\":%u}\n",
                unsigned(phase), phase == 1 ? "true" : "false", (unsigned long)millis(),
                configured ? "true" : "false", (unsigned long)frames, (unsigned long)nonzeroFrames,
                (unsigned long)red, (unsigned long)ir, unsigned(lastPointers[0]), unsigned(lastPointers[1]),
                unsigned(lastPointers[2]), (unsigned long)lastFrameAt, id, fifo, mode, rate, ledRed, ledIR,
                (unsigned long)readFailures, (unsigned long)invalidPointers, unsigned(lastRegister),
                unsigned(lastCode), unsigned(lastReceived));
}

void startPhase() {
  frames = nonzeroFrames = readFailures = invalidPointers = lastFrameAt = red = ir = 0;
  memset(lastPointers, 0, sizeof(lastPointers));
  lastRegister = lastCode = lastReceived = 0;
  configured = verifySensor.begin(Wire, MAX30102_I2C_HZ);
  if (configured) {
    verifySensor.setup(60, 4, 2, 100, 411, 4096);
    if (phase == 1) verifySensor.enableFIFORollover();
    else verifySensor.disableFIFORollover();
  }
  phaseStarted = lastReport = millis();
  report();
}

void setup() {
  Serial.begin(115200); delay(300);
  Serial.println("MAX-only verification: fixed D21/D22, 100 kHz; rollover OFF/ON/OFF. Raw data only.");
  Wire.begin(21, 22, MAX30102_I2C_HZ); Wire.setTimeOut(20);
  startPhase();
}

void loop() {
  if (finished) { delay(100); return; }
  if (uint32_t(millis() - phaseStarted) >= 15000) {
    report();
    if (++phase >= 3) { Serial.println("VERIFY_COMPLETE"); finished = true; return; }
    startPhase();
  }
  uint8_t pointers[3];
  if (configured && checkedRead(0x04, &pointers[0], 1) && checkedRead(0x05, &pointers[1], 1) &&
      checkedRead(0x06, &pointers[2], 1)) {
    memcpy(lastPointers, pointers, sizeof(pointers));
    if ((pointers[0] | pointers[1] | pointers[2]) & 0xe0) ++invalidPointers;
    else {
      uint8_t count = uint8_t((pointers[0] - pointers[2] + 32) % 32);
      if (!count && pointers[1]) count = 32; // Equal pointers can mean full FIFO.
      for (uint8_t i = 0; i < count; ++i) {
        uint8_t frame[6];
        if (!checkedRead(0x07, frame, 6, true)) break;
        red = ((uint32_t(frame[0]) << 16) | (uint32_t(frame[1]) << 8) | frame[2]) & 0x3ffff;
        ir = ((uint32_t(frame[3]) << 16) | (uint32_t(frame[4]) << 8) | frame[5]) & 0x3ffff;
        ++frames; lastFrameAt = millis();
        if (red && ir && red < 262000 && ir < 262000) ++nonzeroFrames;
      }
    }
  }
  if (uint32_t(millis() - lastReport) >= 2000) { lastReport = millis(); report(); }
  delay(5);
}
