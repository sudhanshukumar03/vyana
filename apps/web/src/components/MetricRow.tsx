import type { Vitals } from '../store/useHealthStore';
import { Heart, Droplet, Thermometer, Activity, Footprints, type LucideIcon } from 'lucide-react';

function MetricCard({ title, value, unit, icon: Icon, status, statusColor, critical = false, textValue = false }: {
  title: string; value: string | number; unit?: string; icon: LucideIcon; status: string;
  statusColor: string; critical?: boolean; textValue?: boolean;
}) {
  return (
    <div className={`metric-card ${critical ? 'critical' : ''}`}>
      <div className="metric-card-header"><h3>{title}</h3><Icon aria-hidden="true" /></div>
      <div className="metric-reading"><span className={`metric-value ${textValue ? 'text-value' : ''} ${critical ? 'text-critical' : ''}`}>{value}</span>{unit && <span className="metric-unit">{unit}</span>}</div>
      <p className={`metric-status ${statusColor}`}>{status}</p>
    </div>
  );
}

export function MetricRow({ data }: { data: Partial<Vitals> & { steps?: number } }) {
  const hr = data.heart_rate, spo2 = data.spo2, temp = data.temperature;
  const hrStatus = hr == null ? ['No data', 'text-muted'] : hr > 150 || hr < 40 ? ['Critical', 'text-critical'] : hr > 120 ? ['Elevated', 'text-warn'] : hr < 45 ? ['Low', 'text-warn'] : ['Within range', 'text-success'];
  const oxygenStatus = spo2 == null ? ['No data', 'text-muted'] : spo2 < 88 ? ['Critical', 'text-critical'] : spo2 < 92 ? ['Low', 'text-warn'] : ['Within range', 'text-success'];
  const temperatureStatus = temp == null ? ['No data', 'text-muted'] : temp > 39.5 ? ['High fever', 'text-critical'] : temp > 38 ? ['Fever', 'text-warn'] : temp < 35 ? ['Low', 'text-warn'] : ['Normal', 'text-success'];
  const ecg = data.ecg_status ?? 'Unknown';
  return (
    <div className="metric-grid">
      <MetricCard title="Heart rate" value={hr ?? '—'} unit="bpm" icon={Heart} status={hrStatus[0]} statusColor={hrStatus[1]} critical={hrStatus[1] === 'text-critical'} />
      <MetricCard title="Blood oxygen" value={spo2 ?? '—'} unit="%" icon={Droplet} status={oxygenStatus[0]} statusColor={oxygenStatus[1]} critical={oxygenStatus[1] === 'text-critical'} />
      <MetricCard title="Temperature" value={temp ?? '—'} unit="°C" icon={Thermometer} status={temperatureStatus[0]} statusColor={temperatureStatus[1]} critical={temperatureStatus[1] === 'text-critical'} />
      <MetricCard title="ECG status" value={ecg} icon={Activity} textValue status={ecg === 'Unknown' ? 'No current data' : ecg === 'Normal' ? 'Reported normal' : ecg} statusColor={ecg === 'Unknown' ? 'text-muted' : ecg === 'Normal' ? 'text-success' : 'text-warn'} />
      <MetricCard title="Steps" value={data.steps?.toLocaleString() ?? '—'} icon={Footprints} status="Latest recorded count" statusColor="text-muted" />
    </div>
  );
}
