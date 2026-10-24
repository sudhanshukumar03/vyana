import type { ActivityReading, Alert, DeviceStatus as DeviceData } from '../store/useHealthStore';
import { Heart, Droplet, Moon, Footprints, Thermometer } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useHealthStore } from '../store/useHealthStore';

const fmt = (v: number | undefined | null, suffix = '') =>
  v === undefined || v === null ? '—' : `${v}${suffix}`;

export function WellnessProgress() {
  const { wellnessScore, vitals, activity } = useHealthStore();
  const score = wellnessScore ?? 0;
  return (
    <div className="bg-surface rounded-2xl p-5 border border-line flex flex-col h-full">
      <h2 className="font-display text-[16px] font-semibold text-ink mb-6">Wellness Progress</h2>

      <div className="flex flex-col items-center">
        <div className="relative w-28 h-28 flex items-center justify-center mb-6">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="56" cy="56" r="48" fill="transparent" stroke="#e4e0d8" strokeWidth="10" />
            <circle cx="56" cy="56" r="48" fill="transparent" stroke="#0f766e" strokeWidth="10"
              strokeDasharray={301.59} strokeDashoffset={301.59 - (301.59 * score) / 100}
              className="transition-all duration-1000 ease-out" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-[30px] font-semibold text-ink leading-none tabular-nums">{wellnessScore ?? '—'}</span>
            <span className="text-[11px] font-medium text-slate mt-1">Prototype Score</span>
          </div>
        </div>

        <div className="w-full space-y-2.5">
          <div className="flex items-center justify-between text-[13px]">
            <div className="flex items-center gap-2"><Heart className="w-3.5 h-3.5 text-brand"/><span className="font-medium text-ink">Heart</span></div>
            <span className="font-medium text-ink tabular-nums">{fmt(vitals?.heart_rate, ' bpm')}</span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <div className="flex items-center gap-2"><Droplet className="w-3.5 h-3.5 text-slate"/><span className="font-medium text-ink">Oxygen</span></div>
            <span className="font-medium text-ink tabular-nums">{fmt(vitals?.spo2, '%')}</span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <div className="flex items-center gap-2"><Moon className="w-3.5 h-3.5 text-slate"/><span className="font-medium text-ink">Sleep</span></div>
            <span className="text-slate">— <span className="text-slate">not tracked</span></span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <div className="flex items-center gap-2"><Footprints className="w-3.5 h-3.5 text-slate"/><span className="font-medium text-ink">Activity</span></div>
            <span className="font-medium text-ink tabular-nums">{fmt(activity?.steps, ' steps')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
export function ActivityOverview({ data }: { data: ActivityReading[] }) {
  const { activity } = useHealthStore();
  const rows = (Array.isArray(data) ? [...data] : []).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const chartData = rows.map((r, i) => ({
    name: r.timestamp ? new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `#${i + 1}`,
    steps: i > 0 && typeof r.steps === 'number' && typeof rows[i - 1].steps === 'number' ? Math.max(0, r.steps - rows[i - 1].steps) : 0,
  }));
  const hasChart = chartData.some((d) => d.steps > 0);

  return (
    <div className="bg-surface rounded-2xl p-5 border border-line flex flex-col h-full">
      <h2 className="font-display text-[16px] font-semibold text-ink mb-4">Recent Activity</h2>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate mb-2">
        <div className="w-2 h-2 rounded-full bg-brand"></div>Steps gained per reading
      </div>
      <div className="flex-1 w-full min-h-[140px]" role="img" aria-label="Steps gained per recent reading">
        {hasChart ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
              <XAxis dataKey="name" stroke="#5b6472" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#5b6472" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'rgba(21,35,59,0.04)' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e4e0d8', background: '#fbfaf7', fontSize: '12px' }} />
              <Bar dataKey="steps" fill="#0f766e" radius={[3, 3, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-[13px] text-slate">No activity readings yet.</div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-line">
        <div><p className="text-[11px] text-slate font-medium mb-0.5">Steps</p><p className="font-display text-[16px] font-semibold text-ink tabular-nums">{activity?.steps?.toLocaleString() ?? '—'}</p></div>
        <div><p className="text-[11px] text-slate font-medium mb-0.5">Distance</p><p className="font-display text-[16px] font-semibold text-ink tabular-nums">{activity?.distance_km ?? '—'} <span className="text-[11px] font-medium text-slate">km</span></p></div>
        <div><p className="text-[11px] text-slate font-medium mb-0.5">Calories</p><p className="font-display text-[16px] font-semibold text-ink tabular-nums">{activity?.calories?.toLocaleString() ?? '—'} <span className="text-[11px] font-medium text-slate">kcal</span></p></div>
      </div>
    </div>
  );
}
export function DeviceStatus({ alerts, device }: { alerts?: Alert[], device?: DeviceData }) {
  const recent = alerts?.length ? alerts.slice(0, 3) : [];
  const sevStyle = (sev: string) =>
    sev === 'critical' ? 'bg-critical/10 text-critical'
    : sev === 'warning' ? 'bg-warn/10 text-warn'
    : 'bg-calm/10 text-calm';

  return (
    <div className="bg-surface rounded-2xl p-5 border border-line flex flex-col h-full">
      <div className="grid grid-cols-2 gap-4 h-full">
        <div className="flex flex-col border-r border-line pr-4">
          <h2 className="text-[13px] font-semibold text-ink mb-4">Recent Alerts</h2>
          <div className="flex-1 space-y-4">
            {recent.length === 0 ? (
              <p className="text-[12px] text-slate font-medium">No recent alerts.</p>
            ) : recent.map((alert, i) => {
              const isActive = alert.status === 'active';
              return (
                <div key={alert.id ?? i} className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-full mt-0.5 ${sevStyle(alert.severity)}`}>
                    {alert.severity === 'critical' ? <Heart className="w-3.5 h-3.5" />
                      : alert.severity === 'warning' ? <Thermometer className="w-3.5 h-3.5" />
                      : <Droplet className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-ink leading-tight">{alert.title}</p>
                    <p className="text-[11px] font-medium text-slate mt-0.5">{alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                  </div>
                  <div className="ml-auto">
                    <span className={`text-[10px] font-semibold ${isActive ? 'text-critical' : 'text-muted'}`}>{isActive ? 'Active' : 'Resolved'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col pl-2">
          <h2 className="text-[13px] font-semibold text-ink mb-4">Device Status</h2>
          <div className="flex-1 bg-porcelain rounded-xl p-4 border border-line flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-ink rounded-xl mb-3 flex items-center justify-center shadow-inner relative overflow-hidden">
              <div className="absolute inset-2 rounded-full border-4 border-brand"></div>
              <div className="absolute inset-3 rounded-full border-4 border-surface/70"></div>
              <div className="absolute inset-4 rounded-full border-4 border-calm"></div>
            </div>
            <p className="text-[13px] font-bold text-ink leading-tight">{device?.device_name ?? 'Vyana Band'}</p>
            <p className="text-[11px] text-slate font-medium mb-1">{device?.source ?? 'Wearable'}</p>
            <p className={`text-[11px] font-bold mb-0.5 ${device?.connected ? 'text-calm' : 'text-slate'}`}>{!device ? 'No device data' : device.connected ? 'Connected' : 'Disconnected or stale'}</p>
            <p className="text-[11px] font-medium text-slate">Battery: <span className="tabular-nums text-ink">{device?.battery != null ? `${device.battery}%` : '—'}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
