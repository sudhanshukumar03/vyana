import { MetricRow } from '../components/MetricRow';
import { TrendsChart } from '../components/TrendsChart';
import { DeviceStatus } from '../components/BottomSection';

import { useSensorPresentation } from '../store/useSensorPresentation';
import { format } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { currentSensorReadings, liveEquipment, readingSourceLabel } from '../services/equipment';
import { HealthReviewSection } from '../components/HealthReview';
import { ECGWaveform } from '../components/ECGWaveform';

export function Dashboard() {
  const { vitals, activity, alerts, device, historicalVitals, freshness, previewEnabled, previewFields } = useSensorPresentation();
  const chartData = [...historicalVitals].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map(reading => ({
    time: format(new Date(reading.timestamp), 'HH:mm'), heartRate: reading.heart_rate, spo2: reading.spo2,
  }));
  const criticalVitals: string[] = [];
  const equipment=liveEquipment(device);
  const current=currentSensorReadings(vitals??{},previewEnabled?null:equipment);
  if (equipment || vitals && freshness.state === 'fresh') {
    if (!previewFields.includes('heart_rate') && current.heart_rate != null && (current.heart_rate > 150 || current.heart_rate < 40)) criticalVitals.push(`Heart rate ${current.heart_rate} bpm`);
    if (!previewFields.includes('spo2') && current.spo2 != null && current.spo2 < 88) criticalVitals.push(`SpO₂ ${current.spo2}%`);
    if (!previewFields.includes('temperature') && !equipment && !current.fromEquipment && current.temperature != null && current.temperature > 39.5) criticalVitals.push(`Temperature ${current.temperature}°C`);
  }
  return (
    <div className="page-stack dashboard-page">
      <h1 className="sr-only">Dashboard</h1>
      {criticalVitals.length > 0 && <div role="alert" aria-live="assertive" className="flex items-start gap-3 rounded-xl border border-critical bg-critical-bg px-5 py-4 text-critical">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
        <div><p className="font-semibold text-sm">Critical reading{criticalVitals.length > 1 ? 's' : ''} detected</p>
          <p className="text-sm mt-1">
            {criticalVitals.join(', ')} — review now and{' '}
            <Link to="/emergency" className="underline font-semibold hover:opacity-80">
              contact your doctor or find a nearby emergency room
            </Link>{' '}
            if this persists.
          </p></div>
      </div>}
      <section aria-label="Latest readings" className="space-y-4">
        <div className="section-heading">
          <h2>Latest snapshot</h2>
          <div className="flex items-center gap-2.5">
            <span className="status-chip">
              {previewEnabled ? 'Demo mode: includes simulated data' : readingSourceLabel(vitals?.source || device?.source)}
            </span>
          </div>
        </div>
        <MetricRow data={{ ...vitals, steps: activity?.steps }} equipment={previewEnabled?null:equipment} previewFields={previewFields} />
      </section>
      {(device?.active || previewEnabled) && <ECGWaveform />}
      <div className="dashboard-main">
        <div>{previewEnabled && historicalVitals.some(row=>row.source==='DisplayPreview') && <p className="text-xs text-muted mb-2">Preview history: generated values</p>}<TrendsChart data={chartData} /></div>
        <DeviceStatus alerts={alerts} device={device} />
      </div>
        <section className="surface dashboard-review">
          <HealthReviewSection compact/>
        </section>
    </div>
  );
}
