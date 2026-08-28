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
}

function MetricCard({ title, value, unit, icon: Icon, sparkline, range, statusText, statusColor, valueColor = "text-gray-900" }: MetricCardProps) {
  return (
    <div className="bg-white rounded-[20px] p-6 shadow-sm border border-gray-200/60 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <Icon className="w-[18px] h-[18px] text-gray-600 fill-gray-600" strokeWidth={2} />
          <h3 className="text-[15px] font-bold text-gray-800">{title}</h3>
        </div>
        <div className="flex items-baseline gap-1 mb-2">
          <span className={`text-[32px] font-bold leading-none ${valueColor}`}>{value}</span>
          {unit && <span className="text-gray-600 font-bold text-sm">{unit}</span>}
        </div>
      </div>
      
      <div className="py-3 flex-1 flex items-center justify-center">
        {sparkline}
      </div>

      <div className="pt-2">
        {range && <p className="text-[11px] text-gray-400 font-medium mb-0.5">{range}</p>}
        <p className={`text-[12px] font-semibold ${statusColor}`}>{statusText}</p>
      </div>
    </div>
  );
}

export function MetricRow({ data }: { data: any }) {
  // SVG Sparkline placeholders matching the mockup style exactly
  const HRSparkline = (
    <svg viewBox="0 0 100 30" className="w-full h-8 stroke-gray-300" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M0 15 L20 15 L25 5 L30 25 L35 15 L50 15 L55 5 L60 25 L65 15 L80 15 L85 5 L90 25 L95 15 L100 15" />
    </svg>
  );

  const SpO2Sparkline = (
    <svg viewBox="0 0 100 30" className="w-full h-8 stroke-blue-400" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M0 15 Q 10 5, 20 15 T 40 15 T 60 15 T 80 15 T 100 15" />
    </svg>
  );

  const TempSparkline = (
    <svg viewBox="0 0 100 30" className="w-full h-8 stroke-gray-400" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M0 20 L20 20 L40 15 L60 18 L80 10 L100 15" />
    </svg>
  );

  const ECGSparkline = (
    <svg viewBox="0 0 100 30" className="w-full h-8 stroke-emerald-500" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M0 15 L20 15 L25 5 L30 25 L35 15 L50 15 L55 5 L60 25 L65 15 L80 15 L85 5 L90 25 L95 15 L100 15" />
    </svg>
  );

  const StepsSparkline = (
    <svg viewBox="0 0 100 30" className="w-full h-8" fill="none">
      <rect x="0" y="10" width="8" height="20" className="fill-gray-200" rx="2" />
      <rect x="15" y="15" width="8" height="15" className="fill-gray-200" rx="2" />
      <rect x="30" y="5" width="8" height="25" className="fill-gray-200" rx="2" />
      <rect x="45" y="12" width="8" height="18" className="fill-gray-200" rx="2" />
      <rect x="60" y="20" width="8" height="10" className="fill-gray-200" rx="2" />
      <rect x="75" y="8" width="8" height="22" className="fill-gray-200" rx="2" />
      <rect x="90" y="2" width="8" height="28" className="fill-gray-800" rx="2" />
    </svg>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 lg:gap-6 mb-6">
      <MetricCard 
        title="Heart Rate" 
        value={data?.heart_rate || '--'} 
        unit="bpm" 
        icon={Heart}
        sparkline={HRSparkline}
        range="Range: 60-90"
        statusText="Within normal range"
        statusColor="text-emerald-500"
      />
      <MetricCard 
        title="SpO₂" 
        value={data?.spo2 || '--'} 
        unit="%" 
        icon={Droplet}
        sparkline={SpO2Sparkline}
        range="Excellent"
        statusText="Within range"
        statusColor="text-emerald-500"
      />
      <MetricCard 
        title="Temp" 
        value={data?.temperature || '--'} 
        unit="°C" 
        icon={Thermometer}
        sparkline={TempSparkline}
        range=""
        statusText="Normal"
        statusColor="text-emerald-500"
      />
      <MetricCard 
        title="ECG" 
        value={data?.ecg_status || 'Normal'} 
        icon={Activity}
        sparkline={ECGSparkline}
        range=""
        statusText=""
        statusColor=""
        valueColor="text-emerald-500"
      />
      <MetricCard 
        title="Steps" 
        value={data?.steps || '--'} 
        unit="steps" 
        icon={Footprints}
        sparkline={StepsSparkline}
        range="Range: 3k-5k"
        statusText="Activity"
        statusColor="text-gray-500"
      />
    </div>
  );
}
