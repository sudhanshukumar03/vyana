import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartNoAxesCombined } from 'lucide-react';
import { EmptyState } from './EmptyState';

export function TrendsChart({ data }: { data: { time: string; heartRate: number; spo2: number }[] }) {
  return (
    <section className="surface flex flex-col">
      <h2 className="surface-title">Recent vital trends</h2>
      <p className="surface-description">Heart rate and blood oxygen from saved readings.</p>
      {data.length ? <>
        <div className="chart-legend mb-5"><span><i className="legend-line" aria-hidden="true" />Heart rate (bpm)</span><span><i className="legend-line secondary" aria-hidden="true" />SpO₂ (%) · dashed</span></div>
        <div className="chart-frame" role="img" aria-label="Line chart of heart rate (bpm) and SpO₂ (%) over recent readings">
          <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{top:10,right:0,left:-24,bottom:8}}>
            <XAxis dataKey="time" stroke="var(--color-muted)" fontSize={11} tickLine={false} axisLine={false} dy={8} minTickGap={32} />
            <YAxis yAxisId="heart" stroke="var(--color-muted)" fontSize={11} tickLine={false} axisLine={false} domain={['auto','auto']} />
            <YAxis yAxisId="oxygen" orientation="right" width={35} stroke="var(--color-muted)" fontSize={11} tickLine={false} axisLine={false} domain={['auto','auto']} />
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
            <Tooltip contentStyle={{borderRadius:10,border:'1px solid var(--color-line)',fontSize:12}} />
            <Line isAnimationActive={false} yAxisId="heart" type="monotone" dataKey="heartRate" stroke="var(--color-brand)" strokeWidth={2.5} dot={false} name="Heart Rate" />
            <Line isAnimationActive={false} yAxisId="oxygen" type="monotone" dataKey="spo2" stroke="var(--color-ink)" strokeDasharray="5 4" strokeWidth={2} dot={false} name="SpO₂" />
          </LineChart></ResponsiveContainer>
        </div>
      </> : <EmptyState icon={ChartNoAxesCombined} title="Your trends start here." description="Recorded readings will build a picture of changes over time." />}
    </section>
  );
}
