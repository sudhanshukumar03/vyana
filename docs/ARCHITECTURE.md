# HealthGuard Architecture

HealthGuard is an end-to-end IoT and AI-driven healthcare monitoring platform.

## System Flow

1. **ESP32 Sensors (IoT)**
   The edge devices (or the software simulator) collect patient vital signs (heart rate, SpO2, body temperature) and motion data. Data is transmitted securely over MQTT or HTTP to the backend.

2. **Node.js REST API (Backend)**
   The Express.js backend receives the data from the edge devices. It validates the payload and manages the ingestion process.

3. **PostgreSQL (Database)**
   The backend stores the time-series health data and patient metadata in a structured format in PostgreSQL (accessed via Prisma ORM).

4. **Python AI Service (Analytics)**
   A FastAPI-based Python service retrieves data from the database (or receives it via internal API calls) to perform anomaly detection, predictive analytics, and generate personalized health insights using machine learning models.

5. **React Dashboard (Frontend)**
   A Next.js (React) frontend consumes the Node.js API to visualize real-time health metrics, historical trends, and AI-generated alerts for patients and healthcare providers.
