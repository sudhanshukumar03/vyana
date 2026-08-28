#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <vector>

// Simulated or real drivers
#include "sensors/MAX30102_Driver.h"
#include "sensors/AD8232_Driver.h"
#include "sensors/DS18B20_Driver.h"
#include "sensors/MPU6050_Driver.h"

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* backendUrl = "http://192.168.1.100:8000/api/v1/ingest/vitals";

std::vector<String> offlineBuffer;

// Queue to send sensor data to the WiFi task
QueueHandle_t sensorDataQueue;

// Struct to hold sensor data
struct SensorData {
    int heartRate;
    float spo2;
    float temp;
    char ecgStatus[32];
};

void sensorTask(void * pvParameters) {
    for(;;) {
        SensorData data;
        data.heartRate = readHeartRate();
        data.spo2 = readSpO2();
        data.temp = readTemperature();
        String ecg = readECGStatus();
        strncpy(data.ecgStatus, ecg.c_str(), sizeof(data.ecgStatus) - 1);
        data.ecgStatus[sizeof(data.ecgStatus) - 1] = '\0';

        xQueueSend(sensorDataQueue, &data, portMAX_DELAY);
        
        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}

void wifiTask(void * pvParameters) {
    for(;;) {
        SensorData data;
        if(xQueueReceive(sensorDataQueue, &data, portMAX_DELAY)) {
            StaticJsonDocument<200> doc;
            doc["heart_rate"] = data.heartRate;
            doc["spo2"] = data.spo2;
            doc["temperature"] = data.temp;
            doc["ecg_status"] = data.ecgStatus;
            doc["source"] = "ESP32_Hardware";

            String requestBody;
            serializeJson(doc, requestBody);

            if (WiFi.status() == WL_CONNECTED) {
                HTTPClient http;
                
                // Try to send buffered data first
                while (!offlineBuffer.empty()) {
                    http.begin(backendUrl);
                    http.addHeader("Content-Type", "application/json");
                    int res = http.POST(offlineBuffer.front());
                    http.end();
                    if (res > 0) {
                        offlineBuffer.erase(offlineBuffer.begin());
                        Serial.println("Buffered data sent!");
                    } else {
                        break; // Stop trying if sending fails
                    }
                }
                
                // Send current data
                http.begin(backendUrl);
                http.addHeader("Content-Type", "application/json");
                int httpResponseCode = http.POST(requestBody);
                
                if (httpResponseCode > 0) {
                    Serial.println(httpResponseCode);
                    Serial.println(http.getString());
                } else {
                    Serial.print("Error on sending POST: ");
                    Serial.println(httpResponseCode);
                    offlineBuffer.push_back(requestBody); // Buffer it
                }
                http.end();
            } else {
                Serial.println("WiFi disconnected, buffering data.");
                offlineBuffer.push_back(requestBody);
            }
        }
    }
}

void setup() {
    Serial.begin(115200);
    
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        Serial.println("Connecting to WiFi...");
    }
    Serial.println("Connected to WiFi!");

    initMAX30102();
    initAD8232();
    initDS18B20();
    initMPU6050();

    sensorDataQueue = xQueueCreate(10, sizeof(SensorData));

    xTaskCreatePinnedToCore(
        sensorTask,
        "SensorTask",
        4096,
        NULL,
        1,
        NULL,
        0
    );

    xTaskCreatePinnedToCore(
        wifiTask,
        "WiFiTask",
        8192,
        NULL,
        1,
        NULL,
        1
    );
}

void loop() {
    // Empty loop, handled by FreeRTOS tasks
    vTaskDelete(NULL);
}
