import type { ActivityReading, Alert, DeviceStatus as DeviceData } from '../store/useHealthStore';
import { Heart, Droplet, Footprints, Watch, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useHealthStore } from '../store/useHealthStore';

const fmt = (value: number | undefined | null, suffix = '') => value == null ? '—' : `${value}${suffix}`;

export function WellnessProgress() {
  const { wellnessScore, vitals, activity } = useHealthStore();
  return (
    <section className="surface">
      <h2 className="surface-title">Wellness overview</h2><p className="surface-description">A project heuristic, not a clinical assessment.</p>
      <div className="score-ring">
        <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-line)" strokeWidth="8" /><circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-brand)" strokeWidth="8" strokeLinecap="round" strokeDasharray="314.16" strokeDashoffset={314.16 * (1 - (wellnessScore ?? 0) / 100)} /></svg>
        <div className="score-ring-value"><strong>{wellnessScore ?? '—'}</strong><span>Prototype score / 100</span></div>
      </div>
      <dl className="reading-list">
        <div><dt><Heart aria-hidden="true" />Heart rate</dt><dd>{fmt(vitals?.heart_rate, ' bpm')}</dd></div>
        <div><dt><Droplet aria-hidden="true" />Blood oxygen</dt><dd>{fmt(vitals?.spo2, '%')}</dd></div>
        <div><dt><Footprints aria-hidden="true" />Steps</dt><dd>{fmt(activity?.steps)}</dd></div>
      </dl>
    </section>
  );
}

export function ActivityOverview({ data }: { data: ActivityReading[] }) {
  const activity = useHealthStore(state => state.activity);
  const rows = [...data].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const chartData = rows.map((row, index) => ({
    name: new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    steps: index > 0 ? Math.max(0, row.steps - rows[index - 1].steps) : 0,
  }));
  return (
    <section className="surface">
      <h2 className="surface-title">Recent movement</h2><p className="surface-description">Steps gained between recorded readings.</p>
      <div className="h-[180px] mt-5" role="img" aria-label="Steps gained per recent reading">
        {chartData.some(item => item.steps > 0) ? <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{top:10,right:0,left:-25,bottom:0}}>
          <XAxis dataKey="name" stroke="var(--color-muted)" fontSize={10} tickLine={false} axisLine={false} /><YAxis stroke="var(--color-muted)" fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip cursor={{fill:'var(--color-surface-soft)'}} contentStyle={{borderRadius:10,border:'1px solid var(--color-line)',fontSize:12}} /><Bar isAnimationActive={false} dataKey="steps" fill="var(--color-brand)" radius={[3,3,0,0]} maxBarSize={18} />
        </BarChart></ResponsiveContainer> : <div className="h-full grid place-content-center text-sm text-muted text-center">No activity readings yet.</div>}
      </div>
      <dl className="reading-list border-t border-line pt-4">
        <div><dt>Steps</dt><dd>{activity?.steps?.toLocaleString() ?? '—'}</dd></div><div><dt>Distance</dt><dd>{fmt(activity?.distance_km, ' km')}</dd></div><div><dt>Calories</dt><dd>{fmt(activity?.calories, ' kcal')}</dd></div>
      </dl>
    </section>
  );
}

export function DeviceStatus({ alerts, device }: { alerts?: Alert[]; device?: DeviceData }) {
  const recent = alerts?.slice(0, 3) ?? [];
  return (
    <section className="surface">
      <h2 className="surface-title">Device & alerts</h2>
      <div className="device-summary"><span className="device-summary-icon"><Watch aria-hidden="true" /></span><div className="min-w-0">
        <h3 className="text-sm font-medium [overflow-wrap:anywhere]">{device?.device_name ?? 'No device connected'}</h3>
        <p>{device?.source ?? 'Add a reading source to begin.'}</p><p>{!device ? 'No device data' : device.connected ? 'Connected' : 'Disconnected or stale'}{device?.battery != null ? ` · ${device.battery}% battery` : ''}</p>
      </div></div>
      <h3 className="text-xs font-medium text-muted mb-4">Recent alerts</h3>
      {recent.length ? <ul className="alert-list">{recent.map(alert => <li key={alert.id}>
        <AlertTriangle className={alert.severity === 'critical' ? 'text-critical' : alert.severity === 'warning' ? 'text-warn' : 'text-brand'} aria-hidden="true" />
        <div><strong>{alert.title}</strong><p>{alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : ''} · {alert.status === 'active' ? 'Active' : 'Resolved'}</p></div>
      </li>)}</ul> : <p className="text-sm text-muted">No recent alerts.</p>}
    </section>
  );
}
