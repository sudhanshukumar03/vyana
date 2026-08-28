#ifndef MAX30102_DRIVER_H
#define MAX30102_DRIVER_H

#include <Wire.h>
#include "MAX30105.h"
#include "heartRate.h"

MAX30105 particleSensor;

void initMAX30102() {
    Serial.println("Initializing MAX30102 (HR/SpO2)...");
    if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
        Serial.println("MAX30102 was not found. Please check wiring/power.");
    } else {
        particleSensor.setup(); 
        particleSensor.setPulseAmplitudeRed(0x0A); // Turn Red LED to low to indicate sensor is running
        particleSensor.setPulseAmplitudeGreen(0); // Turn off Green LED
    }
}

int readHeartRate() {
    long irValue = particleSensor.getIR();
    if (checkForBeat(irValue)) {
        return 72 + random(-2, 2); // Stub: usually compute BPM using beat deltas
    }
    return 72;
}

float readSpO2() {
    // Stub: Calculate SpO2 using red/IR ratios
    return 98.0 + (random(-5, 5) / 10.0);
}

#endif
