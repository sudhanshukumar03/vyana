import { ECGWaveform } from '../components/ECGWaveform';
import { useSensorPresentation } from '../store/useSensorPresentation';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Activity, Heart, Thermometer, Waves, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { currentSensorReadings, liveEquipment } from '../services/equipment';

export default function Vitals() {
  const { vitals, historicalVitals, device, previewEnabled } = useSensorPresentation();
  const equipment = liveEquipment(device);
  const current = currentSensorReadings(vitals ?? {}, previewEnabled ? null : equipment);
  const temperature = current.temperature;

  const equipmentDetails = equipment || previewEnabled ? (
    <section
      className="surface p-5 rounded-3xl border border-line bg-surface space-y-2 shadow-xs"
      aria-label="Live equipment details"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink flex items-center gap-2">
          <Waves className="w-4 h-4 text-brand" />
          <span>Active ESP32 Hardware Diagnostics</span>
        </h2>
        <span
          className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full font-bold border ${
            equipment
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-brand/10 text-brand border-brand/20'
          }`}
        >
          {equipment ? 'LIVE HARDWARE' : 'SIMULATED DEMO'}
        </span>
      </div>
      <p className="text-xs text-muted leading-relaxed">
        AD8232 ECG telemetry and DS18B20 calibrated temperature probe readings streaming at 50Hz.
      </p>
      <div className="flex flex-wrap gap-4 pt-1 font-mono text-xs text-slate-600">
        <span className="bg-surface-soft px-3 py-1 rounded-xl border border-line">
          Raw ADC: <strong className="text-ink">{equipment?.ecg_raw_adc ?? 2048}</strong> / 4095
        </span>
        <span className="bg-surface-soft px-3 py-1 rounded-xl border border-line">
          Signal Voltage: <strong className="text-ink">{equipment?.ecg_millivolts ?? 1650} mV</strong>
        </span>
        <span className="bg-surface-soft px-3 py-1 rounded-xl border border-line">
          Sampled:{' '}
          <strong className="text-ink">{equipment?.ecg_samples ?? 1200}</strong> (clipped:{' '}
          <strong className="text-amber-700">{equipment?.ecg_clipped_samples ?? 0}</strong>)
        </span>
      </div>
    </section>
  ) : null;

  // Formatting historical data for charts
  const chartData = historicalVitals.map((v) => ({
    time: new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    hr: v.heart_rate,
    spo2: v.spo2,
    temp: v.temperature ? Number(v.temperature.toFixed(1)) : null,
  }));

  return (
    <div className="page-stack space-y-6 max-w-6xl mx-auto w-full">
      <PageHeader
        title="Vitals"
        description="Live high-fidelity telemetry streamed from your IoT sensor node and recorded observations."
        icon={Activity}
      />

      {equipmentDetails}

      {/* Main 3 Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Heart Rate Card */}
        <div className="surface p-5 sm:p-6 rounded-3xl border border-line bg-surface flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Heart Rate</span>
              <div className="p-2 rounded-xl bg-rose-50 text-rose-500 border border-rose-100">
                <Heart className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-ink font-mono tracking-tight">
                {current.heart_rate ?? '—'}
              </span>
              <span className="text-sm font-semibold text-muted">bpm</span>
            </div>
            <p className="text-[11px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Target: 60 – 100 bpm</span>
            </p>
          </div>

          <div className="h-44 mt-4">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2E62DE" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#2E62DE" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
                  <XAxis
                    dataKey="time"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
                    minTickGap={20}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid var(--color-line)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-ink)',
                      fontSize: 12,
                    }}
                  />
                  <Area
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="hr"
                    name="Heart Rate"
                    stroke="#2E62DE"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#hrGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted bg-surface-soft/40 rounded-2xl border border-dashed border-line">
                Awaiting telemetry samples
              </div>
            )}
          </div>
        </div>

        {/* SpO2 Card */}
        <div className="surface p-5 sm:p-6 rounded-3xl border border-line bg-surface flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Blood Oxygen</span>
              <div className="p-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-100">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-ink font-mono tracking-tight">
                {current.spo2 ?? '—'}
              </span>
              <span className="text-sm font-semibold text-muted">%</span>
            </div>
            <p className="text-[11px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Target: 95 – 100%</span>
            </p>
          </div>

          <div className="h-44 mt-4">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spo2Grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284C7" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0284C7" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
                  <XAxis
                    dataKey="time"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
                    minTickGap={20}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid var(--color-line)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-ink)',
                      fontSize: 12,
                    }}
                  />
                  <Area
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="spo2"
                    name="SpO2"
                    stroke="#0284C7"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#spo2Grad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted bg-surface-soft/40 rounded-2xl border border-dashed border-line">
                Awaiting telemetry samples
              </div>
            )}
          </div>
        </div>

        {/* Temperature Card */}
        <div className="surface p-5 sm:p-6 rounded-3xl border border-line bg-surface flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Body Temperature</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                <Thermometer className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-ink font-mono tracking-tight">
                {temperature == null ? '—' : Number(temperature.toFixed(1))}
              </span>
              <span className="text-sm font-semibold text-muted">°C</span>
            </div>
            <p className="text-[11px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Target: 36.5 – 37.5 °C</span>
            </p>
          </div>

          <div className="h-44 mt-4">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D97706" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#D97706" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
                  <XAxis
                    dataKey="time"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
                    minTickGap={20}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid var(--color-line)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-ink)',
                      fontSize: 12,
                    }}
                  />
                  <Area
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="temp"
                    name="Temperature"
                    stroke="#D97706"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#tempGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted bg-surface-soft/40 rounded-2xl border border-dashed border-line">
                Awaiting telemetry samples
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Real-time ECG Waveform Telemetry Panel */}
      <ECGWaveform />
    </div>
  );
}
