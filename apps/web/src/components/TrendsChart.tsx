import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartNoAxesCombined } from 'lucide-react';
import { EmptyState } from './EmptyState';

export function TrendsChart({ data }: { data: { time: string; heartRate: number; spo2: number }[] }) {
  return (
    <section className="surface flex flex-col">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h2 className="surface-title">Recent Vital Trends</h2>
        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20">
          CONTINUOUS STREAM
        </span>
      </div>
      <p className="surface-description">Correlated resting heart rate and peripheral oxygen saturation trends.</p>
      {data.length ? (
        <>
          <div className="chart-legend mb-4 mt-2">
            <span className="flex items-center gap-1.5 font-semibold text-xs text-ink">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#2563eb]" />
              Heart rate (bpm)
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-xs text-slate-700">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#0ea5e9]" />
              SpO₂ (%) · dashed
            </span>
          </div>
          <div className="chart-frame" role="img" aria-label="Area chart of heart rate (bpm) and SpO₂ (%) over recent readings">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 12, right: 4, left: -24, bottom: 8 }}>
                <defs>
                  <linearGradient id="dashboardHrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="dashboardSpo2Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  stroke="var(--color-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  dy={8}
                  minTickGap={32}
                />
                <YAxis
                  yAxisId="heart"
                  stroke="var(--color-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                />
                <YAxis
                  yAxisId="oxygen"
                  orientation="right"
                  width={35}
                  stroke="var(--color-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" opacity={0.6} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid var(--color-line)',
                    fontSize: 12,
                    backgroundColor: 'rgba(255, 255, 255, 0.96)',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.08)',
                    padding: '8px 12px',
                    fontWeight: 500,
                  }}
                />
                <Area
                  isAnimationActive={false}
                  yAxisId="heart"
                  type="monotone"
                  dataKey="heartRate"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#dashboardHrGrad)"
                  dot={false}
                  name="Heart Rate"
                />
                <Area
                  isAnimationActive={false}
                  yAxisId="oxygen"
                  type="monotone"
                  dataKey="spo2"
                  stroke="#0ea5e9"
                  strokeDasharray="5 4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#dashboardSpo2Grad)"
                  dot={false}
                  name="SpO₂"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <EmptyState
          icon={ChartNoAxesCombined}
          title="Your trends start here."
          description="Recorded readings will build a picture of changes over time."
        />
      )}
    </section>
  );
}
