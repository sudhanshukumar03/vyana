import { MetricRow } from '../components/MetricRow';
import { TrendsChart } from '../components/TrendsChart';
import { WellnessProgress, DeviceStatus, ActivityOverview } from '../components/BottomSection';
import { useHealthStore } from '../store/useHealthStore';
import { format } from 'date-fns';
import { AlertTriangle } from 'lucide-react';

export function Dashboard() {
  const { vitals, activity, alerts, device, insights, insightsOffline, historicalVitals, historicalActivity, isConnected, freshness } = useHealthStore();

  const chartData = [...(historicalVitals ?? [])]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((v) => ({
      time: v.timestamp ? format(new Date(v.timestamp), 'HH:mm') : '',
      heartRate: v.heart_rate,
      spo2: v.spo2,
    }));
  const activityData = historicalActivity ? [...historicalActivity].reverse() : [];

  const criticalVitals: string[] = [];
  if (vitals && freshness.state === 'fresh') {
    if (vitals.heart_rate != null && (vitals.heart_rate > 150 || vitals.heart_rate < 40)) criticalVitals.push(`Heart rate ${vitals.heart_rate} bpm`);
    if (vitals.spo2 != null && vitals.spo2 < 88) criticalVitals.push(`SpO₂ ${vitals.spo2}%`);
    if (vitals.temperature != null && vitals.temperature > 39.5) criticalVitals.push(`Temperature ${vitals.temperature}°C`);
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-4 lg:space-y-6 pb-12">

      {criticalVitals.length > 0 && (
        <div role="alert" aria-live="assertive" className="flex items-start gap-3 rounded-2xl border border-critical bg-critical-bg px-5 py-4 text-critical">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-[14px]">Critical reading{criticalVitals.length > 1 ? 's' : ''} detected</p>
            <p className="text-[13px] mt-0.5">{criticalVitals.join(', ')} — review now and contact your doctor if this persists.</p>
          </div>
        </div>
      )}

      {!vitals && !isConnected ? (
        <div className="h-32 flex items-center justify-center bg-surface rounded-2xl border border-line">
          <p className="text-slate font-medium">Loading live telemetry…</p>
        </div>
      ) : (
        <MetricRow data={{ ...vitals, steps: activity?.steps }} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2 flex flex-col h-full min-h-[340px]">
          {chartData.length > 0 ? (
            <TrendsChart data={chartData} />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-surface rounded-2xl border border-line">
              <p className="text-slate font-medium">No historical measurements yet.</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-1 bg-surface rounded-2xl p-5 border border-line flex flex-col">
          <h3 className="font-display text-[16px] font-semibold text-ink mb-1">Health Insights</h3>
          <p role="status" className="text-xs text-slate mb-4">{insights.length ? insightsOffline===false?'AI guidance':'Rule-based guidance' : 'Waiting for guidance'}</p>
          <div className="flex-1 space-y-3.5 overflow-y-auto">
            {insights.length === 0 ? (
              <div className="text-center text-slate text-sm mt-8 font-medium">No insights available yet.</div>
            ) : (
              insights.map((insight, idx) => (
                <div key={idx} className="flex gap-3 text-[13px] text-ink/90 leading-snug">
                  <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-brand" aria-hidden="true"></span>
                  <span>{insight.detail}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <WellnessProgress />
        <ActivityOverview data={activityData} />
        <DeviceStatus alerts={alerts} device={device} />
      </div>
    </div>
  );
}
