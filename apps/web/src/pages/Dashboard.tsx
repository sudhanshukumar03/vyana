import { MetricRow } from '../components/MetricRow';
import { TrendsChart } from '../components/TrendsChart';
import { WellnessProgress, DeviceStatus, ActivityOverview } from '../components/BottomSection';
import { PageHeader } from '../components/PageHeader';
import { useHealthStore } from '../store/useHealthStore';
import { format } from 'date-fns';
import { AlertTriangle, ArrowUpRight, Bot } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const { vitals, activity, alerts, device, insights, insightsOffline, historicalVitals, historicalActivity, freshness } = useHealthStore();
  const chartData = [...historicalVitals].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map(reading => ({
    time: format(new Date(reading.timestamp), 'HH:mm'), heartRate: reading.heart_rate, spo2: reading.spo2,
  }));
  const criticalVitals: string[] = [];
  if (vitals && freshness.state === 'fresh') {
    if (vitals.heart_rate != null && (vitals.heart_rate > 150 || vitals.heart_rate < 40)) criticalVitals.push(`Heart rate ${vitals.heart_rate} bpm`);
    if (vitals.spo2 != null && vitals.spo2 < 88) criticalVitals.push(`SpO₂ ${vitals.spo2}%`);
    if (vitals.temperature != null && vitals.temperature > 39.5) criticalVitals.push(`Temperature ${vitals.temperature}°C`);
  }
  return (
    <div className="page-stack">
      <PageHeader title="Your health, in focus." description="Your latest readings, recent movement and wellness guidance, together in one place." />
      {criticalVitals.length > 0 && <div role="alert" aria-live="assertive" className="flex items-start gap-3 rounded-xl border border-critical bg-critical-bg px-5 py-4 text-critical">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
        <div><p className="font-semibold text-sm">Critical reading{criticalVitals.length > 1 ? 's' : ''} detected</p>
          <p className="text-sm mt-1">{criticalVitals.join(', ')} — review now and contact your doctor if this persists.</p></div>
      </div>}
      <section aria-label="Latest readings" className="space-y-4">
        <div className="section-heading"><h2>Latest snapshot</h2><span className="status-chip">{vitals?.source || device?.source || 'No active source'}</span></div>
        <MetricRow data={{ ...vitals, steps: activity?.steps }} />
      </section>
      <div className="dashboard-main">
        <TrendsChart data={chartData} />
        <section className="surface insights-surface">
          <div className="insights-heading"><Bot aria-hidden="true" /><h2 className="surface-title">Health insights</h2></div>
          <p role="status" className="surface-description">{insights.length ? insightsOffline === false ? 'AI guidance' : 'Rule-based guidance' : 'Waiting for guidance'}</p>
          <div className="insights-list">
            {insights.length ? insights.map((insight, index) => <p key={index} className="insight-line">{insight.detail}</p>)
              : <p className="text-sm text-muted leading-relaxed">Guidance will appear when readings are available. You can also ask the assistant a wellness question.</p>}
          </div>
          <Link to="/assistant" className="ui-button secondary">Open AI Assistant<ArrowUpRight aria-hidden="true" /></Link>
        </section>
      </div>
      <div className="dashboard-bottom">
        <WellnessProgress /><ActivityOverview data={historicalActivity} /><DeviceStatus alerts={alerts} device={device} />
      </div>
    </div>
  );
}
