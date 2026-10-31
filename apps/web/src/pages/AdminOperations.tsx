import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Sliders,
  Activity,
  Heart,
  Wind,
  Thermometer,
  Zap,
  Play,
  Square,
  RotateCcw,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Check,
  ExternalLink,
  Smartphone,
  ShieldCheck,
  Sparkles,
  Layers,
  ArrowRight,
  QrCode,
  X
} from 'lucide-react';

const ADMIN_QR_CODE_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEsAQMAAABDsxw2AAAABlBMVEX///8AAABVwtN+AAAACXBIWXMAAA7EAAAOxAGVKw4bAAABVUlEQVRoge3awQ3DIAwFUDNBRmDUrMoITBAXMN8hTQ89YulbVVWF19MvDpCK/FenoqrIofNqVi3JR7SQ7cHqHGmsXWiyXRRJnRUbSWThmOVu0Xc5TZrpF7LAbIke6ZMFZ3NSF7RosrDsbtH4Aahe1pl/d3KyzZminK392YosFHtXzz3/HiILwU7P3T80kK/HiywU61tXe8lYSgluu70GIIvIbBZXfCWPe67iPY+pTRaK2Vy26JG4gRG6ranIAjFM1Tv6e2E8jCrZJuzEznSGW2WZp7ixClkwJuNIcNnLQJa795IFY1gdTb+MwpMFZNVPkGzJ9H3gQBaIraXerrONolGThWKnR1y/2LNFkwViyxl+rwNgRq/v5zJk+7NH7geeiVuVZctDFpT5yUNZGjVZXKb4j5ks0b+nM9n2zMrTR+iJLCpTlEXvR4hN2jpKXysusr3Zf/UBqhpTsCuhIpgAAAAASUVORK5CYII=';
import { PageHeader } from '../components/PageHeader';
import { apiJson } from '../services/api';

type EcgRhythm = 'Normal' | 'Irregular' | 'Leads Off' | 'Unknown';

interface PresetScenario {
  id: string;
  name: string;
  description: string;
  tone: 'emerald' | 'amber' | 'rose' | 'blue' | 'purple';
  heart_rate: number;
  spo2: number;
  temperature: number;
  ecg_status: EcgRhythm;
}

const CLINICAL_PRESETS: PresetScenario[] = [
  {
    id: 'healthy',
    name: 'Healthy Adult Baseline',
    description: '72 BPM · 98% SpO2 · 36.6°C · Normal Sinus Rhythm',
    tone: 'emerald',
    heart_rate: 72,
    spo2: 98,
    temperature: 36.6,
    ecg_status: 'Normal',
  },
  {
    id: 'athletic',
    name: 'Athletic / Low Resting Rate',
    description: '52 BPM · 99% SpO2 · 36.4°C · Strong Vagal Tone',
    tone: 'blue',
    heart_rate: 52,
    spo2: 99,
    temperature: 36.4,
    ecg_status: 'Normal',
  },
  {
    id: 'fever',
    name: 'Pyrexia / Febrile Episode',
    description: '106 BPM · 96% SpO2 · 39.2°C · Sinus Tachycardia',
    tone: 'amber',
    heart_rate: 106,
    spo2: 96,
    temperature: 39.2,
    ecg_status: 'Irregular',
  },
  {
    id: 'hypoxia',
    name: 'Hypoxic Respiratory Distress',
    description: '124 BPM · 84% SpO2 · 37.1°C · Severe Desaturation',
    tone: 'rose',
    heart_rate: 124,
    spo2: 84,
    temperature: 37.1,
    ecg_status: 'Irregular',
  },
  {
    id: 'arrhythmia',
    name: 'Acute Arrhythmic Event',
    description: '148 BPM · 90% SpO2 · 36.8°C · Irregular Rhythm',
    tone: 'purple',
    heart_rate: 148,
    spo2: 90,
    temperature: 36.8,
    ecg_status: 'Irregular',
  },
  {
    id: 'bradycardia',
    name: 'Critical Bradycardia',
    description: '40 BPM · 94% SpO2 · 35.1°C · Profound Slow Rate',
    tone: 'blue',
    heart_rate: 40,
    spo2: 94,
    temperature: 35.1,
    ecg_status: 'Normal',
  },
];

interface GeneratedReportInfo {
  id: string;
  filename: string;
  summary: string;
  status: string;
  uploadedAt: string;
  sections?: Array<{ title: string; items: string[] }>;
}

export default function AdminOperations() {

  // Sensor control states
  const [heartRate, setHeartRate] = useState<number>(76);
  const [spo2, setSpo2] = useState<number>(98);
  const [temperature, setTemperature] = useState<number>(36.6);
  const [ecgStatus, setEcgStatus] = useState<EcgRhythm>('Normal');
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C');

  // Streaming / Automation states
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);

  // Status feedback
  const [feedback, setFeedback] = useState<string>('');
  const [feedbackTone, setFeedbackTone] = useState<'success' | 'info' | 'error'>('info');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [generatedReport, setGeneratedReport] = useState<GeneratedReportInfo | null>(null);

  // Recent simulated readings log
  const [recentLogs, setRecentLogs] = useState<Array<{
    id: number;
    observed_at: string;
    heart_rate: number;
    spo2: number;
    temperature: number;
    ecg_status: string;
  }>>([]);

  // Fetch status on load
  const loadStatus = async () => {
    try {
      const data = await apiJson<{
        recent: Array<{
          id: number;
          observed_at: string;
          heart_rate: number;
          spo2: number;
          temperature: number;
          ecg_status: string;
        }>;
        vitals: { heart_rate?: number; spo2?: number; temperature?: number; ecg_status?: EcgRhythm } | null;
      }>('/admin/simulate/status');

      if (data.recent?.length) {
        setRecentLogs(data.recent);
      }
      if (data.vitals) {
        if (data.vitals.heart_rate) setHeartRate(data.vitals.heart_rate);
        if (data.vitals.spo2) setSpo2(data.vitals.spo2);
        if (data.vitals.temperature) setTemperature(data.vitals.temperature);
        if (data.vitals.ecg_status) setEcgStatus(data.vitals.ecg_status);
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  // Transmit one-shot simulation
  const handleTransmit = async (override?: { hr?: number; ox?: number; temp?: number; ecg?: EcgRhythm }) => {
    setIsSubmitting(true);
    const hr = override?.hr ?? heartRate;
    const ox = override?.ox ?? spo2;
    const temp = override?.temp ?? temperature;
    const ecg = override?.ecg ?? ecgStatus;

    try {
      const result = await apiJson<{
        success: boolean;
        vitals: { id: number; observed_at: string; heart_rate: number; spo2: number; temperature: number; ecg_status: string };
        alerts_count: number;
      }>('/admin/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          heart_rate: hr,
          spo2: ox,
          temperature: temp,
          ecg_status: ecg,
          generate_ecg_batch: true,
          source: 'BackOffice_Simulator',
        }),
      });

      if (result.success && result.vitals) {
        setRecentLogs((prev) => [result.vitals, ...prev.filter((r) => r.id !== result.vitals.id)].slice(0, 15));
        setFeedback(`Transmitted: ${hr} BPM · ${ox}% SpO2 · ${temp}°C (${ecg}) · Live clients notified.`);
        setFeedbackTone('success');
      }
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Transmission failed. Verify backend connectivity.');
      setFeedbackTone('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Continuous auto-generator loop
  const streamTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isStreaming) {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
      return;
    }

    streamTimerRef.current = window.setInterval(() => {
      // Small physiological jitter
      const hrJitter = Math.round((Math.random() - 0.5) * 2);
      const spo2Jitter = Number(((Math.random() - 0.5) * 0.4).toFixed(1));
      const targetHr = Math.max(35, Math.min(210, heartRate + hrJitter));
      const targetSpo2 = Math.max(70, Math.min(100, Number((spo2 + spo2Jitter).toFixed(1))));

      void apiJson<{ success: boolean; vitals: { id: number; observed_at: string; heart_rate: number; spo2: number; temperature: number; ecg_status: string } }>(
        '/admin/simulate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            heart_rate: targetHr,
            spo2: targetSpo2,
            temperature,
            ecg_status: ecgStatus,
            generate_ecg_batch: true,
            source: 'BackOffice_Simulator',
          }),
        }
      ).then((res) => {
        if (res.vitals) {
          setRecentLogs((prev) => [res.vitals, ...prev.filter((r) => r.id !== res.vitals.id)].slice(0, 15));
        }
      }).catch(() => {});
    }, 3000);

    return () => {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
    };
  }, [isStreaming, heartRate, spo2, temperature, ecgStatus]);

  // Seed history
  const handleSeedHistory = async () => {
    setIsSeeding(true);
    setFeedback('Generating 24-hour physiological historical timeline...');
    setFeedbackTone('info');
    try {
      await apiJson('/admin/simulate/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hours: 24,
          heart_rate: heartRate,
          spo2,
          temperature,
        }),
      });
      setFeedback('Successfully seeded 24-hour telemetry timeline. Trends and History are fully populated.');
      setFeedbackTone('success');
      void loadStatus();
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Historical seeding failed.');
      setFeedbackTone('error');
    } finally {
      setIsSeeding(false);
    }
  };

  // Generate formal clinical report
  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    setFeedback('Synthesizing formal clinical telemetry report from accumulated sensor data...');
    setFeedbackTone('info');
    try {
      const rep = await apiJson<GeneratedReportInfo>('/admin/simulate/report', {
        method: 'POST',
      });
      setGeneratedReport(rep);
      setFeedback(`Clinical report synthesized successfully: "${rep.filename}". Accessible in Health Reports.`);
      setFeedbackTone('success');
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Report synthesis failed.');
      setFeedbackTone('error');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Apply Preset
  const applyPreset = (preset: PresetScenario) => {
    setHeartRate(preset.heart_rate);
    setSpo2(preset.spo2);
    setTemperature(preset.temperature);
    setEcgStatus(preset.ecg_status);
    void handleTransmit({
      hr: preset.heart_rate,
      ox: preset.spo2,
      temp: preset.temperature,
      ecg: preset.ecg_status,
    });
  };

  // Copy mobile remote link
  const handleCopyLink = () => {
    const url = `${window.location.origin}/admin`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }).catch(() => {});
  };

  // Canvas waveform generator for live visualizer
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let offset = 0;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // ECG Trace
      ctx.strokeStyle = ecgStatus === 'Irregular' ? '#f43f5e' : ecgStatus === 'Leads Off' ? '#94a3b8' : '#10b981';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();

      const rrPixels = Math.max(60, Math.min(240, (60 / heartRate) * 160));
      for (let x = 0; x < w; x++) {
        const t = (x + offset) % rrPixels;
        const phase = t / rrPixels;

        let y = h / 2;
        if (ecgStatus === 'Leads Off') {
          y += (Math.random() - 0.5) * 4;
        } else {
          // P
          if (Math.abs(phase - 0.2) < 0.04) y -= 12 * Math.exp(-(((phase - 0.2) / 0.02) ** 2));
          // Q
          if (Math.abs(phase - 0.35) < 0.02) y += 8 * Math.exp(-(((phase - 0.35) / 0.01) ** 2));
          // R
          if (Math.abs(phase - 0.38) < 0.03) y -= 55 * Math.exp(-(((phase - 0.38) / 0.009) ** 2));
          // S
          if (Math.abs(phase - 0.41) < 0.02) y += 14 * Math.exp(-(((phase - 0.41) / 0.012) ** 2));
          // T
          if (Math.abs(phase - 0.65) < 0.07) y -= 16 * Math.exp(-(((phase - 0.65) / 0.035) ** 2));
        }

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      offset = (offset + 1.8) % 10000;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [heartRate, ecgStatus]);

  const displayTemp = tempUnit === 'F' ? Number(((temperature * 9) / 5 + 32).toFixed(1)) : temperature;

  return (
    <div className="page-stack w-full !gap-3.5">
      {/* Page Header */}
      <PageHeader
        title="Back-Office Operations"
        description="Remote sensor telemetry simulation, hardware threshold testing, and clinical report synthesis."
        icon={Sliders}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowQrModal(!showQrModal)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-surface hover:bg-surface-soft border border-line text-ink transition-colors shadow-2xs shrink-0"
              title="Show QR code to scan from phone"
            >
              <QrCode className="w-3.5 h-3.5 text-brand" />
              <span>{showQrModal ? 'Hide QR' : 'Scan QR'}</span>
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-surface hover:bg-surface-soft border border-line text-ink transition-colors shadow-2xs shrink-0"
              title="Copy URL to open on your phone or other device"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Smartphone className="w-3.5 h-3.5 text-brand" />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
            </button>
            <Link
              to="/dashboard"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-brand hover:bg-brand-hover text-white transition-colors shadow-2xs shrink-0"
            >
              <span>View Dashboard</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        }
      />

      {/* Mobile QR Scanner Helper Card */}
      {showQrModal && (
        <section className="p-4 rounded-2xl bg-brand/5 border border-brand/20 shadow-xs flex flex-col sm:flex-row items-center gap-5">
          <div className="p-2.5 bg-white rounded-xl border border-line shadow-2xs shrink-0">
            <img
              src={ADMIN_QR_CODE_DATA_URL}
              alt="Scan QR code to open admin on phone"
              className="w-36 h-36 rounded-lg block"
            />
          </div>
          <div className="space-y-2.5 flex-1 text-center sm:text-left">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2 justify-center sm:justify-start">
                <Smartphone className="w-4 h-4 text-brand" />
                Scan with Phone Camera
              </h3>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="p-1 rounded-lg text-muted hover:text-ink hover:bg-surface-soft transition-colors"
                title="Close QR Code"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-body leading-relaxed">
              Point your phone camera at this QR code to open the controller immediately. Both devices must be on the same Wi-Fi.
            </p>
            <div className="p-2 rounded-xl bg-surface border border-line flex items-center justify-between gap-2 max-w-md">
              <code className="text-[11px] font-mono text-ink truncate select-all px-1">
                http://192.168.29.32:5173/admin
              </code>
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-surface-soft hover:bg-surface border border-line text-ink transition-colors shrink-0"
              >
                {copiedLink ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 font-medium">
              Important: In your phone's browser, type into the <u>top URL address bar</u> (where google.com appears), not inside Google search!
            </p>
          </div>
        </section>
      )}

      {/* Remote Connectivity & Mode Status Card */}
      <section className="p-4 rounded-2xl bg-surface border border-line shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-brand/10 text-brand border border-brand/20 shrink-0">
              <Radio className={`w-5 h-5 ${isStreaming ? 'animate-pulse text-emerald-500' : ''}`} />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-ink">Remote Telemetry Controller</h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync Active
                </span>
                {isStreaming && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20 animate-pulse">
                    Broadcasting Live Loop
                  </span>
                )}
              </div>
              <p className="text-xs text-muted mt-0.5">
                Changes emitted from this back-office console broadcast instantly across phone and laptop screens.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setIsStreaming(!isStreaming)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                isStreaming
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                  : 'bg-surface hover:bg-surface-soft border border-line text-ink'
              }`}
            >
              {isStreaming ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{isStreaming ? 'Stop Live Stream' : 'Start Live Stream'}</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleTransmit()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-brand hover:bg-brand-hover text-white shadow-xs transition-all flex items-center gap-1.5 shrink-0"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Transmitting…' : 'Transmit Now'}</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div
            role="status"
            className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
              feedbackTone === 'success'
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : feedbackTone === 'error'
                ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                : 'bg-surface-soft border-line text-ink'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackTone === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : feedbackTone === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <Activity className="w-4 h-4 text-brand shrink-0" />
              )}
              <span>{feedback}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback('')}
              className="text-xs text-muted hover:text-ink font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}
      </section>

      {/* Preset Clinical Scenarios */}
      <section className="surface p-4 sm:p-5 rounded-2xl border border-line bg-surface shadow-2xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-line">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-brand" />
              Quick Clinical Scenario Presets
            </h3>
            <p className="text-xs text-muted">
              Instantly configure and transmit validated clinical patterns across all devices.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {CLINICAL_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p)}
              className="p-3 rounded-xl border border-line bg-surface hover:bg-surface-soft/60 hover:border-brand/40 text-left transition-all flex flex-col justify-between group shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-bold text-ink group-hover:text-brand transition-colors">
                  {p.name}
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    p.tone === 'emerald'
                      ? 'bg-emerald-500'
                      : p.tone === 'rose'
                      ? 'bg-rose-500'
                      : p.tone === 'amber'
                      ? 'bg-amber-500'
                      : p.tone === 'purple'
                      ? 'bg-purple-500'
                      : 'bg-blue-500'
                  }`}
                />
              </div>
              <p className="text-[11px] text-muted">{p.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Main Sensor Tuning Sliders & Specific Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Heart Beat Sensor Controller */}
        <section className="surface p-4 sm:p-5 rounded-2xl border border-line bg-surface shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 border border-rose-500/20">
                  <Heart className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-ink">Heart Rate (BPM)</h3>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  heartRate > 120 || heartRate < 50
                    ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                    : heartRate > 90
                    ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                }`}
              >
                {heartRate > 120 ? 'Tachycardia' : heartRate < 50 ? 'Bradycardia' : heartRate > 90 ? 'Elevated' : 'Normal'}
              </span>
            </div>

            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-ink font-mono">{heartRate}</span>
                <span className="text-xs text-muted font-semibold">BPM</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setHeartRate((h) => Math.max(30, h - 5))}
                  className="px-2 py-1 rounded-lg bg-surface-soft border border-line text-xs font-bold text-ink hover:bg-line transition-colors"
                >
                  -5
                </button>
                <button
                  type="button"
                  onClick={() => setHeartRate((h) => Math.min(220, h + 5))}
                  className="px-2 py-1 rounded-lg bg-surface-soft border border-line text-xs font-bold text-ink hover:bg-line transition-colors"
                >
                  +5
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="hr-slider" className="sr-only">Heart Rate Slider</label>
              <input
                id="hr-slider"
                type="range"
                min="30"
                max="220"
                step="1"
                value={heartRate}
                onChange={(e) => setHeartRate(Number(e.target.value))}
                className="w-full h-2 bg-surface-soft rounded-lg appearance-none cursor-pointer accent-brand"
              />
              <div className="flex justify-between text-[10px] text-muted font-mono">
                <span>30 BPM</span>
                <span>75 BPM</span>
                <span>150 BPM</span>
                <span>220 BPM</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleTransmit()}
            className="w-full py-2 rounded-xl text-xs font-bold bg-surface hover:bg-surface-soft border border-line text-ink transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Update Heart Rate</span>
          </button>
        </section>

        {/* Oxygen Level Sensor Controller */}
        <section className="surface p-4 sm:p-5 rounded-2xl border border-line bg-surface shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 border border-blue-500/20">
                  <Wind className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-ink">Oxygen Level (SpO2)</h3>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  spo2 < 90
                    ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                    : spo2 < 95
                    ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                }`}
              >
                {spo2 < 90 ? 'Critical' : spo2 < 95 ? 'Borderline' : 'Optimal'}
              </span>
            </div>

            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-ink font-mono">{spo2}</span>
                <span className="text-xs text-muted font-semibold">%</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSpo2((s) => Math.max(70, Number((s - 2).toFixed(1))))}
                  className="px-2 py-1 rounded-lg bg-surface-soft border border-line text-xs font-bold text-ink hover:bg-line transition-colors"
                >
                  -2
                </button>
                <button
                  type="button"
                  onClick={() => setSpo2((s) => Math.min(100, Number((s + 2).toFixed(1))))}
                  className="px-2 py-1 rounded-lg bg-surface-soft border border-line text-xs font-bold text-ink hover:bg-line transition-colors"
                >
                  +2
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="spo2-slider" className="sr-only">Oxygen Saturation Slider</label>
              <input
                id="spo2-slider"
                type="range"
                min="70"
                max="100"
                step="0.5"
                value={spo2}
                onChange={(e) => setSpo2(Number(e.target.value))}
                className="w-full h-2 bg-surface-soft rounded-lg appearance-none cursor-pointer accent-brand"
              />
              <div className="flex justify-between text-[10px] text-muted font-mono">
                <span>70% (Severe)</span>
                <span>90%</span>
                <span>95%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleTransmit()}
            className="w-full py-2 rounded-xl text-xs font-bold bg-surface hover:bg-surface-soft border border-line text-ink transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Update SpO2 Saturation</span>
          </button>
        </section>

        {/* Temperature Sensor Controller */}
        <section className="surface p-4 sm:p-5 rounded-2xl border border-line bg-surface shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  <Thermometer className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-ink">Body Temperature</h3>
              </div>
              <div className="flex items-center bg-surface-soft p-0.5 rounded-lg border border-line text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setTempUnit('C')}
                  className={`px-1.5 py-0.5 rounded ${tempUnit === 'C' ? 'bg-surface text-ink shadow-2xs' : 'text-muted'}`}
                >
                  °C
                </button>
                <button
                  type="button"
                  onClick={() => setTempUnit('F')}
                  className={`px-1.5 py-0.5 rounded ${tempUnit === 'F' ? 'bg-surface text-ink shadow-2xs' : 'text-muted'}`}
                >
                  °F
                </button>
              </div>
            </div>

            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-ink font-mono">{displayTemp}</span>
                <span className="text-xs text-muted font-semibold">°{tempUnit}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setTemperature((t) => Math.max(34, Number((t - 0.5).toFixed(1))))}
                  className="px-2 py-1 rounded-lg bg-surface-soft border border-line text-xs font-bold text-ink hover:bg-line transition-colors"
                >
                  -0.5
                </button>
                <button
                  type="button"
                  onClick={() => setTemperature((t) => Math.min(42, Number((t + 0.5).toFixed(1))))}
                  className="px-2 py-1 rounded-lg bg-surface-soft border border-line text-xs font-bold text-ink hover:bg-line transition-colors"
                >
                  +0.5
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="temp-slider" className="sr-only">Body Temperature Slider</label>
              <input
                id="temp-slider"
                type="range"
                min="34.0"
                max="42.0"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-full h-2 bg-surface-soft rounded-lg appearance-none cursor-pointer accent-brand"
              />
              <div className="flex justify-between text-[10px] text-muted font-mono">
                <span>34.0°C</span>
                <span>36.6°C (Normal)</span>
                <span>38.5°C (Fever)</span>
                <span>42.0°C</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleTransmit()}
            className="w-full py-2 rounded-xl text-xs font-bold bg-surface hover:bg-surface-soft border border-line text-ink transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Update Temperature</span>
          </button>
        </section>
      </div>

      {/* ECG Rhythm & Waveform Simulation Controller */}
      <section className="surface p-4 sm:p-5 rounded-2xl border border-line bg-surface shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-brand" />
              ECG Rhythm &amp; Morphological Synthesis
            </h3>
            <p className="text-xs text-muted">
              Generates 128-sample AD8232 telemetry batches with accurate P-Q-R-S-T wave dynamics at current BPM.
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {(['Normal', 'Irregular', 'Leads Off', 'Unknown'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setEcgStatus(r);
                  void handleTransmit({ ecg: r });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  ecgStatus === r
                    ? 'bg-brand text-white shadow-xs'
                    : 'bg-surface hover:bg-surface-soft border border-line text-body'
                }`}
              >
                {r === 'Normal' ? 'Normal Sinus' : r === 'Irregular' ? 'Arrhythmia / Irregular' : r === 'Leads Off' ? 'Leads Detached' : 'Unknown / Noise'}
              </button>
            ))}
          </div>
        </div>

        {/* Live Canvas Visualizer */}
        <div className="rounded-xl overflow-hidden border border-line bg-slate-950 relative p-1 shadow-inner">
          <canvas
            ref={canvasRef}
            width={860}
            height={110}
            className="w-full h-28 block"
            aria-label="Simulated ECG Waveform Canvas"
          />
          <div className="absolute top-2.5 left-3 flex items-center gap-2 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-[11px] font-mono font-bold text-emerald-400 bg-black/60 px-2 py-0.5 rounded border border-emerald-500/30">
              AD8232 SYNTHETIC STREAM · {heartRate} BPM · {ecgStatus.toUpperCase()}
            </span>
          </div>
        </div>
      </section>

      {/* Historical Trend Population & Report Synthesis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Historical Timeline Seeder */}
        <section className="surface p-4 sm:p-5 rounded-2xl border border-line bg-surface shadow-2xs space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-brand" />
              Populate Historical Trends
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Seed a continuous 24-hour baseline into the database. Fills all charts across Dashboard, Trends, Activity, and History with rich physiological telemetry.
            </p>
          </div>

          <button
            type="button"
            disabled={isSeeding}
            onClick={handleSeedHistory}
            className="w-full py-2.5 rounded-xl text-xs font-bold bg-surface hover:bg-surface-soft border border-line text-ink shadow-2xs transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
            <span>{isSeeding ? 'Seeding Timeline…' : 'Generate 24-Hour Clinical History'}</span>
          </button>
        </section>

        {/* Report Production from Simulated Telemetry */}
        <section className="surface p-4 sm:p-5 rounded-2xl border border-line bg-surface shadow-2xs space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-brand" />
              Produce Clinical Health Report
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Synthesize a formal medical report using the recorded sensor observations, risk stratification, and consultation talking points.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isGeneratingReport}
              onClick={handleGenerateReport}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-brand hover:bg-brand-hover text-white shadow-xs transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isGeneratingReport ? 'Compiling Report…' : 'Synthesize Report from Data'}</span>
            </button>

            {generatedReport && (
              <Link
                to="/reports"
                className="py-2.5 px-3.5 rounded-xl text-xs font-semibold bg-surface hover:bg-surface-soft border border-line text-ink transition-colors shrink-0 flex items-center gap-1"
              >
                <span>View Reports</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </section>
      </div>

      {/* Generated Report Preview Card */}
      {generatedReport && (
        <section className="p-4 sm:p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-emerald-200 ">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600  shrink-0" />
              <h3 className="text-sm font-bold text-emerald-950 ">
                Clinical Telemetry Report Created: {generatedReport.filename}
              </h3>
            </div>
            <Link
              to="/reports"
              className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1"
            >
              <span>Open in Full Reports Viewer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <p className="text-xs text-emerald-900  leading-relaxed">
            {generatedReport.summary}
          </p>
        </section>
      )}

      {/* Recent Telemetry Stream Audit Log */}
      <section className="surface p-4 sm:p-5 rounded-2xl border border-line bg-surface shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-line">
          <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-brand" />
            Live Hardware Stream Log ({recentLogs.length})
          </h3>
          <span className="text-[11px] text-muted font-medium">Real-time socket updates</span>
        </div>

        {recentLogs.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-line rounded-xl text-xs text-muted">
            No simulated readings emitted yet. Click "Transmit Now" or select a preset scenario above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-line text-muted uppercase text-[10px] tracking-wider font-semibold">
                  <th className="py-2 px-2">Observed Time</th>
                  <th className="py-2 px-2">Heart Rate</th>
                  <th className="py-2 px-2">SpO2</th>
                  <th className="py-2 px-2">Temperature</th>
                  <th className="py-2 px-2">ECG Rhythm</th>
                  <th className="py-2 px-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-mono">
                {recentLogs.slice(0, 10).map((log) => (
                  <tr key={log.id} className="hover:bg-surface-soft/40 transition-colors">
                    <td className="py-2 px-2 text-body">
                      {new Date(log.observed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-2 px-2 font-bold text-ink">{log.heart_rate} BPM</td>
                    <td className="py-2 px-2 font-bold text-ink">{log.spo2}%</td>
                    <td className="py-2 px-2 font-bold text-ink">{log.temperature}°C</td>
                    <td className="py-2 px-2 text-body">{log.ecg_status}</td>
                    <td className="py-2 px-2 text-right">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        BROADCAST
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
