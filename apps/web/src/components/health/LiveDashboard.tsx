import React, { useState, useEffect } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { io } from 'socket.io-client';

export const LiveDashboard: React.FC = () => {
  const [ecgData, setEcgData] = useState<number[]>(Array(50).fill(50));
  const [hr, setHr] = useState(72);
  const [spo2, setSpo2] = useState(98);

  useEffect(() => {
    // Connect to the backend WebSocket
    const socket = io(); // Automatically uses the proxy in vite.config.ts

    socket.on('connect', () => {
      console.log('Connected to backend');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from backend');
    });

    socket.on('telemetry', (data) => {
      setEcgData(prev => {
        const newData = [...prev.slice(1)];
        newData.push(data.ecg);
        return newData;
      });
      setHr(data.hr);
      setSpo2(data.spo2);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <section id="dashboard" className="py-24 relative z-10">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="mb-12 flex justify-between items-end">
          <div>
            <h2 className="text-sm font-mono text-brand-purple tracking-[0.2em] uppercase mb-2 flex items-center gap-2">
              <div className="w-8 h-[1px] bg-brand-purple"></div>
              Telemetry
            </h2>
            <h3 className="text-4xl font-bold">Live <span className="text-glow-cyan text-brand-purple">Health Dashboard</span></h3>
          </div>
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-brand-emerald/10 border border-brand-emerald/30 rounded-full">
            <div className="w-2 h-2 rounded-full bg-brand-emerald animate-pulse-slow"></div>
            <span className="text-xs font-mono text-brand-emerald tracking-widest uppercase">Live Sync</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main ECG Chart */}
          <GlassCard className="col-span-1 lg:col-span-2 relative overflow-hidden" glowColor="cyan">
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-mono text-sm tracking-widest uppercase text-slate-400">ECG Waveform Stream</h4>
              <span className="text-brand-cyan text-xs font-mono">CH-1 500Hz</span>
            </div>
            
            <div className="h-48 w-full flex items-end gap-1 relative z-10">
              {ecgData.map((val, i) => (
                <div 
                  key={i} 
                  className="w-full bg-brand-cyan/60 rounded-t-sm transition-all duration-75"
                  style={{ height: `${val}%`, filter: 'drop-shadow(0 0 5px rgba(0,240,255,0.5))' }}
                ></div>
              ))}
            </div>
            
            {/* Grid overlay */}
            <div className="absolute inset-0 top-16 pointer-events-none opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(0,240,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.5) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          </GlassCard>

          {/* Vitals Sidebar */}
          <div className="space-y-6">
            <GlassCard glowColor="purple" className="flex items-center justify-between">
              <div>
                <h4 className="font-mono text-xs tracking-widest uppercase text-slate-400 mb-1">Heart Rate</h4>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white text-glow-cyan">{hr}</span>
                  <span className="text-sm font-mono text-brand-cyan">BPM</span>
                </div>
              </div>
              <div className="w-16 h-16 rounded-full border-4 border-brand-purple/20 border-t-brand-purple animate-spin-slow flex items-center justify-center relative">
                 <div className="absolute inset-2 rounded-full border-2 border-brand-cyan/30 border-b-brand-cyan animate-[spin_3s_linear_infinite_reverse]"></div>
              </div>
            </GlassCard>

            <GlassCard glowColor="blue" className="flex items-center justify-between">
              <div>
                <h4 className="font-mono text-xs tracking-widest uppercase text-slate-400 mb-1">Blood Oxygen</h4>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-brand-blue">{spo2}</span>
                  <span className="text-sm font-mono text-brand-blue">%</span>
                </div>
              </div>
              <div className="w-16 h-2 bg-brand-dark rounded-full overflow-hidden">
                <div className="h-full bg-brand-blue w-[98%] shadow-[0_0_10px_#0088ff]"></div>
              </div>
            </GlassCard>
            
            <GlassCard glowColor="emerald" className="bg-brand-emerald/5 border-brand-emerald/20">
              <h4 className="font-mono text-xs tracking-widest uppercase text-brand-emerald mb-2">Patient Condition</h4>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-brand-emerald rounded-sm shadow-[0_0_10px_#00ff88]"></div>
                <span className="text-xl font-bold text-white tracking-widest">NORMAL</span>
              </div>
            </GlassCard>
          </div>

        </div>
      </div>
    </section>
  );
};
