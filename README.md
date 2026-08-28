# 🫀 AI-Based Smart Health Monitoring System

> **An IoT + AI-powered real-time patient health monitoring and emergency alert system**

[![ESP32](https://img.shields.io/badge/Hardware-ESP32-blue)](https://www.espressif.com/en/products/socs/esp32)
[![Python](https://img.shields.io/badge/AI-Python-yellow)](https://www.python.org/)
[![TensorFlow](https://img.shields.io/badge/ML-TensorFlow-orange)](https://www.tensorflow.org/)
[![React](https://img.shields.io/badge/Frontend-React-61DAFB)](https://react.dev/)
[![Firebase](https://img.shields.io/badge/Backend-Firebase-FFCA28)](https://firebase.google.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 📌 Overview

The **AI-Based Smart Health Monitoring System** is an IoT and Artificial Intelligence-based healthcare platform designed to continuously monitor a patient's vital health parameters in real time.

The system combines **biomedical sensors, ESP32, cloud infrastructure, real-time visualization, machine learning, and emergency notifications** into a single monitoring platform.

It continuously collects physiological data such as:

* ❤️ Heart Rate
* 🫁 SpO₂ (Blood Oxygen Saturation)
* 📈 ECG
* 🌡️ Body Temperature
* 🧍 Fall Detection

The collected data is processed and analyzed using a machine learning model that classifies the patient's current condition into:

> 🟢 **Normal** → 🟡 **Warning** → 🔴 **Critical**

When potentially dangerous conditions are detected, the system can trigger an **emergency alert** to predefined contacts.

---

# 🎯 Problem Statement

Traditional patient monitoring systems often require patients to remain connected to medical equipment or depend heavily on periodic manual observation.

This creates several challenges:

* Continuous monitoring is difficult outside hospitals.
* Abnormal vital signs may not be noticed immediately.
* Elderly or high-risk patients may require constant observation.
* Raw sensor data alone does not provide meaningful health classification.
* Emergency situations such as falls may go unnoticed.
* Caregivers may not have access to real-time patient information.

The proposed system addresses these problems by combining **IoT-based continuous monitoring with AI-assisted health classification and automated emergency alerts.**

---

# 💡 Proposed Solution

The system follows a complete pipeline:

```text
┌─────────────────────┐
│   Biomedical        │
│      Sensors        │
│                     │
│ ECG / PPG / SpO₂   │
│ Temperature / IMU   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│       ESP32         │
│   Data Acquisition  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Data Processing &   │
│   Preprocessing     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│     Cloud Layer     │
│ Firebase / Storage  │
└──────────┬──────────┘
           │
      ┌────┴─────┐
      ▼          ▼
┌──────────┐ ┌──────────────┐
│ AI/ML    │ │ Live Health  │
│ Model    │ │ Dashboard    │
└────┬─────┘ └──────────────┘
     │
     ▼
┌─────────────────────┐
│ Health Classification│
│                     │
│ Normal / Warning /  │
│ Critical            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Emergency Alert     │
│ SMS / Notification  │
└─────────────────────┘
```

---

# ✨ Key Features

## 🩺 Real-Time Vital Monitoring

Continuously monitor important physiological parameters:

| Parameter        | Purpose                             |
| ---------------- | ----------------------------------- |
| ❤️ Heart Rate    | Monitor cardiac activity            |
| 🫁 SpO₂          | Monitor blood oxygen level          |
| 📈 ECG           | Analyze cardiac electrical activity |
| 🌡️ Temperature  | Monitor body temperature            |
| 🧍 Motion / Fall | Detect possible falls               |

---

## 🤖 AI-Based Health Classification

The system uses a machine learning model to analyze collected health parameters and classify the patient's condition.

### Classification

```text
Sensor Data
     │
     ▼
Preprocessing
     │
     ▼
Feature Extraction
     │
     ▼
ML Model
     │
     ├── 🟢 NORMAL
     │
     ├── 🟡 WARNING
     │
     └── 🔴 CRITICAL
```

The model can be trained using publicly available healthcare datasets such as **PhysioNet** and evaluated using appropriate classification metrics.

> **Important:** The ML output is intended as a monitoring/alerting aid and is not a substitute for professional medical diagnosis.

---

# 📊 Monitoring Dashboard

The web dashboard provides caregivers or authorized users with a centralized view of patient health.

### Dashboard capabilities

* Real-time heart-rate monitoring
* Live ECG waveform
* SpO₂ monitoring
* Body-temperature monitoring
* Fall detection status
* Patient health classification
* Historical health data
* Alert history
* Patient status overview
* Real-time updates

Example dashboard structure:

```text
┌──────────────────────────────────────────────┐
│          SMART HEALTH DASHBOARD              │
├───────────────┬───────────────┬──────────────┤
│ Heart Rate    │ SpO₂          │ Temperature  │
│   78 BPM      │    98%        │    36.7°C    │
├───────────────┴───────────────┴──────────────┤
│                                              │
│              LIVE ECG WAVEFORM               │
│     ~~~~~/\~~~~~~/\~~~~~~/\~~~~~~             │
│                                              │
├───────────────────────┬──────────────────────┤
│ Fall Detection        │ AI Health Status     │
│       SAFE             │      🟢 NORMAL      │
└───────────────────────┴──────────────────────┘
```

---

# 🚨 Emergency Alert System

The system can automatically generate alerts when dangerous conditions are detected.

Examples include:

* Abnormally high/low heart rate
* Low SpO₂
* Abnormal ECG patterns
* Dangerous temperature
* Fall detection
* AI classification as **Critical**

### Alert Flow

```text
Abnormal Data
      │
      ▼
AI / Rule-Based Detection
      │
      ▼
Critical Condition?
   ┌──┴──┐
  NO     YES
   │      │
   ▼      ▼
Continue  Emergency
Monitoring Alert
            │
            ▼
       SMS / Notification
            │
            ▼
        Caregiver
```

The project can use **Twilio** or another notification service for emergency communication.

---

# 🧰 Hardware

## Core Components

| Component              | Role                                        |
| ---------------------- | ------------------------------------------- |
| **ESP32**              | Main microcontroller and communication unit |
| **AD8232**             | ECG signal acquisition                      |
| **MAX30100**           | Heart rate and SpO₂ measurement             |
| **Temperature Sensor** | Body-temperature monitoring                 |
| **MPU6050**            | Motion and fall detection                   |
| ECG Electrodes         | ECG signal collection                       |
| Jumper Wires           | Hardware connections                        |
| Breadboard / PCB       | Circuit prototyping                         |
| Power Supply           | System power                                |

> Component selection may change during implementation depending on sensor availability, accuracy, and final hardware design.

---

# 💻 Software Stack

## Frontend

* React.js
* JavaScript / TypeScript
* HTML
* CSS
* Recharts / charting library

## Backend & Cloud

* Firebase
* Firebase Authentication
* Firebase Realtime Database / Firestore
* Cloud-based data storage

## Machine Learning

* Python
* TensorFlow
* NumPy
* Pandas
* Scikit-learn
* PhysioNet datasets

## IoT / Embedded

* ESP32
* Arduino IDE / PlatformIO
* C/C++

## Notifications

* Twilio API

---

# 🏗️ System Architecture

```text
                    ┌─────────────────────┐
                    │       PATIENT       │
                    └──────────┬──────────┘
                               │
                               ▼
                 ┌─────────────────────────┐
                 │    Biomedical Sensors   │
                 │                         │
                 │ ECG | SpO₂ | HR | Temp │
                 │        MPU6050          │
                 └────────────┬────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │      ESP32       │
                    │ Data Acquisition │
                    └─────────┬────────┘
                              │
                         Wi-Fi / Internet
                              │
                              ▼
                    ┌──────────────────┐
                    │     Firebase     │
                    │  Cloud Database  │
                    └───────┬──────────┘
                            │
                  ┌─────────┴──────────┐
                  │                    │
                  ▼                    ▼
        ┌──────────────────┐   ┌─────────────────┐
        │   AI / ML Engine │   │ React Dashboard │
        └────────┬─────────┘   └─────────────────┘
                 │
                 ▼
       ┌─────────────────────┐
       │ Health Classification│
       │                     │
       │ Normal / Warning /  │
       │ Critical            │
       └──────────┬──────────┘
                  │
                  ▼
          ┌───────────────┐
          │ Alert System  │
          │    Twilio     │
          └───────┬───────┘
                  │
                  ▼
            👨‍⚕️ Caregiver
```

---

# 🧠 Machine Learning Pipeline

The ML component follows a structured pipeline.

### 1. Data Collection

Healthcare datasets are collected from reliable sources such as **PhysioNet**.

### 2. Data Preprocessing

```text
Raw Dataset
     │
     ├── Missing Value Handling
     ├── Noise Reduction
     ├── Normalization
     └── Signal Processing
           │
           ▼
      Clean Dataset
```

### 3. Feature Extraction

Relevant physiological features are extracted from the sensor signals.

Possible features include:

* Heart rate
* RR intervals
* ECG-related features
* SpO₂
* Temperature
* Signal statistics
* Motion features

### 4. Model Training

The processed dataset is used to train a classification model.

Possible models include:

* Random Forest
* XGBoost
* Neural Network
* CNN
* LSTM

The final model should be selected based on validation performance and suitability for deployment.

### 5. Prediction

```text
Patient Sensor Data
        │
        ▼
Feature Processing
        │
        ▼
Trained ML Model
        │
        ▼
Health Classification
```

---

# 📁 Project Structure

```text
smart-health-monitoring/
│
├── hardware/
│   ├── esp32/
│   │   ├── main.cpp
│   │   ├── sensors/
│   │   └── config/
│   │
│   └── circuit/
│       └── README.md
│
├── ml/
│   ├── datasets/
│   ├── notebooks/
│   ├── preprocessing/
│   ├── models/
│   ├── training/
│   ├── evaluation/
│   └── requirements.txt
│
├── backend/
│   ├── functions/
│   ├── config/
│   └── services/
│
├── frontend/
│   ├── public/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       ├── services/
│       ├── utils/
│       └── App.jsx
│
├── docs/
│   ├── architecture/
│   ├── diagrams/
│   ├── research/
│   └── screenshots/
│
├── .env.example
├── .gitignore
├── README.md
└── LICENSE
```

---

# 🔄 End-to-End Workflow

```text
1. Patient wears / connects sensors
                ↓
2. Sensors collect physiological signals
                ↓
3. ESP32 reads sensor values
                ↓
4. Data is transmitted through Wi-Fi
                ↓
5. Data reaches cloud infrastructure
                ↓
6. Data is processed and normalized
                ↓
7. ML model analyzes patient condition
                ↓
8. System determines health status
                ↓
       ┌────────┼────────┐
       ↓        ↓        ↓
    NORMAL   WARNING   CRITICAL
       │        │        │
       └────────┴────────┘
                ↓
       Dashboard Updated
                ↓
       Critical → Alert
```

---

# 🔐 Security & Privacy

Healthcare data requires careful handling.

The system is designed with security considerations such as:

* Authentication for dashboard access
* Environment variables for secrets
* Secure API communication
* Restricted database access
* Role-based access where applicable
* Avoiding sensitive credentials in source code
* Secure handling of patient data

**Never commit API keys, Firebase credentials, Twilio credentials, or other secrets to GitHub.**

Use:

```text
.env
```

and provide:

```text
.env.example
```

for required environment variables.

---

# 🚀 Getting Started

## Prerequisites

Install the following:

* Node.js
* Python 3.x
* Git
* Arduino IDE / PlatformIO
* ESP32 board support
* Firebase project
* Twilio account (if SMS alerts are enabled)

---

## 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/<repository-name>.git

cd <repository-name>
```

---

## 2. Frontend Setup

```bash
cd frontend
npm install
```

Create your environment file:

```bash
cp .env.example .env
```

Add the required Firebase configuration.

Run the development server:

```bash
npm run dev
```

---

## 3. ML Setup

```bash
cd ml

python -m venv venv
```

### Windows

```bash
venv\Scripts\activate
```

### Linux / macOS

```bash
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run the training pipeline according to the project configuration.

---

## 4. ESP32 Setup

1. Open the ESP32 project in Arduino IDE / PlatformIO.
2. Install the required sensor libraries.
3. Configure Wi-Fi credentials.
4. Configure Firebase/cloud credentials.
5. Connect the sensors according to the circuit diagram.
6. Upload the firmware to ESP32.
7. Open the serial monitor and verify sensor readings.

---

# 📡 Sensor Data Example

Example payload:

```json
{
  "heartRate": 78,
  "spo2": 98,
  "temperature": 36.7,
  "fallDetected": false,
  "ecg": [
    512,
    518,
    524,
    519,
    530
  ],
  "timestamp": "2026-08-13T18:00:00Z"
}
```

Example AI response:

```json
{
  "status": "NORMAL",
  "confidence": 0.94,
  "timestamp": "2026-08-13T18:00:02Z"
}
```

---

# 📈 Evaluation Metrics

The ML model should be evaluated using appropriate metrics rather than accuracy alone.

Recommended metrics:

* Accuracy
* Precision
* Recall
* F1 Score
* Confusion Matrix
* ROC-AUC where applicable

For healthcare classification, **false negatives are particularly important**, because failing to identify a potentially critical condition can be more consequential than generating an additional warning.

---

# 🧪 Testing

Testing should cover all major layers.

### Hardware Testing

* Sensor connectivity
* ECG signal quality
* SpO₂ readings
* Temperature readings
* Motion detection
* ESP32 Wi-Fi stability

### Software Testing

* API communication
* Firebase read/write operations
* Dashboard updates
* Authentication
* Alert triggering

### ML Testing

* Dataset preprocessing
* Training/validation split
* Model performance
* Class imbalance
* False positives / false negatives
* Real-world sensor noise

### Integration Testing

```text
Sensor
  ↓
ESP32
  ↓
Cloud
  ↓
ML
  ↓
Dashboard
  ↓
Alert
```

The complete pipeline should be tested end-to-end.

---

# 📊 Future Improvements

The project can be extended significantly.

### AI Improvements

* Deep learning-based ECG analysis
* LSTM-based time-series prediction
* Personalized health models
* Anomaly detection
* Continuous risk scoring
* Explainable AI

### Hardware Improvements

* Custom PCB
* Wearable form factor
* Lower-power design
* Additional biomedical sensors
* Improved ECG signal acquisition
* Battery optimization

### Software Improvements

* Mobile application
* Doctor/caregiver portal
* Patient history
* Health reports
* Advanced analytics
* Multi-patient monitoring
* Role-based access control

### Advanced Features

* Edge AI on ESP32 / edge device
* Offline monitoring
* Predictive health alerts
* Voice-based emergency assistance
* Geolocation-based emergency response
* Integration with healthcare platforms

---

# 🗺️ Development Roadmap

```text
[x] Project architecture
[x] Hardware component selection
[x] Sensor integration planning
[x] ML problem definition

[ ] ESP32 firmware
[ ] ECG acquisition
[ ] SpO₂ + heart-rate acquisition
[ ] Temperature monitoring
[ ] Fall detection
[ ] Cloud integration
[ ] Dataset preprocessing
[ ] ML model training
[ ] Model evaluation
[ ] React dashboard
[ ] Real-time visualization
[ ] Emergency notification system
[ ] End-to-end integration
[ ] Hardware prototype
[ ] Final testing
[ ] Documentation
```

---

# 🏆 Project Goals

The primary goals of this project are to:

1. Build a real-time IoT-based health monitoring system.
2. Collect physiological data using biomedical sensors.
3. Transmit health data through ESP32.
4. Store and visualize patient data in the cloud.
5. Develop an AI model for health-state classification.
6. Detect potentially dangerous conditions.
7. Generate automated emergency alerts.
8. Build a scalable architecture for future healthcare applications.

---

# ⚠️ Medical Disclaimer

This project is developed for **educational, research, and prototype purposes**.

It is **not a certified medical device** and should not be used as a replacement for professional medical diagnosis, treatment, or emergency medical services.

Sensor readings and AI predictions may contain errors due to sensor limitations, noise, environmental conditions, dataset limitations, or model uncertainty.

---

# 👨‍💻 Authors

**Sudhanshu Kumar**

Developed as an academic project exploring:

* Internet of Things (IoT)
* Embedded Systems
* Artificial Intelligence
* Machine Learning
* Biomedical Signal Processing
* Cloud Computing
* Full-Stack Development

---

# 📚 References & Resources

* [PhysioNet](https://physionet.org/)
* [TensorFlow](https://www.tensorflow.org/)
* [ESP32 Documentation](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/)
* [Firebase Documentation](https://firebase.google.com/docs)
* [React Documentation](https://react.dev/)
* [Twilio Documentation](https://www.twilio.com/docs)

---

# 📄 License

This project is licensed under the **MIT License**.

See the [`LICENSE`](LICENSE) file for details.

---

## ⭐ If you find this project interesting

Consider giving the repository a ⭐ and following the project as it evolves.

**Built with ❤️ using IoT + AI + Full-Stack Technology**
