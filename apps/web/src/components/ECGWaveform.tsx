import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export function ECGWaveform() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let x = 0;
    
    const ecgBuffer: number[] = [];
    
    const socket = io('http://localhost:8000'); // Explicit backend URL
    
    socket.on('ecg_stream', (data: number[]) => {
      ecgBuffer.push(...data);
    });

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#10b981'; // Tailwind emerald-500
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);

    const render = () => {
      // Clear with fade effect for trail
      ctx.fillStyle = 'rgba(249, 250, 251, 0.1)'; // Tailwind gray-50 bg fade
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let yOffset = 0;
      if (ecgBuffer.length > 0) {
        const val = ecgBuffer.shift();
        if (val !== undefined) {
           yOffset = val * (canvas.height / 3);
        }
      }

      const y = canvas.height / 2 - yOffset;
      
      // Add a bit of noise
      const noise = (Math.random() - 0.5) * 5;
      
      ctx.lineTo(x, y + noise);
      ctx.stroke();

      x += 2; // Speed

      if (x > canvas.width) {
        x = 0;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      socket.disconnect();
    };
  }, [isPlaying]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-900">Live ECG Waveform</h3>
        <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPlaying ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isPlaying ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
            </span>
            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">{isPlaying ? 'Live' : 'Paused'}</span>
        </div>
      </div>
      <div className="flex-1 w-full bg-gray-50 rounded-lg overflow-hidden border border-gray-100 relative">
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={200} 
          className="w-full h-full cursor-pointer"
          onClick={() => setIsPlaying(!isPlaying)}
        />
        <div className="absolute top-2 right-2 text-[10px] text-gray-400">Click to pause</div>
      </div>
    </div>
  );
}
