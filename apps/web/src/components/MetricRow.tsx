import type { Vitals } from '../store/useHealthStore';
import { Heart, Droplet, Thermometer, Activity, Footprints } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ElementType;
  sparkline: React.ReactNode;
  range: string;
  statusText: string;
  statusColor: string;
  valueColor?: string;
  iconColor?: string;
  critical?: boolean;
}

function MetricCard({ title, value, unit, icon: Icon, sparkline, range, statusText, statusColor, valueColor = 'text-ink', iconColor = 'text-muted', critical = false }: MetricCardProps) {
  return (
    <div className={`rounded-2xl p-5 border flex flex-col justify-between ${critical ? 'bg-critical-bg border-critical' : 'bg-surface border-line'}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-medium text-muted">{title}</h3>
        <Icon className={`w-4 h-4 ${iconColor}`} strokeWidth={2} />
      </div>
      <div className="flex items-baseline gap-1.5 mt-3">
        <span className={`text-[38px] leading-none font-semibold tabular-nums ${valueColor}`}>{value}</span>
        {unit && <span className="text-muted font-medium text-[13px]">{unit}</span>}
      </div>
      <div className="py-3 flex-1 flex items-end">{sparkline}</div>
      <div className="pt-3 border-t border-line">
        {range && <p className="text-[12px] text-muted mb-0.5">{range}</p>}
        {statusText && <p className={`text-[12px] font-medium ${statusColor}`}>{statusText}</p>}
      </div>
    </div>
  );
}

export function MetricRow({ data }: { data: Partial<Vitals> & { steps?: number } }) {
  const HRSparkline = (
    <svg viewBox="0 0 100 30" className="w-full h-7 stroke-brand" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M0 15 L20 15 L25 5 L30 25 L35 15 L50 15 L55 5 L60 25 L65 15 L80 15 L85 5 L90 25 L95 15 L100 15" />
    </svg>
  );
  const SpO2Sparkline = (
    <svg viewBox="0 0 100 30" className="w-full h-7 stroke-muted" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M0 15 Q 10 5, 20 15 T 40 15 T 60 15 T 80 15 T 100 15" />
    </svg>
  );
  const TempSparkline = (
    <svg viewBox="0 0 100 30" className="w-full h-7 stroke-muted" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M0 20 L20 20 L40 15 L60 18 L80 10 L100 15" />
    </svg>
  );
  const ECGSparkline = (
    <svg viewBox="0 0 100 30" className="w-full h-7 stroke-brand" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M0 15 L20 15 L25 5 L30 25 L35 15 L50 15 L55 5 L60 25 L65 15 L80 15 L85 5 L90 25 L95 15 L100 15" />
    </svg>
  );
  const StepsSparkline = (
    <svg viewBox="0 0 100 30" className="w-full h-7" fill="none">
      {[10, 15, 5, 12, 20, 8, 2].map((y, i) => (
        <rect key={i} x={i * 15} y={y} width="8" height={30 - y} className={i === 6 ? 'fill-brand' : 'fill-line'} rx="2" />
      ))}
    </svg>
  );

  const hr = data?.heart_rate;
  const spo2 = data?.spo2;
  const temp = data?.temperature;

  const hrStatus =
    hr == null ? { t: 'No data', c: 'text-muted' }
    : hr > 150 || hr < 40 ? { t: 'Critical', c: 'text-critical' }
    : hr > 120 ? { t: 'Elevated', c: 'text-warn' }
    : hr < 45 ? { t: 'Low', c: 'text-warn' }
    : { t: 'Within range', c: 'text-success' };

  const spo2Status =
    spo2 == null ? { t: 'No data', c: 'text-muted' }
    : spo2 < 88 ? { t: 'Critical', c: 'text-critical' }
    : spo2 < 92 ? { t: 'Low', c: 'text-warn' }
    : { t: 'Within range', c: 'text-success' };

  const tempStatus =
    temp == null ? { t: 'No data', c: 'text-muted' }
    : temp > 39.5 ? { t: 'High fever', c: 'text-critical' }
    : temp > 38.0 ? { t: 'Fever', c: 'text-warn' }
    : temp < 35.0 ? { t: 'Low', c: 'text-warn' }
    : { t: 'Normal', c: 'text-success' };

  const ecgVal = data?.ecg_status ?? 'Unknown';
  const ecgOk = ecgVal === 'Normal';

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
      <MetricCard title="Heart Rate" value={hr ?? '--'} unit="bpm" icon={Heart} sparkline={HRSparkline}
        range="Range 60–90" statusText={hrStatus.t} statusColor={hrStatus.c}
        valueColor={hrStatus.c === 'text-critical' ? 'text-critical' : 'text-ink'} iconColor="text-brand"
        critical={hrStatus.c === 'text-critical'} />
      <MetricCard title="SpO₂" value={spo2 ?? '--'} unit="%" icon={Droplet} sparkline={SpO2Sparkline}
        range="Range 95–100%" statusText={spo2Status.t} statusColor={spo2Status.c}
        valueColor={spo2Status.c === 'text-critical' ? 'text-critical' : 'text-ink'}
        critical={spo2Status.c === 'text-critical'} />
      <MetricCard title="Temp" value={temp ?? '--'} unit="°C" icon={Thermometer} sparkline={TempSparkline}
        range="Range 36–37.5°C" statusText={tempStatus.t} statusColor={tempStatus.c}
        valueColor={tempStatus.c === 'text-critical' ? 'text-critical' : 'text-ink'}
        critical={tempStatus.c === 'text-critical'} />
      <MetricCard title="ECG" value={ecgVal} icon={Activity} sparkline={ECGSparkline}
        range="" statusText={ecgVal === 'Unknown' ? 'No current data' : ecgOk ? 'Reported normal' : ecgVal} statusColor={ecgOk ? 'text-success' : 'text-warn'}
        valueColor={ecgOk ? 'text-ink' : 'text-warn'} />
      <MetricCard title="Steps" value={data?.steps ?? '--'} unit="steps" icon={Footprints} sparkline={StepsSparkline}
        range="Daily goal 10k" statusText="Activity" statusColor="text-muted" />
    </div>
  );
}
