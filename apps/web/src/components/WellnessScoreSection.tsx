import { useSensorPresentation } from '../store/useSensorPresentation';
import { Heart, Droplet, Thermometer, Activity, ShieldCheck, AlertCircle } from 'lucide-react';

interface ScoringFactor {
  id: string;
  name: string;
  target: string;
  penalty: string;
  reading: string;
  status: 'optimal' | 'warning' | 'critical' | 'pending';
  impact: string;
  icon: typeof Heart;
}

export function WellnessScoreSection() {
  const { wellnessScore, vitals, alerts, wellnessPreview } = useSensorPresentation();

  const scoreColor =
    wellnessScore == null
      ? 'text-muted'
      : wellnessScore >= 80
      ? 'text-emerald-600'
      : wellnessScore >= 60
      ? 'text-amber-600'
      : 'text-rose-600';

  const strokeColor =
    wellnessScore == null
      ? 'var(--color-line)'
      : wellnessScore >= 80
      ? '#10b981'
      : wellnessScore >= 60
      ? '#f59e0b'
      : '#ef4444';

  const scoreBadge =
    wellnessScore == null
      ? { label: 'Telemetry Pending', class: 'bg-slate-100 text-slate-700 border-slate-200' }
      : wellnessScore >= 80
      ? { label: 'Optimal Baseline', class: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
      : wellnessScore >= 60
      ? { label: 'Moderate Alert', class: 'bg-amber-50 text-amber-800 border-amber-200' }
      : { label: 'Clinical Attention', class: 'bg-rose-50 text-rose-800 border-rose-200' };

  const hasVitals = Boolean(vitals);
  const hr = vitals?.heart_rate ?? null;
  const spo2 = vitals?.spo2 ?? null;
  const temp = vitals?.temperature ?? null;
  const ecg = vitals?.ecg_status ?? null;

  const hrOptimal = hr !== null && hr >= 60 && hr <= 90;
  const spo2Optimal = spo2 !== null && spo2 >= 95;
  const tempOptimal = temp !== null && temp >= 35.0 && temp <= 38.0;
  const ecgOptimal = ecg === 'Normal';

  const criticalAlerts = alerts?.filter((a) => a.severity === 'critical') ?? [];
  const warningAlerts = alerts?.filter((a) => a.severity === 'warning') ?? [];
  const capApplied = criticalAlerts.length > 0 ? 60 : warningAlerts.length > 0 ? 80 : null;

  const factors: ScoringFactor[] = [
    {
      id: 'ecg',
      name: 'Cardiac Rhythm (ECG)',
      target: 'Normal sinus rhythm',
      penalty: 'Prerequisite anchor',
      reading: ecg ? (ecg === 'Normal' ? 'Sinus Rhythm' : ecg) : 'Unclassified',
      status: ecgOptimal ? 'optimal' : hasVitals ? 'critical' : 'pending',
      impact: ecgOptimal ? 'Baseline Valid (+0)' : hasVitals ? 'Unverified Rhythm' : 'Awaiting Signal',
      icon: Activity,
    },
    {
      id: 'hr',
      name: 'Resting Heart Rate',
      target: '60 – 90 bpm target',
      penalty: '-10 pts if < 60 or > 90',
      reading: hr !== null ? `${hr} bpm` : '—',
      status: hr === null ? 'pending' : hrOptimal ? 'optimal' : 'warning',
      impact: hr === null ? 'Awaiting Signal' : hrOptimal ? 'In Range (0 deduction)' : '-10 pts deduction',
      icon: Heart,
    },
    {
      id: 'spo2',
      name: 'Blood Oxygen (SpO₂)',
      target: '≥ 95% saturation',
      penalty: '-15 pts if < 95%',
      reading: spo2 !== null ? `${spo2}%` : '—',
      status: spo2 === null ? 'pending' : spo2Optimal ? 'optimal' : 'warning',
      impact: spo2 === null ? 'Awaiting Signal' : spo2Optimal ? 'In Range (0 deduction)' : '-15 pts deduction',
      icon: Droplet,
    },
    {
      id: 'temp',
      name: 'Body Temperature',
      target: '35.0 – 38.0 °C envelope',
      penalty: '-20 pts if abnormal',
      reading: temp !== null ? `${temp} °C` : '—',
      status: temp === null ? 'pending' : tempOptimal ? 'optimal' : 'warning',
      impact: temp === null ? 'Awaiting Signal' : tempOptimal ? 'Normothermic (0 deduction)' : '-20 pts deduction',
      icon: Thermometer,
    },
  ];

  return (
    <section className="surface p-4 sm:p-5 rounded-2xl border border-line bg-surface shadow-xs" aria-labelledby="wellness-score-heading">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Wellness Score Gauge */}
        <div className="lg:col-span-5 flex flex-col items-center justify-between text-center border-b lg:border-b-0 lg:border-r border-line pb-4 lg:pb-0 lg:pr-5">
          <div className="w-full text-left">
            <h2 id="wellness-score-heading" className="text-sm font-bold text-ink">
              Clinical Wellness Score
            </h2>
            <p className="text-xs text-muted mt-0.5">
              {wellnessPreview
                ? 'Preview calculation from simulated telemetry'
                : 'Deterministic composite from 24h baseline sensor norms'}
            </p>
          </div>

          <div className="score-ring my-2.5 sm:my-3">
            <svg viewBox="0 0 128 128" aria-hidden="true" className="w-28 h-28 sm:w-32 sm:h-32 -rotate-90">
              <circle cx="64" cy="64" r="52" fill="none" stroke="var(--color-line)" strokeWidth="8" />
              <circle
                cx="64"
                cy="64"
                r="52"
                fill="none"
                stroke={strokeColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray="326.73"
                strokeDashoffset={wellnessScore == null ? 326.73 : 326.73 * (1 - wellnessScore / 100)}
                className="transition-all duration-500 ease-out"
              />
            </svg>
            <div className="score-ring-value">
              <strong className={scoreColor}>{wellnessScore ?? '—'}</strong>
              <span className="text-xs text-muted">/ 100</span>
            </div>
          </div>

          <div className="space-y-1.5 w-full max-w-xs">
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${scoreBadge.class}`}>
              {scoreBadge.label}
            </span>
            <p className="text-[11px] text-muted leading-snug">
              {wellnessScore == null
                ? 'Score activates when fresh continuous telemetry and validated sinus ECG are recorded.'
                : '100-point composite incorporating cardiac rhythm, heart rate, oxygenation, and temperature.'}
            </p>
          </div>
        </div>

        {/* Right: Scoring Calculation Breakdown */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-ink">Score Calculation Breakdown</h3>
              <p className="text-xs text-muted mt-0.5">Deduction model applied against baseline (100 pts)</p>
            </div>
            <span className="text-[10px] font-semibold text-slate-700 bg-surface-soft px-2 py-0.5 rounded-lg border border-line shrink-0 mt-0.5">
              Formula: 100 − Σ Deductions
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {factors.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.id}
                  className="p-2.5 sm:p-3 rounded-xl bg-surface-soft/60 border border-line flex flex-col justify-between gap-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="p-1 rounded-md bg-surface border border-line text-brand shrink-0">
                        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                      </span>
                      <span className="text-xs font-semibold text-ink truncate">{f.name}</span>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0 ${
                        f.status === 'optimal'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : f.status === 'warning'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : f.status === 'critical'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {f.impact}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between text-xs pt-1 border-t border-line/50">
                    <span className="text-muted text-[11px]">Reading: <strong className="text-ink font-semibold">{f.reading}</strong></span>
                    <span className="text-muted text-[11px]">Norm: {f.target}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Triage Alert Cap Status */}
          <div className="px-3 py-2 rounded-xl bg-surface-soft border border-line flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {capApplied ? (
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              )}
              <span className="font-semibold text-slate-800">
                {capApplied ? `Active Triage Cap: Max ${capApplied} pts` : 'Triage Severity Cap: Inactive'}
              </span>
            </div>
            <span className="text-[11px] text-muted">
              {capApplied
                ? `Capped due to ${criticalAlerts.length > 0 ? 'critical' : 'warning'} vital alert`
                : 'No vital triage penalties'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

