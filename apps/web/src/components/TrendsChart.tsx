import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

export function TrendsChart({ data }: { data: {time: string; heartRate: number; spo2: number}[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-surface rounded-2xl p-6 border border-line h-full min-h-[300px] flex items-center justify-center">
        <p className="text-slate font-medium">No trend data available</p>
      </div>
    );
  }


  return (
    <div className="bg-surface rounded-2xl p-5 border border-line flex flex-col h-full">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="font-display text-[16px] font-semibold text-ink mb-2">Unified Vital Trends</h2>
          <div className="flex items-center gap-4 text-[13px] font-medium text-slate">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-brand"></div>
              <span>Heart Rate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-ink"></div>
              <span>SpO₂</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium text-slate">
          <span>Recent readings ? {format(new Date(), 'MMM d, yyyy')}</span>
        </div>
      </div>

      <div className="flex-1 min-h-[220px] w-full" role="img" aria-label="Line chart of heart rate (bpm) and SpO₂ (%) over recent readings">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="time" stroke="#536663" fontSize={11} tickLine={false} axisLine={false} dy={10} />
            <YAxis stroke="#536663" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d7e5e1" />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #d7e5e1' }} />
            <Line type="monotone" dataKey="heartRate" stroke="#0f766e" strokeWidth={2.5} dot={false} name="Heart Rate" />
            <Line type="monotone" dataKey="spo2" stroke="#17312f" strokeWidth={2} dot={false} name="SpO₂" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
