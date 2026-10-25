import { ECGWaveform } from '../components/ECGWaveform';
import { useHealthStore } from '../store/useHealthStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Heart, Thermometer } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';

export default function Vitals() {
  const { vitals, historicalVitals } = useHealthStore();

  if (!vitals) {
    return (
      <div className="page-stack"><PageHeader title="Vitals Overview" description="A closer look at your recorded vital readings." icon={Activity} /><section className="surface"><EmptyState icon={Activity} title="No vitals data available" description="Your connected source's heart rate, oxygen and temperature readings will appear here." /></section></div>
    );
  }

  // Formatting historical data for charts
  const chartData = historicalVitals.map(v => ({
    time: new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    hr: v.heart_rate,
    spo2: v.spo2,
    temp: v.temperature
  }));

  return (
    <div className="page-stack">
      <PageHeader title="Vitals Overview" description="Your latest saved readings and the history behind them." icon={Activity} />
      
      <div className="three-column">
        {/* Heart Rate Card */}
        <div className="surface">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-body">Heart Rate</h2>
            <Heart className="text-brand w-6 h-6" />
          </div>
          <p className="text-3xl font-bold text-ink">{vitals.heart_rate} <span className="text-sm font-normal text-muted">bpm</span></p>
          <div className="h-48 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
                <XAxis dataKey="time" hide />
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip />
                <Line isAnimationActive={false} type="monotone" dataKey="hr" stroke="var(--color-brand)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SpO2 Card */}
        <div className="surface">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-body">Blood Oxygen</h2>
            <Activity className="text-brand w-6 h-6" />
          </div>
          <p className="text-3xl font-bold text-ink">{vitals.spo2} <span className="text-sm font-normal text-muted">%</span></p>
          <div className="h-48 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
                <XAxis dataKey="time" hide />
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip />
                <Line isAnimationActive={false} type="monotone" dataKey="spo2" stroke="var(--color-ink)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Temperature Card */}
        <div className="surface">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-body">Temperature</h2>
            <Thermometer className="text-warn w-6 h-6" />
          </div>
          <p className="text-3xl font-bold text-ink">{vitals.temperature} <span className="text-sm font-normal text-muted">°C</span></p>
          <div className="h-48 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
                <XAxis dataKey="time" hide />
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip />
                <Line isAnimationActive={false} type="monotone" dataKey="temp" stroke="var(--color-warn)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <ECGWaveform />
    </div>
  );
}
