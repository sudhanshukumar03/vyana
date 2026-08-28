#ifndef MPU6050_DRIVER_H
#define MPU6050_DRIVER_H

#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>

Adafruit_MPU6050 mpu;

void initMPU6050() {
    Serial.println("Initializing MPU6050 (Motion/Steps)...");
    if (!mpu.begin()) {
        Serial.println("Failed to find MPU6050 chip");
    } else {
        mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
        mpu.setGyroRange(MPU6050_RANGE_500_DEG);
        mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    }
}

int readSteps() {
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);
    
    // Very basic pedometer logic (threshold-based)
    float acc_mag = sqrt(a.acceleration.x*a.acceleration.x + a.acceleration.y*a.acceleration.y + a.acceleration.z*a.acceleration.z);
    static int steps = 0;
    if (acc_mag > 12.0) { // Step threshold
        steps++;
    }
    return steps;
}

#endif
