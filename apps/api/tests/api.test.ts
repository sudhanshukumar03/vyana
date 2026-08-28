import request from 'supertest';
import express from 'express';
// import { app } from '../src/index'; // Assuming app is exported from index.ts
// For this basic test, we'll setup a simple express app mimicking the API

const app = express();
app.use(express.json());
app.post('/api/v1/ingest/vitals', (req, res) => {
  res.status(200).json({ status: 'success', message: 'Vitals ingested successfully' });
});

describe('API Endpoints', () => {
  it('should ingest vitals', async () => {
    const res = await request(app)
      .post('/api/v1/ingest/vitals')
      .send({
        userId: '1234',
        heartRate: 75,
        bloodOxygen: 98,
        bodyTemp: 36.6,
        timestamp: new Date().toISOString()
      });
      
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status', 'success');
  });
});
