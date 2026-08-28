import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

export interface Vitals {
  heart_rate: number;
  spo2: number;
  temperature: number;
  ecg_status: string;
  timestamp: string;
}

export interface Activity {
  steps: number;
  distance_km: number;
  calories: number;
  active_minutes: number;
  timestamp: string;
}

export interface Alert {
  id: number;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
  timestamp: string;
  status: string;
}

export interface DeviceStatus {
  battery_level: number;
  is_charging: boolean;
  status: string;
  firmware_ver: string;
  timestamp: string;
}

export interface HealthInsight {
  type: 'info' | 'warning' | 'success' | 'critical';
  title: string;
  detail: string;
}

interface HealthState {
  vitals: Vitals | null;
  activity: Activity | null;
  alerts: Alert[];
  device: DeviceStatus | null;
  insights: HealthInsight[];
  wellnessScore: number;
  isConnected: boolean;
  isSocketConnected: boolean;
  lastUpdated: Date | null;
  historicalVitals: any[];
  historicalActivity: any[];
  
  // Actions
  fetchInitialData: () => Promise<void>;
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
}

const API_URL = 'http://localhost:8000/api/v1';
let socket: Socket | null = null;

export const useHealthStore = create<HealthState>((set) => ({
  vitals: null,
  activity: null,
  alerts: [],
  device: null,
  insights: [],
  wellnessScore: 0,
  isConnected: false,
  isSocketConnected: false,
  lastUpdated: null,
  historicalVitals: [],
  historicalActivity: [],

  fetchInitialData: async () => {
    try {
      const [summaryRes, trendsRes, actRes] = await Promise.all([
        fetch(`${API_URL}/health/summary`),
        fetch(`${API_URL}/vitals/trends`),
        fetch(`${API_URL}/activity/summary`)
      ]);

      if (summaryRes.ok) {
        const summary = await summaryRes.json();
        set({
          vitals: summary.vitals,
          activity: summary.activity,
          alerts: summary.alerts || [],
          device: summary.device,
          insights: summary.insights || [],
          wellnessScore: summary.wellness_score || 0,
          isConnected: true,
          lastUpdated: new Date()
        });
      }
      
      if (trendsRes.ok) {
        const trends = await trendsRes.json();
        set({ historicalVitals: trends });
      }
      
      if (actRes.ok) {
        const act = await actRes.json();
        set({ historicalActivity: act });
      }
      
    } catch (error) {
      console.error("Failed to fetch initial health data:", error);
      set({ isConnected: false });
    }
  },

  connectWebSocket: () => {
    if (socket) return;
    
    // Connect to backend websocket
    socket = io('http://localhost:8000');
    
    socket.on('connect', () => {
      set({ isSocketConnected: true });
    });

    socket.on('disconnect', () => {
      set({ isSocketConnected: false });
    });

    socket.on('health_update', (update: any) => {
      if (update.type === 'vitals') {
        set((state) => {
          const newVitals = { ...state.vitals, ...update.data, timestamp: new Date().toISOString() };
          
          // Prepend to history, keep last 20
          const newHistory = [newVitals, ...state.historicalVitals].slice(0, 20);
          
          return { vitals: newVitals, historicalVitals: newHistory, lastUpdated: new Date() };
        });
      }
      if (update.type === 'activity') {
        set((state) => ({
          activity: { ...state.activity, ...update.data, timestamp: new Date().toISOString() },
          lastUpdated: new Date()
        }));
      }
    });

    socket.on('new_alert', (alert: Alert) => {
       set((state) => ({
         alerts: [alert, ...state.alerts].slice(0, 50)
       }));
    });
  },

  disconnectWebSocket: () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  }
}));
