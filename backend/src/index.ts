import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Basic REST API endpoint
app.get('/api/health-stats', (req, res) => {
  res.json({
    status: 'ONLINE',
    uptime: process.uptime(),
    activePatients: 142
  });
});

// Socket.io for live telemetry streaming
io.on('connection', (socket) => {
  console.log('Client connected for live telemetry');

  // Emit live mock data every 100ms
  const telemetryInterval = setInterval(() => {
    socket.emit('telemetry', {
      ecg: Math.random() > 0.85 ? 20 + Math.random() * 80 : 45 + Math.random() * 10,
      hr: 70 + Math.floor(Math.random() * 5),
      spo2: 97 + Math.floor(Math.random() * 3),
      stress: (0.2 + Math.random() * 0.2).toFixed(1)
    });
  }, 100);

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    clearInterval(telemetryInterval);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
