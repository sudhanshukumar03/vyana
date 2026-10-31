import { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import { useHealthStore } from '../store/useHealthStore';
import { liveEquipment } from '../services/equipment';
import { useSensorPreview } from '../store/useSensorPresentation';
import { RecordedECG } from './RecordedECG';

const trace = Array.from({ length: 1441 }, (_, i) => {
  const x = i, phase = (i % 200) / 200;
  const bump = (center: number, width: number, height: number) => height * Math.exp(-(((phase - center) / width) ** 2));
  const value = bump(.17, .035, .13) - bump(.32, .012, .2) + bump(.345, .009, 1.18) - bump(.37, .014, .32) + bump(.59, .065, .29);
  return `${i ? 'L' : 'M'}${x},${(112 - value * 68).toFixed(2)}`;
}).join(' ');

/** Real summaries stay separate from the explicitly generated display trace. */
export function ECGWaveform() {
  const { device, user } = useHealthStore();
  const preview = useSensorPreview((state) => state.enabled);
  const equipment = liveEquipment(device);

  const [simTick, setSimTick] = useState(0);
  useEffect(() => {
    if (!preview) return;
    const interval = setInterval(() => {
      setSimTick((t) => (t + 1) % 120);
    }, 250);
    return () => clearInterval(interval);
  }, [preview]);

  const isLive = Boolean(equipment);
  const isPreview = Boolean(preview);

  // Dynamic values
  const phase = simTick % 8;
  const simPulse = phase === 2 ? -180 : phase === 3 ? 620 : phase === 4 ? -260 : phase === 6 ? 140 : 0;
  const rawAdc = isLive ? equipment!.ecg_raw_adc : isPreview ? 2048 + simPulse : null;
  const millivolts = isLive
    ? equipment!.ecg_millivolts
    : isPreview
    ? Math.round(((rawAdc ?? 2048) / 4095) * 3300)
    : null;
  const clippedSamples = isLive ? equipment!.ecg_clipped_samples : 0;
  const totalSamples = isLive ? equipment!.ecg_samples : isPreview ? 1200 : 0;
  const leadStatus = isLive
    ? equipment!.ecg_status === 'Leads Off'
      ? 'Leads Off'
      : 'Normal Contact'
    : isPreview
    ? 'Normal Contact'
    : 'Awaiting Leads';
  const rhythmAssessment = isLive
    ? equipment!.ecg_status === 'Leads Off'
      ? 'Lead Detached'
      : 'Rhythm Unclassified'
    : isPreview
    ? 'Simulated Sinus Rhythm'
    : 'Standby / Offline';

  const status = !equipment
    ? isPreview
      ? 'Simulated active'
      : 'Waiting for input'
    : equipment.ecg_status === 'Leads Off'
    ? 'Leads off'
    : equipment.ecg_clipped_samples > 0
    ? 'Input clipping detected'
    : 'Input received';

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0A1322]/95 backdrop-blur-xl p-5 text-white shadow-xl space-y-4" aria-label="ECG sensor input">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" aria-hidden="true" />
          <h2 className="font-mono font-bold text-xs uppercase tracking-[0.14em] text-white/95 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" aria-hidden="true" />
            <span>LIVE TELEMETRY STREAM</span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs px-3 py-1 rounded-full bg-white/10 text-cyan-300 border border-white/15 backdrop-blur-md shadow-inner">
            ESP32 50Hz
          </span>
          <span className="status-chip bg-white/5 border-white/10 text-slate-300 font-mono text-[11px]">{status}</span>
        </div>
      </div>

      {preview ? (
        <div className="space-y-2">
          <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-400 font-mono">
            <span>ECG waveform preview · generated signal</span>
            <span>Display only · not a recorded ECG</span>
          </div>
          <div className="relative rounded-xl overflow-hidden border border-white/10 bg-[#060B14] p-1 shadow-inner">
            <svg viewBox="0 0 720 180" role="img" aria-label="Generated ECG waveform preview, not a measured signal" preserveAspectRatio="none" className="w-full h-44">
              <defs>
                <pattern id="ecg-preview-grid-dark" width="24" height="24" patternUnits="userSpaceOnUse">
                  <path d="M24 0H0V24" fill="none" stroke="rgba(56, 189, 248, 0.08)" strokeWidth="0.75" />
                </pattern>
                <filter id="cyan-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#38BDF8" floodOpacity="0.85" />
                </filter>
              </defs>
              <rect width="720" height="180" fill="url(#ecg-preview-grid-dark)" />
              <path className="ecg-preview-trace" d={trace} fill="none" stroke="#38BDF8" strokeWidth="2.2" filter="url(#cyan-glow)" />
            </svg>
          </div>
        </div>
      ) : device?.active ? (
        <RecordedECG key={`${user?.id}:${device.id}`} device={device.id} connected={device.connected} />
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-400 font-mono">
            <span>ECG Telemetry Channel · Standby</span>
            <span>Hardware sensor offline</span>
          </div>
          <div className="relative rounded-xl overflow-hidden border border-white/10 bg-[#060B14] p-1 shadow-inner">
            <svg viewBox="0 0 720 180" role="img" aria-label="ECG telemetry standby" preserveAspectRatio="none" className="w-full h-44">
              <defs>
                <pattern id="ecg-standby-grid-dark" width="24" height="24" patternUnits="userSpaceOnUse">
                  <path d="M24 0H0V24" fill="none" stroke="rgba(56, 189, 248, 0.08)" strokeWidth="0.75" />
                </pattern>
              </defs>
              <rect width="720" height="180" fill="url(#ecg-standby-grid-dark)" />
              <path d="M0 10H720 M0 90H720 M0 170H720" fill="none" stroke="rgba(56, 189, 248, 0.15)" />
              <path d="M0 90H720" fill="none" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1.5" strokeDasharray="6 4" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 bg-[#060B14]/50 backdrop-blur-[1px]">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0A1322]/90 border border-white/10 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="font-mono text-xs font-semibold text-amber-300 uppercase tracking-wide">
                  No Active Sensor Hub
                </span>
              </div>
              <p className="font-mono text-[11px] text-slate-400 text-center mt-2 max-w-sm">
                Pair your ESP32 device in Settings or enable demo mode to view real-time ECG simulation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Real-time ECG Parameters Grid */}
      <div className="space-y-2.5 pt-1" aria-label="ECG telemetry parameters">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-slate-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span>ECG Signal Parameters</span>
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            {isLive ? 'Hardware Stream Active' : isPreview ? 'Simulated Signal Active' : 'Sensor Hub Standby'}
          </span>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Raw ADC */}
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 shadow-xs flex flex-col justify-between">
            <dt className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Raw ADC</dt>
            <dd className="text-xl font-bold font-mono text-white mt-1">
              {rawAdc != null ? rawAdc : '—'}
              <span className="text-[10px] font-normal text-slate-400"> / 4095</span>
            </dd>
            <span className="text-[10px] font-mono text-slate-400 mt-0.5">12-bit AD8232</span>
          </div>

          {/* Voltage / Input Estimate */}
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 shadow-xs flex flex-col justify-between">
            <dt className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Signal Voltage</dt>
            <dd className="text-xl font-bold font-mono text-cyan-300 mt-1">
              {millivolts != null ? millivolts : '—'}
              <span className="text-[10px] font-normal text-slate-400"> mV</span>
            </dd>
            <span className="text-[10px] font-mono text-slate-400 mt-0.5">3.3V Full Scale</span>
          </div>

          {/* Sampling Rate */}
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 shadow-xs flex flex-col justify-between">
            <dt className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Sample Rate</dt>
            <dd className="text-xl font-bold font-mono text-emerald-300 mt-1">
              50 Hz
            </dd>
            <span className="text-[10px] font-mono text-slate-400 mt-0.5">20ms Window</span>
          </div>

          {/* Lead Quality */}
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 shadow-xs flex flex-col justify-between">
            <dt className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Lead Status</dt>
            <dd className={`text-base font-bold font-mono mt-1 ${
              leadStatus === 'Normal Contact' ? 'text-emerald-300' :
              leadStatus === 'Leads Off' ? 'text-rose-400' : 'text-amber-300'
            }`}>
              {leadStatus}
            </dd>
            <span className="text-[10px] font-mono text-slate-400 mt-0.5">RA/LA/RL Sensing</span>
          </div>

          {/* Clipped Readings */}
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 shadow-xs flex flex-col justify-between">
            <dt className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Clipped</dt>
            <dd className="text-xl font-bold font-mono text-amber-300 mt-1">
              {clippedSamples}
              <span className="text-[10px] font-normal text-slate-400"> / {totalSamples || '—'}</span>
            </dd>
            <span className="text-[10px] font-mono text-slate-400 mt-0.5">Saturation Guard</span>
          </div>

          {/* Rhythm Status */}
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 shadow-xs flex flex-col justify-between">
            <dt className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Cardiac Trace</dt>
            <dd className="text-xs font-bold font-mono text-white mt-1 leading-snug">
              {rhythmAssessment}
            </dd>
            <span className="text-[10px] font-mono text-slate-400 mt-0.5">Analog Front-End</span>
          </div>
        </dl>

        <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
          {leadStatus === 'Leads Off' ? '⚠️ Check electrode placement (RA, LA, RL). ' : ''}
          Continuous AD8232 analog front-end telemetry streamed via ESP32 ADC. Voltage estimate calibrated to 3.3V full-scale reference.
        </p>
      </div>
    </section>
  );
}
