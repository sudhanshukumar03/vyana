import { useEffect, useRef, useState } from 'react';
import { useHealthStore } from '../store/useHealthStore';

// One cardiac cycle (phase 0..1) modeled as a sum of gaussian bumps: P, Q, R, S, T.
function ecgSample(phase: number): number {
  const g = (center: number, width: number, amp: number) =>
    amp * Math.exp(-((phase - center) ** 2) / (2 * width * width));
  return (
    g(0.16, 0.022, 0.12) +  // P wave
    g(0.37, 0.008, -0.16) + // Q
    g(0.40, 0.010, 1.0) +   // R spike
    g(0.43, 0.008, -0.28) + // S
    g(0.62, 0.040, 0.25)    // T wave
  );
}

export function ECGWaveform() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const vitals = useHealthStore(state => state.vitals);
  const fresh = useHealthStore(state => state.freshness.state === 'fresh');
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const media=window.matchMedia('(prefers-reduced-motion: reduce)'); const change=()=>setReduced(media.matches); media.addEventListener('change',change);return()=>media.removeEventListener('change',change); }, []);
  const available = Boolean(vitals && fresh && vitals.heart_rate > 20);
  // A synthetic illustration; it is not a measured ECG.
  const bpm = vitals?.heart_rate && vitals.heart_rate > 20 ? vitals.heart_rate : 72;
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  useEffect(() => {
    if (!isPlaying || !available) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const mid = H / 2;
    const pxPerSec = 160; // horizontal scroll speed
    const amp = H / 3;    // vertical scale
    const start = performance.now();
    let raf = 0;

    const render = (now: number) => {
      const elapsed = (now - start) / 1000;
      const beat = 60 / bpmRef.current; // seconds per beat
      ctx.clearRect(0, 0, W, H);

      // Baseline
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(W, mid);
      ctx.stroke();

      // Waveform (newest sample at the right edge, scrolling left)
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let x = 0; x <= W; x++) {
        const t = elapsed + (x - W) / pxPerSec;
        const phase = (((t / beat) % 1) + 1) % 1;
        const y = mid - ecgSample(phase) * amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      if (!reduced) raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, available, reduced]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-900">Synthetic ECG illustration</h3>
        <button
          disabled={!available || reduced}
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          aria-pressed={!isPlaying}
          aria-label={isPlaying ? 'Pause ECG waveform' : 'Play ECG waveform'}
          className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <span className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPlaying ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${isPlaying ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
          </span>
          <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">{!available ? 'Waiting for fresh data' : reduced ? 'Static preview' : isPlaying ? 'Animating' : 'Paused'}</span>
        </button>
      </div>
      <p className="text-sm text-muted mb-3">Illustrative waveform paced by heart rate. This is not a measured ECG or rhythm assessment.</p>
      <div className="flex-1 min-h-[160px] w-full bg-gray-50 rounded-lg overflow-hidden border border-gray-100 relative">
        {!available && <p role="status" className="absolute inset-0 grid place-content-center bg-surface-soft">Fresh heart-rate data is unavailable.</p>}
        <canvas
          ref={canvasRef}
          width={800}
          height={200}
          className="w-full h-full"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
