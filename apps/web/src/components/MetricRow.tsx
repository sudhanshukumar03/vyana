import type { Vitals } from '../store/useHealthStore';
import type { EquipmentSnapshot } from '../../../../shared/types/health';
import { Heart, Droplet, Thermometer, Activity, Footprints, type LucideIcon } from 'lucide-react';
import { currentSensorReadings } from '../services/equipment';

function MetricCard({ title, value, unit, icon: Icon, status, statusColor, preview = false, critical = false, textValue = false }: {
  title: string; value: string | number; unit?: string; icon: LucideIcon; status: string;
  statusColor: string; preview?: boolean; critical?: boolean; textValue?: boolean;
}) {
  return (
    <div className={`metric-card ${critical ? 'critical' : ''}`} data-metric={title}>
      <div className="metric-card-header"><h3>{title}{preview && <span className="block text-xs text-muted font-normal">Preview</span>}</h3><Icon aria-hidden="true" /></div>
      <div className="metric-reading"><span className={`metric-value ${textValue ? 'text-value' : ''} ${critical ? 'text-critical' : ''}`}>{value}</span>{unit && <span className="metric-unit">{unit}</span>}</div>
      <p className={`metric-status ${preview?'text-warn':statusColor}`}>{preview?'Simulated · not measured':status}</p>
    </div>
  );
}

export function MetricRow({ data, equipment, previewFields=[] }: { data: Partial<Vitals> & { steps?: number|null }; equipment?: EquipmentSnapshot | null; previewFields?: string[] }) {
  const current=currentSensorReadings(data,equipment);
  const useEquipment=current.fromEquipment;
  const hr = current.heart_rate, spo2 = current.spo2, temp = current.temperature;
  const hrStatus = hr == null ? ['No data', 'text-muted'] : hr > 150 || hr < 40 ? ['Critical', 'text-critical'] : hr > 120 ? ['Elevated', 'text-warn'] : hr < 45 ? ['Low', 'text-warn'] : ['Within range', 'text-success'];
  const oxygenStatus = spo2 == null ? ['No data', 'text-muted'] : spo2 < 88 ? ['Critical', 'text-critical'] : spo2 < 92 ? ['Low', 'text-warn'] : ['Within range', 'text-success'];
  const temperatureStatus = temp == null ? ['No data', 'text-muted'] : useEquipment ? ['Live probe', 'text-brand'] : temp > 39.5 ? ['High fever', 'text-critical'] : temp > 38 ? ['Fever', 'text-warn'] : temp < 35 ? ['Low', 'text-warn'] : ['Normal', 'text-success'];
  const ecg = previewFields.includes('ecg_status') ? 'Input preview' : current.ecg_status ?? 'Unknown';
  const ecgStatus=previewFields.includes('ecg_status') ? 'Generated trace below' : useEquipment&&ecg==='Unknown' ? equipment!.ecg_clipped_samples>0 ? 'Input clipping detected' : 'Unclassified' : ecg === 'Unknown' ? 'No current data' : ecg === 'Normal' ? 'Reported normal' : ecg;
  return (
    <div className="metric-grid">
      <MetricCard preview={previewFields.includes('heart_rate')} title="Heart rate" value={hr ?? '—'} unit="bpm" icon={Heart} status={hrStatus[0]} statusColor={hrStatus[1]} critical={hrStatus[1] === 'text-critical'} />
      <MetricCard preview={previewFields.includes('spo2')} title="Blood oxygen" value={spo2 ?? '—'} unit="%" icon={Droplet} status={oxygenStatus[0]} statusColor={oxygenStatus[1]} critical={oxygenStatus[1] === 'text-critical'} />
      <MetricCard preview={previewFields.includes('temperature')} title="Temperature" value={temp == null ? '—' : Number(temp.toFixed(2))} unit="°C" icon={Thermometer} status={temperatureStatus[0]} statusColor={temperatureStatus[1]} critical={temperatureStatus[1] === 'text-critical'} />
      <MetricCard preview={previewFields.includes('ecg_status')} title="ECG status" value={ecg} icon={Activity} textValue status={ecgStatus} statusColor={ecg === 'Unknown' ? 'text-muted' : ecg === 'Normal' ? 'text-success' : 'text-warn'} />
      <MetricCard title="Steps" value={data.steps?.toLocaleString() ?? '—'} icon={Footprints} status={data.steps==null?'Connect Google Health':'Google Health · synced'} statusColor="text-muted" />
    </div>
  );
}
