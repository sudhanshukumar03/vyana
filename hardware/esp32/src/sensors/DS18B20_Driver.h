#ifndef DS18B20_DRIVER_H
#define DS18B20_DRIVER_H

#include <OneWire.h>
#include <DallasTemperature.h>

#define ONE_WIRE_BUS 4 // Pin 4
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

void initDS18B20() {
    Serial.println("Initializing DS18B20 (Temperature)...");
    sensors.begin();
}

float readTemperature() {
    sensors.requestTemperatures(); 
    float tempC = sensors.getTempCByIndex(0);
    if(tempC != DEVICE_DISCONNECTED_C) {
        return tempC;
    }
    return NAN; // An unavailable sensor must not be reported as a normal temperature.
}

#endif
