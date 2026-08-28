#ifndef AD8232_DRIVER_H
#define AD8232_DRIVER_H

#include <Arduino.h>

#define ECG_PIN 34 // ADC1_CH6
#define LO_PLUS 35 // Leads off detection +
#define LO_MINUS 32 // Leads off detection -

void initAD8232() {
    Serial.println("Initializing AD8232 (ECG)...");
    pinMode(LO_PLUS, INPUT);
    pinMode(LO_MINUS, INPUT);
}

String readECGStatus() {
    if((digitalRead(LO_PLUS) == 1) || (digitalRead(LO_MINUS) == 1)) {
        return "Leads Off";
    }
    
    // int ecgValue = analogRead(ECG_PIN);
    // Process ECG array...
    
    return "Normal";
}

#endif
