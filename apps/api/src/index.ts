import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import axios from 'axios';
import http from 'http';
import { Server } from 'socket.io';
import { z } from 'zod';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/healthguard'
});
const alertCooldowns = new Map<string, number>();

// DB Migrations (Simple runner)
pool.query(`
  CREATE TABLE IF NOT EXISTS vitals (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    heart_rate INT,
    spo2 FLOAT,
    temperature FLOAT,
    ecg_status VARCHAR(50),
    source VARCHAR(50)
  );
  CREATE TABLE IF NOT EXISTS activity (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    steps INT,
    distance_km FLOAT,
    calories INT,
    active_minutes INT,
    source VARCHAR(50)
  );
  CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    severity VARCHAR(20),
    title VARCHAR(100),
    detail TEXT,
    status VARCHAR(20),
    metric VARCHAR(50)
  );
  CREATE TABLE IF NOT EXISTS device_status (
    id SERIAL PRIMARY KEY,
    device_name VARCHAR(100),
    connected BOOLEAN,
    battery INT,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(50)
  );
`).catch(console.error);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
});

app.use(cors());
app.use(express.json());

const vitalSchema = z.object({
  heart_rate: z.number().min(0).max(300),
  spo2: z.number().min(0).max(100),
  temperature: z.number().min(20).max(45),
  ecg_status: z.string(),
  source: z.string()
});

const activitySchema = z.object({
  steps: z.number().min(0),
  distance_km: z.number().min(0),
  calories: z.number().min(0),
  active_minutes: z.number().min(0),
  source: z.string()
});

const getWellnessScore = async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const result = await pool.query(`SELECT * FROM vitals WHERE timestamp >= $1`, [yesterday]);
    const recentVitals = result.rows;
    if (recentVitals.length === 0) return 85;
    
    let score = 100;
    const avgHr = recentVitals.reduce((acc: number, v: any) => acc + v.heart_rate, 0) / recentVitals.length;
    const avgSpo2 = recentVitals.reduce((acc: number, v: any) => acc + v.spo2, 0) / recentVitals.length;
    
    if (avgHr > 90 || avgHr < 60) score -= 10;
    if (avgSpo2 < 95) score -= 15;
    
    return Math.max(0, Math.round(score));
};

app.post('/api/v1/device/status', async (req, res) => {
    const { device_name, connected, battery, source } = req.body;
    try {
        await pool.query('INSERT INTO device_status (device_name, connected, battery, source) VALUES ($1, $2, $3, $4)', [device_name, connected, battery, source]);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: String(e) });
    }
});

app.post('/api/v1/ingest/vitals', async (req, res) => {
    try {
        const { heart_rate, spo2, temperature, ecg_status, source } = vitalSchema.parse(req.body);
        await pool.query('INSERT INTO vitals (heart_rate, spo2, temperature, ecg_status, source) VALUES ($1, $2, $3, $4, $5)', [heart_rate, spo2, temperature, ecg_status, source]);
        
        const now = Date.now();
        const COOLDOWN_MS = 3600000; // 1 hour cooldown for duplicate alerts

        if (heart_rate > 120) {
            const lastHr = alertCooldowns.get('hr') || 0;
            if (now - lastHr > COOLDOWN_MS) {
                await pool.query('INSERT INTO alerts (severity, title, detail, status, metric) VALUES ($1, $2, $3, $4, $5)', ['warning', 'High Heart Rate', `Heart rate is ${heart_rate} bpm`, 'active', 'heart_rate']);
                alertCooldowns.set('hr', now);
            }
        }
        if (spo2 < 92) {
            const lastSpo2 = alertCooldowns.get('spo2') || 0;
            if (now - lastSpo2 > COOLDOWN_MS) {
                await pool.query('INSERT INTO alerts (severity, title, detail, status, metric) VALUES ($1, $2, $3, $4, $5)', ['warning', 'Low SpO2', `SpO2 is ${spo2}%`, 'active', 'spo2']);
                alertCooldowns.set('spo2', now);
            }
        }
        
        io.emit('health_update', { type: 'vitals', data: { heart_rate, spo2, temperature, ecg_status } });
        
        // Push an array of fake voltages for the new ECG waveform canvas to render
        const ecgVoltageStream = Array.from({length: 10}, () => (Math.random() - 0.5));
        io.emit('ecg_stream', ecgVoltageStream);
        
        res.json({ success: true });
    } catch(e) {
        if (e instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation Failed', details: e.issues });
        }
        res.status(500).json({ error: String(e) });
    }
});

app.post('/api/v1/ingest/activity', async (req, res) => {
    try {
        const { steps, distance_km, calories, active_minutes, source } = activitySchema.parse(req.body);
        await pool.query('INSERT INTO activity (steps, distance_km, calories, active_minutes, source) VALUES ($1, $2, $3, $4, $5)', [steps, distance_km, calories, active_minutes, source]);
        io.emit('health_update', { type: 'activity', data: { steps, distance_km, calories, active_minutes } });
        res.json({ success: true });
    } catch(e) {
        if (e instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation Failed', details: e.issues });
        }
        res.status(500).json({ error: String(e) });
    }
});

app.get('/api/v1/health/summary', async (req, res) => {
    try {
        const vitals = await pool.query('SELECT * FROM vitals ORDER BY id DESC LIMIT 1');
        const activity = await pool.query('SELECT * FROM activity ORDER BY id DESC LIMIT 1');
        const device = await pool.query('SELECT * FROM device_status ORDER BY id DESC LIMIT 1');
        const alerts = await pool.query('SELECT * FROM alerts WHERE status = $1 ORDER BY id DESC LIMIT 5', ['active']);
        
        const wellness_score = await getWellnessScore();
        let insights = [];
        try {
            const aiRes = await axios.post('http://127.0.0.1:8001/api/ai/insights', {
                vitals: vitals.rows[0] || {},
                activity: activity.rows[0] || {},
                alerts: alerts.rows || [],
                wellness_score: wellness_score
            });
            insights = aiRes.data.insights;
        } catch (aiErr: any) {
            console.error('AI Service Error:', aiErr.message);
            insights = [{ type: 'warning', title: 'AI Offline', detail: 'Could not connect to AI Agent.' }];
        }
        
        res.json({
            vitals: vitals.rows[0] || null,
            activity: activity.rows[0] || null,
            device: device.rows[0] || null,
            alerts: alerts.rows || [],
            insights,
            wellness_score
        });
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

app.get('/api/v1/vitals/latest', async (req, res) => {
    const vitals = await pool.query('SELECT * FROM vitals ORDER BY id DESC LIMIT 1');
    res.json(vitals.rows[0] || null);
});

app.get('/api/v1/vitals/trends', async (req, res) => {
    const vitals = await pool.query('SELECT * FROM vitals ORDER BY id DESC LIMIT 20');
    res.json(vitals.rows.reverse());
});

app.get('/api/v1/activity/summary', async (req, res) => {
    const activity = await pool.query('SELECT * FROM activity ORDER BY id DESC LIMIT 7');
    res.json(activity.rows.reverse());
});

app.get('/api/v1/alerts', async (req, res) => {
    const alerts = await pool.query('SELECT * FROM alerts ORDER BY id DESC LIMIT 20');
    res.json(alerts.rows);
});

app.get('/api/v1/device', async (req, res) => {
    const device = await pool.query('SELECT * FROM device_status ORDER BY id DESC LIMIT 1');
    res.json(device.rows[0] || null);
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`Node.js + Express backend running on port ${PORT}`);
});
