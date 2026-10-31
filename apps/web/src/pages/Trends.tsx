import { EquipmentHistory } from '../components/EquipmentHistory';
import { useHealthStore } from '../store/useHealthStore';
import { useSensorPresentation } from '../store/useSensorPresentation';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  Activity,
  Heart,
  Thermometer,
  Footprints,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { useState, useMemo } from 'react';

export default function Trends() {
  const { historicalVitals } = useSensorPresentation();
  const [timeframe, setTimeframe] = useState<'7d' | '14d' | '30d' | 'all'>('7d');

  const vitalsData = useMemo(() => {
    return historicalVitals.map((v) => ({
      time: new Date(v.timestamp).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      hr: v.heart_rate,
      spo2: v.spo2,
      temp: v.temperature != null ? Number(v.temperature.toFixed(1)) : null,
      timestamp: v.timestamp,
    }));
  }, [historicalVitals]);

  const google = useHealthStore((state) => state.googleActivity);
  const activityData = useMemo(() => {
    return google?.connected
      ? google.days.map((day) => ({
          time: new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          }),
          steps: day.steps,
        }))
      : [];
  }, [google]);

  // Filtered by timeframe
  const filteredVitals = useMemo(() => {
    if (timeframe === 'all' || vitalsData.length <= 7) return vitalsData;
    const count = timeframe === '7d' ? 14 : timeframe === '14d' ? 28 : 60;
    return vitalsData.slice(-count);
  }, [vitalsData, timeframe]);

  const filteredActivity = useMemo(() => {
    if (timeframe === 'all' || activityData.length <= 7) return activityData;
    const count = timeframe === '7d' ? 7 : timeframe === '14d' ? 14 : 30;
    return activityData.slice(-count);
  }, [activityData, timeframe]);

  // Computed summary metrics
  const validHrs = filteredVitals
    .map((v) => v.hr)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const avgHr = validHrs.length > 0 ? Math.round(validHrs.reduce((a, b) => a + b, 0) / validHrs.length) : null;
  const minHr = validHrs.length > 0 ? Math.min(...validHrs) : null;
  const maxHr = validHrs.length > 0 ? Math.max(...validHrs) : null;

  const validSpo2s = filteredVitals
    .map((v) => v.spo2)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const avgSpo2 =
    validSpo2s.length > 0 ? (validSpo2s.reduce((a, b) => a + b, 0) / validSpo2s.length).toFixed(1) : null;

  const validTemps = filteredVitals
    .map((v) => v.temp)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const avgTemp =
    validTemps.length > 0 ? (validTemps.reduce((a, b) => a + b, 0) / validTemps.length).toFixed(1) : null;

  const validSteps = filteredActivity
    .map((a) => a.steps)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const totalSteps = validSteps.length > 0 ? validSteps.reduce((a, b) => a + b, 0) : null;
  const avgSteps = validSteps.length > 0 ? Math.round(totalSteps! / validSteps.length) : null;

  return (
    <div className="page-stack space-y-7 max-w-6xl mx-auto w-full">
      {/* 1. Header with Timeframe Range Pill */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Trends"
          description="Longitudinal telemetry analysis across cardiovascular vitals, temperature, and daily physical activity."
          icon={TrendingUp}
        />
        <div
          className="inline-flex items-center p-1 rounded-2xl bg-surface-soft border border-line shadow-2xs self-start sm:self-auto shrink-0"
          role="group"
          aria-label="Timeframe selector"
        >
          {(
            [
              ['7d', '7 Days'],
              ['14d', '14 Days'],
              ['30d', '30 Days'],
              ['all', 'All Records'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTimeframe(key)}
              aria-pressed={timeframe === key}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                timeframe === key
                  ? 'bg-white text-ink shadow-xs border border-line'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. 4-Stat Metric Tiles Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Heart Rate Tile */}
        <div className="surface p-5 rounded-2xl border border-line bg-surface shadow-xs flex items-center gap-4 transition-all hover:-translate-y-0.5">
          <span className="p-3 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 shrink-0">
            <Heart className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-0.5">
              Avg Heart Rate
            </span>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-2xl font-black text-ink font-mono">
                {avgHr != null ? avgHr : '—'}
              </span>
              <span className="text-xs font-semibold text-muted">bpm</span>
              {minHr != null && maxHr != null && (
                <span className="text-[11px] font-mono text-muted ml-1">
                  ({minHr}–{maxHr})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* SpO2 Saturation Tile */}
        <div className="surface p-5 rounded-2xl border border-line bg-surface shadow-xs flex items-center gap-4 transition-all hover:-translate-y-0.5">
          <span className="p-3 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 shrink-0">
            <Activity className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-0.5">
              Avg Blood Oxygen
            </span>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-2xl font-black text-ink font-mono">
                {avgSpo2 != null ? avgSpo2 : '—'}
              </span>
              <span className="text-xs font-semibold text-muted">% SpO₂</span>
            </div>
          </div>
        </div>

        {/* Body Temperature Tile */}
        <div className="surface p-5 rounded-2xl border border-line bg-surface shadow-xs flex items-center gap-4 transition-all hover:-translate-y-0.5">
          <span className="p-3 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 shrink-0">
            <Thermometer className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-0.5">
              Core Temperature
            </span>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-2xl font-black text-ink font-mono">
                {avgTemp != null ? avgTemp : '—'}
              </span>
              <span className="text-xs font-semibold text-muted">°C</span>
            </div>
          </div>
        </div>

        {/* Daily Physical Activity Tile */}
        <div className="surface p-5 rounded-2xl border border-line bg-surface shadow-xs flex items-center gap-4 transition-all hover:-translate-y-0.5">
          <span className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
            <Footprints className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-0.5">
              Daily Step Avg
            </span>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-2xl font-black text-ink font-mono">
                {avgSteps != null ? avgSteps.toLocaleString() : '—'}
              </span>
              <span className="text-xs font-semibold text-muted">steps</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Primary Chart: Cardiovascular & Respiratory Dynamics */}
      <div className="surface p-6 sm:p-7 rounded-3xl border border-line bg-surface shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 pb-4 border-b border-line">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base sm:text-lg font-bold text-ink font-display">
                Cardiovascular &amp; Respiratory Dynamics
              </h2>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full font-bold bg-brand/10 text-brand border border-brand/20">
                DUAL-AXIS TELEMETRY
              </span>
            </div>
            <p className="text-xs text-muted">
              Correlated continuous Heart Rate (bpm) and Blood Oxygen Saturation (% SpO₂) telemetry streams.
            </p>
          </div>
          <div className="flex items-center gap-5 text-xs font-semibold">
            <span className="flex items-center gap-2 text-ink">
              <span className="w-3 h-3 rounded-md bg-[#2E62DE]" />
              <span>Heart Rate (bpm)</span>
            </span>
            <span className="flex items-center gap-2 text-slate-700">
              <span className="w-3 h-3 rounded-md bg-[#0EA5E9]" />
              <span>SpO₂ (%)</span>
            </span>
          </div>
        </div>

        {filteredVitals.length > 0 ? (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filteredVitals} margin={{ top: 12, right: 16, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendHrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2E62DE" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2E62DE" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="trendSpo2Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" opacity={0.6} />
                <XAxis
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                  minTickGap={28}
                />
                <YAxis
                  yAxisId="left"
                  domain={['dataMin - 6', 'dataMax + 6']}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[90, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 14,
                    border: '1px solid var(--color-line)',
                    backgroundColor: 'rgba(255, 255, 255, 0.96)',
                    backdropFilter: 'blur(8px)',
                    color: 'var(--color-ink)',
                    boxShadow: '0 12px 32px -4px rgba(15, 23, 42, 0.12)',
                    fontSize: 12,
                    padding: '10px 14px',
                  }}
                />
                <Area
                  isAnimationActive={false}
                  yAxisId="left"
                  type="monotone"
                  dataKey="hr"
                  name="Heart Rate"
                  stroke="#2E62DE"
                  strokeWidth={2.5}
                  fill="url(#trendHrGrad)"
                  dot={{ r: 2.5, fill: '#2E62DE' }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffffff' }}
                />
                <Area
                  isAnimationActive={false}
                  yAxisId="right"
                  type="monotone"
                  dataKey="spo2"
                  name="SpO2 %"
                  stroke="#0EA5E9"
                  strokeWidth={2}
                  fill="url(#trendSpo2Grad)"
                  dot={{ r: 2, fill: '#0EA5E9' }}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState
            icon={Activity}
            title="No vitals history recorded"
            description="Historical heart rate and oxygen saturation readings will be graphed here as measurements are recorded."
          />
        )}
      </div>

      {/* 4. Secondary Grid: Physical Activity & Temperature */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
        {/* Activity Step Trend */}
        <div className="surface p-6 sm:p-7 rounded-3xl border border-line bg-surface shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-line">
              <div>
                <h2 className="text-base font-bold text-ink font-display">Daily Physical Movement</h2>
                <p className="text-xs text-muted">Step volume accumulated via Google Health synchronisation</p>
              </div>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <Target className="w-4 h-4" />
              </div>
            </div>

            {filteredActivity.some((row) => row.steps !== null) ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={filteredActivity} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="trendStepsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16A34A" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#16A34A" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" opacity={0.6} />
                    <XAxis
                      dataKey="time"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 14,
                        border: '1px solid var(--color-line)',
                        backgroundColor: 'rgba(255, 255, 255, 0.96)',
                        backdropFilter: 'blur(8px)',
                        color: 'var(--color-ink)',
                        fontSize: 12,
                      }}
                    />
                    <ReferenceLine y={10000} stroke="#16A34A" strokeDasharray="3 3" label={{ value: 'Goal (10k)', fill: '#16A34A', fontSize: 10, position: 'top' }} />
                    <Area
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="steps"
                      name="Steps"
                      stroke="#16A34A"
                      strokeWidth={2.5}
                      fill="url(#trendStepsGrad)"
                      dot={{ r: 3, fill: '#16A34A' }}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffffff' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="No activity history recorded"
                description="Daily step tracking trends will be graphed here as activity logs accumulate."
              />
            )}
          </div>
          <p className="text-[11px] text-muted font-medium mt-3 flex items-center gap-1.5 pt-3 border-t border-line">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Target: 10,000 active steps per day</span>
          </p>
        </div>

        {/* Temperature Trend */}
        <div className="surface p-6 sm:p-7 rounded-3xl border border-line bg-surface shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-line">
              <div>
                <h2 className="text-base font-bold text-ink font-display">Thermal Stability Probe</h2>
                <p className="text-xs text-muted">Continuous DS18B20 calibrated temperature observations</p>
              </div>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                <Thermometer className="w-4 h-4" />
              </div>
            </div>

            {filteredVitals.some((row) => row.temp !== null) ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={filteredVitals} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="trendTempGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D97706" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#D97706" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" opacity={0.6} />
                    <XAxis
                      dataKey="time"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                      minTickGap={24}
                    />
                    <YAxis
                      domain={[35.5, 38.5]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 14,
                        border: '1px solid var(--color-line)',
                        backgroundColor: 'rgba(255, 255, 255, 0.96)',
                        backdropFilter: 'blur(8px)',
                        color: 'var(--color-ink)',
                        fontSize: 12,
                      }}
                    />
                    <ReferenceLine y={37.0} stroke="#D97706" strokeDasharray="3 3" label={{ value: 'Target (37.0°C)', fill: '#D97706', fontSize: 10, position: 'top' }} />
                    <Area
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="temp"
                      name="Temperature (°C)"
                      stroke="#D97706"
                      strokeWidth={2.5}
                      fill="url(#trendTempGrad)"
                      dot={{ r: 2.5, fill: '#D97706' }}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffffff' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                icon={Thermometer}
                title="No temperature data recorded"
                description="Probe readings will be plotted as sensor telemetry is gathered."
              />
            )}
          </div>
          <p className="text-[11px] text-muted font-medium mt-3 flex items-center gap-1.5 pt-3 border-t border-line">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
            <span>Normative range: 36.5 °C – 37.5 °C</span>
          </p>
        </div>
      </div>

      {/* 5. Telemetry Observation Audit Log Table */}
      <EquipmentHistory showTrend={false} />
    </div>
  );
}
