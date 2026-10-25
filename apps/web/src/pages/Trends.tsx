import { useHealthStore } from '../store/useHealthStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Activity } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';

export default function Trends() {
  const { historicalVitals, historicalActivity } = useHealthStore();

  const vitalsData = historicalVitals.map(v => ({
    time: new Date(v.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    hr: v.heart_rate,
    spo2: v.spo2
  }));

  const activityData = historicalActivity.map(a => ({
    time: new Date(a.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    steps: a.steps
  }));

  return (
    <div className="page-stack">
      <PageHeader title="Health Trends" description="See how your readings and movement change across recorded observations." icon={TrendingUp} />

      <div className="grid grid-cols-1 gap-6">
        <div className="surface">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-medium text-ink">Heart Rate & SpO2 Trend</h2>
              <p className="text-sm text-muted">How your vitals have been tracking recently</p>
              <div className="chart-legend"><span><i className="legend-line" aria-hidden="true" />Heart rate (bpm)</span><span><i className="legend-line secondary" aria-hidden="true" />SpO₂ (%) · dashed</span></div>
            </div>
            <Activity className="text-muted w-5 h-5" />
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={vitalsData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#586d65' }} />
                <YAxis yAxisId="left" domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#586d65' }} />
                <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#586d65' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line isAnimationActive={false} yAxisId="left" type="monotone" dataKey="hr" name="Heart Rate" stroke="var(--color-brand)" strokeWidth={2} dot={false} />
                <Line isAnimationActive={false} yAxisId="right" type="monotone" dataKey="spo2" name="SpO2 %" stroke="var(--color-ink)" strokeDasharray="5 4" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-medium text-ink">Activity Trend</h2>
              <p className="text-sm text-muted">Your step counts over time</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#586d65' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#586d65' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line isAnimationActive={false} type="monotone" dataKey="steps" name="Steps" stroke="var(--color-brand)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
