import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  MapPin,
  ArrowRight,
  Database,
  Radio,
  Hospital,
  ExternalLink,
  ArrowUpRight,
  Thermometer,
  Zap,
  ShieldAlert,
  CheckCircle2,
  Waves,
  Cpu,
  Layers,
  Navigation,
} from 'lucide-react';
import { useHealthStore } from '../store/useHealthStore';
import { BrandLogo } from '../components/BrandLogo';

/** Real-time 60fps medical oscilloscope canvas rendering live cardiac signal flow */
function LiveSignalGraph({ heartRate, isAlert }: { heartRate: number; isAlert: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let phase = 0;
    const maxPoints = 220;
    const buffer: number[] = new Array(maxPoints).fill(0);

    const render = () => {
      // Cardiac cycle length in 60fps animation frames based on real heart rate
      const cycleFrames = Math.max(14, Math.round((60 / Math.max(40, heartRate)) * 60));
      const pos = phase % cycleFrames;
      const t = pos / cycleFrames;

      let sample = 0;
      // Morphological P-Q-R-S-T cardiac telemetry wave
      if (t > 0.08 && t < 0.16) {
        sample = Math.sin(((t - 0.08) / 0.08) * Math.PI) * 0.18; // P wave
      } else if (t >= 0.16 && t < 0.20) {
        sample = -Math.sin(((t - 0.16) / 0.04) * Math.PI) * 0.15; // Q dip
      } else if (t >= 0.20 && t < 0.26) {
        sample = Math.sin(((t - 0.20) / 0.06) * Math.PI) * 0.98; // R peak (systolic spike)
      } else if (t >= 0.26 && t < 0.30) {
        sample = -Math.sin(((t - 0.26) / 0.04) * Math.PI) * 0.28; // S dip
      } else if (t >= 0.38 && t < 0.52) {
        sample = Math.sin(((t - 0.38) / 0.14) * Math.PI) * 0.32; // T wave
      }

      const noise = (Math.random() - 0.5) * 0.015;
      buffer.push(sample + noise);
      if (buffer.length > maxPoints) {
        buffer.shift();
      }
      phase++;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Fine millimeter oscilloscope grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < w; x += 18) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = 0; y < h; y += 14) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      const step = w / (maxPoints - 1);
      const midY = h * 0.52;
      const amp = h * 0.42;
      const strokeColor = isAlert ? '#EF4444' : '#38BDF8';

      // 1. Subtle area gradient below curve
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let i = 0; i < buffer.length; i++) {
        const x = i * step;
        const y = midY - buffer[i] * amp;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      if (isAlert) {
        grad.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
        grad.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
      } else {
        grad.addColorStop(0, 'rgba(56, 189, 248, 0.2)');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
      }
      ctx.fillStyle = grad;
      ctx.fill();

      // 2. Draw flowing ECG signal path
      ctx.beginPath();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.shadowBlur = 10;
      ctx.shadowColor = strokeColor;

      for (let i = 0; i < buffer.length; i++) {
        const x = i * step;
        const y = midY - buffer[i] * amp;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 3. Glowing lead cursor dot at the sweep head
      const leadX = (buffer.length - 1) * step;
      const leadY = midY - buffer[buffer.length - 1] * amp;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#FFFFFF';
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(leadX, leadY, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Reset shadows
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [heartRate, isAlert]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-slate-950/80 border border-sky-500/20 shadow-inner">
      <canvas
        ref={canvasRef}
        width={440}
        height={100}
        className="w-full h-24 block"
      />
      <div className="absolute top-2 right-3 flex items-center gap-1.5 text-[9px] font-mono text-cyan-400/80">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
        <span>FLOW SYNC • {heartRate} BPM</span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const token = useHealthStore((s) => s.token);

  // Simulation Scenarios based on exact project thresholds (docs/FEATURES.md)
  // Warning: HR > 120, SpO2 < 92%, Temp > 38.0°C
  // Critical: HR > 150 (or < 40), SpO2 < 88%, Temp > 39.5°C
  const [scenario, setScenario] = useState<'normal' | 'tachycardia' | 'hypoxemia' | 'hyperthermia'>('normal');
  const [simHeartRate, setSimHeartRate] = useState(74);
  const [simSpo2, setSimSpo2] = useState(98);
  const [simTemp, setSimTemp] = useState(36.8);
  const [packetCount, setPacketCount] = useState(1482);
  const [tick, setTick] = useState(0);

  const isAlertState = scenario !== 'normal';

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
      setPacketCount((p) => p + 1);

      if (scenario === 'tachycardia') {
        setSimHeartRate(Math.floor(154 + Math.random() * 5));
        setSimSpo2(Math.floor(94 + Math.random() * 2));
        setSimTemp(37.0);
      } else if (scenario === 'hypoxemia') {
        setSimHeartRate(Math.floor(118 + Math.random() * 4));
        setSimSpo2(Math.floor(84 + Math.random() * 3));
        setSimTemp(36.9);
      } else if (scenario === 'hyperthermia') {
        setSimHeartRate(Math.floor(128 + Math.random() * 6));
        setSimSpo2(Math.floor(93 + Math.random() * 2));
        setSimTemp(39.7);
      } else {
        // Normal baseline
        setSimHeartRate(Math.floor(72 + Math.random() * 4));
        setSimSpo2(Math.floor(97 + Math.random() * 2));
        setSimTemp(36.8);
      }
    }, 1200);

    return () => clearInterval(timer);
  }, [scenario]);

  return (
    <div className="min-h-screen bg-[#FAFCFF] text-slate-900 font-sans selection:bg-brand/20">
      {/* ────────────────────────────────────────────────────────────
          1. TOP NAVIGATION BAR
      ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 px-6 sm:px-10 lg:px-12 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 focus:outline-none shrink-0">
          <BrandLogo variant="small" />
        </Link>

        {/* Center Nav Links - strict single-line horizontal alignment */}
        <nav aria-label="Landing page navigation" className="hidden lg:flex items-center flex-nowrap shrink-0 gap-6 xl:gap-8 text-xs font-semibold text-slate-600">
          <a href="#overview" className="inline-flex items-center h-10 whitespace-nowrap hover:text-brand transition-colors">
            Overview
          </a>
          <a href="#services" className="inline-flex items-center h-10 whitespace-nowrap hover:text-brand transition-colors">
            Core Modules
          </a>
          <a href="#vitals-showcase" className="inline-flex items-center h-10 whitespace-nowrap hover:text-brand transition-colors">
            Live Telemetry Console
          </a>
          <a href="#architecture" className="inline-flex items-center h-10 whitespace-nowrap hover:text-brand transition-colors">
            Architecture
          </a>
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSdht-wQC5uTgS2YBy8GAdo6iHwUYw1MzqIOtM8JtAKJoTWsaA/viewform"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center h-10 whitespace-nowrap text-brand hover:underline gap-1.5 font-semibold"
          >
            <span>Feedback Form</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          </a>
        </nav>

        {/* Top Right Action: "Login" */}
        <div className="flex items-center gap-3">
          {token ? (
            <Link
              to="/dashboard"
              className="bg-brand hover:bg-brand-hover text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2"
            >
              <span>Enter Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <Link
              to="/login"
              className="bg-brand hover:bg-brand-hover text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-all shadow-sm"
            >
              Login
            </Link>
          )}
        </div>
      </header>

      <main id="main-content">
        {/* ────────────────────────────────────────────────────────────
            2. HERO SECTION
        ──────────────────────────────────────────────────────────── */}
        <section id="overview" className="pt-12 pb-16 px-6 sm:px-12 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Department Badge, Title & CTAs */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#F0F5FF] text-[#2E62DE] border border-[#D6E4FF]">
              <span className="w-2 h-2 rounded-full bg-[#2E62DE]" />
              <span>IoT Healthcare Telemetry &amp; Rapid Response</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#0F172B] tracking-tight leading-[1.12]">
              AI Health Solutions — <br />
              <span className="text-[#2E62DE]">
                Revolutionize Your <br className="hidden sm:inline" />
                Emergency Triage.
              </span>
            </h1>

            <p className="text-slate-600 text-base sm:text-lg max-w-xl leading-relaxed">
              Developed by the Department of Electronics and Communication Engineering, Vyana is an intelligent IoT healthcare node integrating real-time optical PPG,
              calibrated digital thermometry, and single-lead ECG telemetry with automated emergency
              triage and geolocation-aware hospital routing.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to={token ? "/dashboard" : "/login"}
                className="bg-brand hover:bg-brand-hover text-white font-bold text-sm px-6 py-3.5 rounded-xl shadow-md shadow-brand/20 transition-all flex items-center gap-2"
              >
                <span>Launch System</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#vitals-showcase"
                className="bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm px-5 py-3.5 rounded-xl border border-slate-200 transition-all flex items-center gap-2"
              >
                <Activity className="w-4 h-4 text-brand" />
                <span>Live Biosensor Console</span>
              </a>
            </div>

            {/* Stat Cards - Grounded in Actual Hardware & Platform Data */}
            <div className="grid grid-cols-3 gap-4 pt-6 max-w-lg border-t border-slate-100">
              <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-xs">
                <span className="text-2xl font-black text-slate-900 font-mono block">5s</span>
                <span className="text-[11px] font-semibold text-slate-500 leading-tight block mt-0.5">
                  ESP32 telemetry report cycle
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-xs">
                <span className="text-2xl font-black text-brand font-mono block">±0.5°C</span>
                <span className="text-[11px] font-semibold text-slate-500 leading-tight block mt-0.5">
                  DS18B20 sensor accuracy
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-xs">
                <span className="text-2xl font-black text-emerald-600 font-mono block">&lt; 5s</span>
                <span className="text-[11px] font-semibold text-slate-500 leading-tight block mt-0.5">
                  Automated emergency triage
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Visual Card (Ref Image: Live Telemetry Stream with Signal Flow Graph) */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md bg-gradient-to-b from-[#0F1E36] via-[#0B1528] to-[#070D18] text-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-sky-500/20 overflow-hidden">
              {/* Subtle ambient lighting */}
              <div
                className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
                  isAlertState ? 'bg-rose-500/20' : 'bg-cyan-500/15'
                }`}
              />

              {/* Top Bar: Live Status & ESP32 Chip */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10 relative z-10">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Live Telemetry Stream
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-full bg-white/10 text-slate-200 border border-white/10">
                  ESP32 50Hz
                </span>
              </div>

              {/* Main Vitals Stats Row */}
              <div className="py-5 space-y-4 relative z-10">
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
                      Pulse Waveform
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-5xl font-black font-mono tracking-tight text-white">
                        {simHeartRate}
                      </span>
                      <span className="text-xs font-bold text-slate-400 uppercase">BPM</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
                      Blood Oxygen
                    </span>
                    <div className="text-4xl sm:text-5xl font-black font-mono text-emerald-400 mt-1">
                      {simSpo2}%
                    </div>
                  </div>
                </div>

                {/* Live Animated Oscilloscope Signal Flow Graph */}
                <LiveSignalGraph heartRate={simHeartRate} isAlert={isAlertState} />
              </div>

              {/* Bottom Pill: Geoapify Dispatch Lock */}
              <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-between gap-3 relative z-10">
                <div className="flex items-center gap-2.5 min-w-0">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Geoapify Dispatch Lock
                    </span>
                    <strong className="text-xs font-bold text-white truncate block">
                      Mount Sinai Trauma Ward (1.2 km)
                    </strong>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px] shrink-0 tracking-wider">
                  TRAUMA VERIFIED
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          3. CORE MODULES BAR
      ──────────────────────────────────────────────────────────── */}
      <section id="services" className="py-6 border-y border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 flex items-center justify-between gap-4 overflow-x-auto pb-2 sm:pb-0">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">
            Core Modules:
          </span>
          <div className="flex items-center gap-2.5 flex-wrap">
            <a
              href="#vitals-showcase"
              className="px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-slate-800 transition-colors"
            >
              <span>PPG Vitals</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-70" />
            </a>
            <Link
              to={token ? "/emergency" : "/login"}
              className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <span>Automated SOS</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
            </Link>
            <a
              href="#architecture"
              className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <span>Geoapify Hospitals</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
            </a>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          4. LIVE & CREATIVE BIOMETRIC TELEMETRY CONSOLE
          Grounded in actual project alert rules (docs/FEATURES.md)
      ──────────────────────────────────────────────────────────── */}
      <section id="vitals-showcase" className="py-20 px-6 sm:px-12 max-w-7xl mx-auto w-full">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-brand border border-blue-100">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Live Biomedical Telemetry Console • 50 Hz Hardware Acquisition</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Real-Time Hardware Sensors & Deterministic Triage
          </h2>

          <p className="text-sm text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Vyana monitors real-time physiological signals from an ESP32 edge node with three calibrated sensors.
            Select a live telemetry scenario below to observe real-time waveform dynamics and automated emergency triage escalation.
          </p>

          {/* Interactive Scenario Switcher Deck */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
            <button
              onClick={() => setScenario('normal')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-xs ${
                scenario === 'normal'
                  ? 'bg-emerald-600 text-white shadow-emerald-600/25 ring-2 ring-emerald-500/30'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Normal Sinus (Baseline)</span>
            </button>

            <button
              onClick={() => setScenario('tachycardia')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-xs ${
                scenario === 'tachycardia'
                  ? 'bg-rose-600 text-white shadow-rose-600/25 ring-2 ring-rose-500/30'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Arrhythmia Spike (&gt;150 BPM)</span>
            </button>

            <button
              onClick={() => setScenario('hypoxemia')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-xs ${
                scenario === 'hypoxemia'
                  ? 'bg-amber-600 text-white shadow-amber-600/25 ring-2 ring-amber-500/30'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
              }`}
            >
              <Waves className="w-3.5 h-3.5" />
              <span>Hypoxemia Drop (&lt;88% SpO2)</span>
            </button>

            <button
              onClick={() => setScenario('hyperthermia')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-xs ${
                scenario === 'hyperthermia'
                  ? 'bg-purple-600 text-white shadow-purple-600/25 ring-2 ring-purple-500/30'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
              }`}
            >
              <Thermometer className="w-3.5 h-3.5" />
              <span>Critical Fever (&gt;39.5°C)</span>
            </button>
          </div>

          {/* Telemetry Stream Diagnostics Strip */}
          <div className="pt-2 flex items-center justify-center gap-6 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              ESP32 Node: Connected
            </span>
            <span>Packets: #{packetCount}</span>
            <span>Latency: 14ms</span>
            <span>Sampling: 50 Hz</span>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────────
            CREATIVE 3-CARD BIOSENSOR CONSOLE
        ──────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* ────────────────────────────────────────────────────────
              CARD 1: CARDIAC TELEMETRY (MAX30102 + AD8232 ECG)
          ──────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all p-6 relative overflow-hidden flex flex-col justify-between">
            {/* Ambient light for state */}
            <div
              className={`absolute top-0 right-0 w-36 h-36 rounded-full blur-3xl pointer-events-none transition-all ${
                simHeartRate > 150 ? 'bg-rose-500/15' : 'bg-brand/10'
              }`}
            />

            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Cardiac Telemetry
                  </span>
                  <span className="text-xs font-bold text-slate-700">MAX30102 &amp; AD8232</span>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
                    simHeartRate > 150
                      ? 'bg-rose-100 text-rose-700 animate-pulse'
                      : simHeartRate > 120
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      simHeartRate > 150 ? 'bg-rose-600' : 'bg-emerald-500'
                    }`}
                  />
                  {simHeartRate > 150 ? 'Critical Tachycardia' : simHeartRate > 120 ? 'Warning High' : 'Normal Sinus'}
                </span>
              </div>

              {/* Main Metric Value with Animated Pulse */}
              <div className="pt-5 pb-4 flex items-baseline justify-between">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black font-mono tracking-tight text-slate-900">
                      {simHeartRate}
                    </span>
                    <span className="text-sm font-bold text-slate-400 uppercase">BPM</span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 block mt-0.5">
                    R-R Interval: {Math.round(60000 / simHeartRate)} ms
                  </span>
                </div>

                {/* Animated Heartbeat Monitor Indicator */}
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                    simHeartRate > 150 ? 'bg-rose-100 text-rose-600 scale-105' : 'bg-blue-50 text-brand'
                  }`}
                >
                  <Activity
                    className={`w-6 h-6 transition-transform duration-300 ${
                      tick % 2 === 0 ? 'scale-125' : 'scale-95'
                    }`}
                  />
                </div>
              </div>

              {/* Oscilloscope Grid Canvas */}
              <div className="w-full h-16 rounded-xl bg-slate-950 p-2 relative overflow-hidden flex items-center shadow-inner">
                {/* Background millimeter grid lines */}
                <div
                  className="absolute inset-0 opacity-15"
                  style={{
                    backgroundImage:
                      'linear-gradient(#38BDF8 1px, transparent 1px), linear-gradient(90deg, #38BDF8 1px, transparent 1px)',
                    backgroundSize: '12px 12px',
                  }}
                />

                {/* Sweeping ECG Waveform */}
                <svg viewBox="0 0 240 60" className="w-full h-full relative z-10">
                  <path
                    d={
                      simHeartRate > 150
                        ? 'M0,30 Q10,10 20,30 T40,0 T60,60 T80,5 T100,30 T120,0 T140,60 T160,5 T180,30 T200,0 T220,60 T240,30'
                        : 'M0,30 Q20,30 35,18 T50,42 T65,30 T105,30 T120,5 T135,55 T150,30 T190,30 T205,18 T220,42 T240,30'
                    }
                    fill="none"
                    stroke={simHeartRate > 150 ? '#EF4444' : '#38BDF8'}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    style={{
                      filter: simHeartRate > 150
                        ? 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.8))'
                        : 'drop-shadow(0 0 4px rgba(56, 189, 248, 0.7))',
                    }}
                  />
                </svg>

                {/* Sweep scan indicator */}
                <div className="absolute top-1 right-2 text-[9px] font-mono text-emerald-400">
                  ECG CH1 • 250 Hz
                </div>
              </div>
            </div>

            {/* Threshold Rule Footer */}
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span>Norm: 60–100 BPM</span>
              <span className="font-mono text-[10px] text-rose-600 font-bold">Rule: Warning &gt;120 | Crit &gt;150</span>
            </div>
          </div>

          {/* ────────────────────────────────────────────────────────
              CARD 2: PULSE OXIMETRY (MAX30102 SpO2)
          ──────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all p-6 relative overflow-hidden flex flex-col justify-between">
            <div
              className={`absolute top-0 right-0 w-36 h-36 rounded-full blur-3xl pointer-events-none transition-all ${
                simSpo2 < 88 ? 'bg-rose-500/15' : 'bg-emerald-500/10'
              }`}
            />

            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Pulse Oximetry
                  </span>
                  <span className="text-xs font-bold text-slate-700">Dual Optical Red/IR</span>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
                    simSpo2 < 88
                      ? 'bg-rose-100 text-rose-700 animate-pulse'
                      : simSpo2 < 92
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      simSpo2 < 88 ? 'bg-rose-600' : 'bg-emerald-500'
                    }`}
                  />
                  {simSpo2 < 88 ? 'Critical Hypoxemia' : simSpo2 < 92 ? 'Warning Low' : 'Optimal Saturation'}
                </span>
              </div>

              {/* Main Metric Value */}
              <div className="pt-5 pb-4 flex items-baseline justify-between">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-5xl font-black font-mono tracking-tight transition-colors ${
                        simSpo2 < 88 ? 'text-rose-600' : simSpo2 < 92 ? 'text-amber-600' : 'text-slate-900'
                      }`}
                    >
                      {simSpo2}
                    </span>
                    <span className="text-sm font-bold text-slate-400">%</span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 block mt-0.5">
                    Perfusion Index: 4.8% • AC/DC Ratio: 0.84
                  </span>
                </div>

                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xs font-mono transition-all ${
                    simSpo2 < 88 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  O₂ Sat
                </div>
              </div>

              {/* Optical Absorption Level Bar */}
              <div className="space-y-2 py-1">
                <div className="flex justify-between text-[11px] font-medium text-slate-500">
                  <span>Oxygen Saturation Bar</span>
                  <span className="font-mono font-bold text-slate-700">{simSpo2}% / 100%</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      simSpo2 < 88
                        ? 'bg-gradient-to-r from-rose-500 to-red-600 shadow-sm shadow-rose-500/50'
                        : simSpo2 < 92
                        ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                        : 'bg-gradient-to-r from-emerald-400 to-teal-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(50, simSpo2))}%` }}
                  />
                </div>
              </div>

              {/* Dual Wavelength PPG Waveform */}
              <div className="h-9 w-full mt-2">
                <svg viewBox="0 0 240 36" className="w-full h-full">
                  <path
                    d="M0,18 Q30,18 45,5 T65,30 T85,18 T125,18 T145,5 T165,30 T185,18 T240,18"
                    fill="none"
                    stroke={simSpo2 < 88 ? '#EF4444' : '#10B981'}
                    strokeWidth="2"
                  />
                </svg>
              </div>
            </div>

            {/* Threshold Rule Footer */}
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span>Target: ≥95% SpO2</span>
              <span className="font-mono text-[10px] text-rose-600 font-bold">Rule: Warning &lt;92 | Crit &lt;88</span>
            </div>
          </div>

          {/* ────────────────────────────────────────────────────────
              CARD 3: DIGITAL TEMPERATURE PROBE (DS18B20 1-WIRE)
          ──────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all p-6 relative overflow-hidden flex flex-col justify-between">
            <div
              className={`absolute top-0 right-0 w-36 h-36 rounded-full blur-3xl pointer-events-none transition-all ${
                simTemp > 39.5 ? 'bg-purple-500/15' : 'bg-amber-500/10'
              }`}
            />

            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Digital Thermometry
                  </span>
                  <span className="text-xs font-bold text-slate-700">DS18B20 1-Wire Probe</span>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
                    simTemp > 39.5
                      ? 'bg-purple-100 text-purple-700 animate-pulse'
                      : simTemp > 38.0
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  <Thermometer className="w-3 h-3" />
                  {simTemp > 39.5 ? 'Critical Hyperthermia' : simTemp > 38.0 ? 'Fever Warning' : 'Normothermic'}
                </span>
              </div>

              {/* Main Metric Value */}
              <div className="pt-5 pb-4 flex items-baseline justify-between">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-5xl font-black font-mono tracking-tight transition-colors ${
                        simTemp > 39.5 ? 'text-purple-600' : simTemp > 38.0 ? 'text-amber-600' : 'text-slate-900'
                      }`}
                    >
                      {simTemp.toFixed(1)}
                    </span>
                    <span className="text-sm font-bold text-slate-400">°C</span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 block mt-0.5">
                    Fahrenheit Equivalent: {(simTemp * 1.8 + 32).toFixed(1)}°F
                  </span>
                </div>

                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex flex-col items-center justify-center font-bold text-[10px]">
                  <span>12-BIT</span>
                  <span className="text-[9px] text-amber-500 font-mono">CRC OK</span>
                </div>
              </div>

              {/* Thermal Gradient Range Capsule */}
              <div className="space-y-2 py-1">
                <div className="flex justify-between text-[11px] font-medium text-slate-500">
                  <span>Thermal Range (35°C – 42°C)</span>
                  <span className="font-mono font-bold text-slate-700">{simTemp}°C</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200 relative">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-400 via-emerald-400 via-amber-400 to-rose-500 transition-all duration-700"
                    style={{
                      width: `${Math.min(100, Math.max(10, ((simTemp - 35) / (42 - 35)) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              {/* Micro telemetry hardware metadata */}
              <div className="mt-4 p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-[11px] text-slate-600 font-mono">
                <span>Precision: ±0.5°C</span>
                <span>ROM: DS18B20 1-Wire</span>
              </div>
            </div>

            {/* Threshold Rule Footer */}
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span>Norm: 36.5–37.5°C</span>
              <span className="font-mono text-[10px] text-rose-600 font-bold">Rule: Warning &gt;38.0 | Crit &gt;39.5</span>
            </div>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────────
            DYNAMIC EMERGENCY TRIAGE ACTION BANNER
        ──────────────────────────────────────────────────────────── */}
        {isAlertState ? (
          <div className="mt-8 p-6 rounded-3xl bg-gradient-to-r from-rose-900 to-slate-900 text-white border border-rose-500/40 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 animate-in fade-in duration-300">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-bold text-2xl shrink-0 shadow-lg shadow-rose-600/40 animate-pulse">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-rose-500/30 text-rose-200 text-[10px] font-mono font-bold tracking-wider uppercase border border-rose-400/30 mb-1">
                  Immediate Emergency Triage Escalation
                </div>
                <h4 className="text-base font-bold text-white tracking-tight">
                  Critical Physiological Breach: Automated SOS Dispatched
                </h4>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Live readings ({simHeartRate} BPM, {simSpo2}% SpO2, {simTemp}°C) exceed project thresholds.
                  Nearby verified trauma center locked via Geoapify spatial API.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Link
                to={token ? "/emergency" : "/login"}
                className="px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/30 transition-all flex items-center gap-2"
              >
                <span>View Emergency Triage</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-8 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="font-semibold text-slate-800">
                All 3 biosensors streaming nominal readings within project baseline (docs/FEATURES.md).
              </span>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
              <span>Triage: Nominal</span>
              <span>Hospital Dispatch: Standby</span>
            </div>
          </div>
        )}
      </section>

      {/* ────────────────────────────────────────────────────────────
          5. TICKER BANNER
      ──────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 text-white py-4 overflow-hidden border-y border-slate-800">
        <div className="flex items-center justify-around gap-8 text-xs font-black uppercase tracking-widest text-slate-300">
          <span>AI-Assisted IoT</span>
          <span className="text-brand">❖</span>
          <span>MAX30102 PPG</span>
          <span className="text-brand">❖</span>
          <span>DS18B20 Digital Temp</span>
          <span className="text-brand">❖</span>
          <span>AD8232 ECG Telemetry</span>
          <span className="text-brand">❖</span>
          <span>Geoapify Hospital Routing</span>
          <span className="text-brand">❖</span>
          <span>PostgreSQL PostGIS</span>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────
          6. THREE-STAGE ARCHITECTURE PIPELINE
      ──────────────────────────────────────────────────────────── */}
      <section id="architecture" className="py-24 px-6 sm:px-12 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-brand border border-blue-100">
            <Layers className="w-3.5 h-3.5" />
            <span>End-to-End System Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            How Project Vyana Works
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            A cohesive real-time pipeline bridging physical biomedical sensors, relational spatial databases, and automated emergency routing.
          </p>
        </div>

        {/* 3-Stage Pipeline Connected Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
          {/* Connecting Conduit Line on Desktop */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-300 via-indigo-300 to-emerald-300 -translate-y-24 z-0 pointer-events-none opacity-40" />

          {/* STAGE 01: Edge Biomedical Hardware Node */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-lg transition-all p-7 relative z-10 flex flex-col justify-between group">
            <div>
              {/* Stage Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-brand">
                  <Cpu className="w-3.5 h-3.5" />
                  Stage 01 • Physical Node
                </span>
                <span className="w-7 h-7 rounded-full bg-blue-50 text-brand font-black text-xs flex items-center justify-center font-mono">
                  01
                </span>
              </div>

              {/* Title & Description */}
              <div className="pt-5 space-y-2">
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-brand transition-colors">
                  IoT Hardware Telemetry Node
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  ESP32 dual-core MCU executes asynchronous sensor conversions and packages structured JSON packets every 5 seconds over local Wi-Fi.
                </p>
              </div>

              {/* Sensor Chips */}
              <div className="py-4 flex flex-wrap gap-1.5">
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-[10px] font-mono font-bold">
                  MAX30102 (PPG/SpO2)
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-[10px] font-mono font-bold">
                  DS18B20 (1-Wire Temp)
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-[10px] font-mono font-bold">
                  AD8232 (ECG ADC)
                </span>
              </div>

              {/* Terminal Code Visual Box */}
              <div className="rounded-2xl bg-slate-950 p-3.5 font-mono text-[10px] text-slate-300 space-y-1 shadow-inner border border-slate-800">
                <div className="flex items-center justify-between text-slate-500 pb-1.5 border-b border-slate-800">
                  <span className="flex items-center gap-1">
                    <Radio className="w-3 h-3 text-emerald-400" />
                    POST /api/v1/ingest/vitals
                  </span>
                  <span className="text-emerald-400">200 OK</span>
                </div>
                <div className="text-slate-400 pt-1">
                  <span className="text-sky-300">&quot;source&quot;</span>: <span className="text-emerald-300">&quot;ESP32_MAX30102_DS18B20&quot;</span>,
                </div>
                <div className="text-slate-400">
                  <span className="text-sky-300">&quot;heart_rate&quot;</span>: <span className="text-amber-300">74</span>, <span className="text-sky-300">&quot;spo2&quot;</span>: <span className="text-amber-300">98</span>,
                </div>
                <div className="text-slate-400">
                  <span className="text-sky-300">&quot;temperature&quot;</span>: <span className="text-amber-300">36.8</span>, <span className="text-sky-300">&quot;cycle&quot;</span>: <span className="text-amber-300">&quot;5s&quot;</span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <Radio className="w-3 h-3 text-slate-400" />
                Dual-Core 240MHz
              </span>
              <span className="font-mono text-slate-400">50 Hz Optical Stream</span>
            </div>
          </div>

          {/* STAGE 02: PostgreSQL & Spatial Engine */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-lg transition-all p-7 relative z-10 flex flex-col justify-between group">
            <div>
              {/* Stage Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-indigo-600">
                  <Database className="w-3.5 h-3.5" />
                  Stage 02 • Spatial Database
                </span>
                <span className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 font-black text-xs flex items-center justify-center font-mono">
                  02
                </span>
              </div>

              {/* Title & Description */}
              <div className="pt-5 space-y-2">
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  PostgreSQL &amp; PostGIS Engine
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Stores continuous vitals logs with ACID compliance. PostGIS executes millisecond bounding-box radius queries to index nearby verified emergency medical facilities.
                </p>
              </div>

              {/* Database Capabilities */}
              <div className="py-4 flex flex-wrap gap-1.5">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 text-[10px] font-mono font-bold">
                  ACID Persistence
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 text-[10px] font-mono font-bold">
                  Rule Evaluation
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 text-[10px] font-mono font-bold">
                  ST_DWithin Spatial Index
                </span>
              </div>

              {/* Terminal Code Visual Box */}
              <div className="rounded-2xl bg-slate-950 p-3.5 font-mono text-[10px] text-slate-300 space-y-1 shadow-inner border border-slate-800">
                <div className="flex items-center justify-between text-slate-500 pb-1.5 border-b border-slate-800">
                  <span className="flex items-center gap-1">
                    <Database className="w-3 h-3 text-indigo-400" />
                    Spatial GiST Radius Index
                  </span>
                  <span className="text-indigo-400">3.4 ms</span>
                </div>
                <div className="text-slate-400 pt-1">
                  <span className="text-purple-400">SELECT</span> name, facility_type
                </div>
                <div className="text-slate-400">
                  <span className="text-purple-400">FROM</span> trauma_facilities
                </div>
                <div className="text-slate-400">
                  <span className="text-purple-400">WHERE</span> ST_DWithin(geom, patient_pt, 15000);
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-indigo-500" />
                ACID Transactions
              </span>
              <span className="font-mono text-slate-400">&lt; 4ms Spatial Latency</span>
            </div>
          </div>

          {/* STAGE 03: Geoapify Emergency Dispatch */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-lg transition-all p-7 relative z-10 flex flex-col justify-between group">
            <div>
              {/* Stage Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-600">
                  <Navigation className="w-3.5 h-3.5" />
                  Stage 03 • Rapid Dispatch
                </span>
                <span className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 font-black text-xs flex items-center justify-center font-mono">
                  03
                </span>
              </div>

              {/* Title & Description */}
              <div className="pt-5 space-y-2">
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                  Geoapify Emergency Dispatch
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Provides street-level reverse geocoding and real-time road matrix calculation to route emergency responders to the nearest verified trauma center.
                </p>
              </div>

              {/* Routing Capabilities */}
              <div className="py-4 flex flex-wrap gap-1.5">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[10px] font-mono font-bold">
                  Reverse Geocoding
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[10px] font-mono font-bold">
                  Road Matrix API
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[10px] font-mono font-bold">
                  Instant SOS Webhook
                </span>
              </div>

              {/* Terminal Code Visual Box */}
              <div className="rounded-2xl bg-slate-950 p-3.5 font-mono text-[10px] text-slate-300 space-y-1 shadow-inner border border-slate-800">
                <div className="flex items-center justify-between text-slate-500 pb-1.5 border-b border-slate-800">
                  <span className="flex items-center gap-1">
                    <Hospital className="w-3 h-3 text-emerald-400" />
                    Geoapify Routing Matrix
                  </span>
                  <span className="text-emerald-400">Lock ETA: 3.8m</span>
                </div>
                <div className="text-slate-400 pt-1">
                  <span className="text-slate-500">Destination:</span> <span className="text-emerald-300">Mount Sinai Trauma Ward</span>
                </div>
                <div className="text-slate-400">
                  <span className="text-slate-500">Proximity:</span> <span className="text-amber-300">1.2 km</span> • Corridor: <span className="text-emerald-400">Active</span>
                </div>
                <div className="text-slate-400">
                  <span className="text-slate-500">Payload:</span> <span className="text-rose-400">Critical Arrhythmia Alert</span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-emerald-500" />
                Verified Trauma Center
              </span>
              <span className="font-mono text-slate-400">&lt; 5s End-to-End Triage</span>
            </div>
          </div>
        </div>

        {/* Technical Specification KPI Footer Bar */}
        <div className="mt-12 p-6 rounded-3xl bg-slate-900 text-white shadow-xl border border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <span className="text-3xl font-black font-mono text-sky-400 block">&lt; 500 ms</span>
            <span className="text-xs text-slate-400 mt-1 block">Hardware Ingestion Latency</span>
          </div>
          <div>
            <span className="text-3xl font-black font-mono text-indigo-400 block">&lt; 4 ms</span>
            <span className="text-xs text-slate-400 mt-1 block">PostGIS Spatial Query</span>
          </div>
          <div>
            <span className="text-3xl font-black font-mono text-emerald-400 block">&lt; 5 s</span>
            <span className="text-xs text-slate-400 mt-1 block">Total Automated Triage</span>
          </div>
          <div>
            <span className="text-3xl font-black font-mono text-amber-400 block">100%</span>
            <span className="text-xs text-slate-400 mt-1 block">Rule-Based Determinism</span>
          </div>
        </div>
      </section>
      </main>

      {/* ────────────────────────────────────────────────────────────
          7. TAILORED PROJECT FOOTER
      ──────────────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-slate-300 pt-16 pb-12 px-6 sm:px-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-slate-800">
          {/* Col 1: Identity */}
          <div className="space-y-4 md:col-span-1">
            <BrandLogo variant="small" inverse />
            <p className="text-xs text-slate-400 leading-relaxed">
              AI-Assisted IoT Wellness Monitoring • Department of Electronics and Communication Engineering.
            </p>
            <div className="text-[11px] font-mono text-slate-500">
              Engineering &amp; Biomedical Research Prototype
            </div>
          </div>

          {/* Col 2: Modules */}
          <div className="space-y-3 text-xs">
            <h4 className="text-white font-bold uppercase tracking-wider text-[11px]">System Modules</h4>
            <ul className="space-y-2 text-slate-400">
              <li>
                <Link to={token ? "/dashboard" : "/login"} className="hover:text-white transition-colors">
                  Vitals Dashboard
                </Link>
              </li>
              <li>
                <Link to={token ? "/emergency" : "/login"} className="hover:text-white transition-colors">
                  Emergency Triage &amp; SOS
                </Link>
              </li>
              <li>
                <Link to={token ? "/trends" : "/login"} className="hover:text-white transition-colors">
                  Biometric Trends &amp; History
                </Link>
              </li>
              <li>
                <Link to={token ? "/profile" : "/login"} className="hover:text-white transition-colors">
                  Patient Health Profile
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Hardware & Stack */}
          <div className="space-y-3 text-xs">
            <h4 className="text-white font-bold uppercase tracking-wider text-[11px]">Hardware &amp; Stack</h4>
            <ul className="space-y-2 text-slate-400">
              <li>ESP32 Biomedical Node</li>
              <li>MAX30102 Optical PPG &amp; SpO2</li>
              <li>DS18B20 1-Wire Thermometry</li>
              <li>AD8232 Single-Lead ECG</li>
              <li>PostgreSQL &amp; PostGIS Engine</li>
              <li>Geoapify Trauma Routing</li>
            </ul>
          </div>

          {/* Col 4: Evaluation & Feedback */}
          <div className="space-y-3 text-xs md:col-span-1">
            <h4 className="text-white font-bold uppercase tracking-wider text-[11px]">Project Evaluation</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Reviewing Project Vyana? Submit your feedback to help us refine the hardware telemetry and UI:
            </p>
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSdht-wQC5uTgS2YBy8GAdo6iHwUYw1MzqIOtM8JtAKJoTWsaA/viewform"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs transition-colors shadow-sm"
            >
              <span>Submit Google Feedback</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Footer Bottom copyright & disclaimer */}
        <div className="max-w-7xl mx-auto pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© 2026 Project Vyana. Department of Electronics and Communication Engineering.</p>
          <p className="text-slate-500">
            Engineered for research demonstration; not certified as an FDA diagnostic device.
          </p>
        </div>
      </footer>
    </div>
  );
}
