import { ShieldCheck, Battery, Watch, Heart, Droplet, Moon, Footprints, AlertCircle, Thermometer } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function WellnessProgress() {
  const score = 85;
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100/80 flex flex-col h-full">
      <h2 className="text-[15px] font-semibold text-gray-800 mb-6">Wellness Progress (Last 7 Days)</h2>
      
      <div className="flex flex-col items-center">
        <div className="relative w-28 h-28 flex items-center justify-center mb-6">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="56" cy="56" r="48" fill="transparent" stroke="#f3f4f6" strokeWidth="10" />
            <circle 
              cx="56" cy="56" r="48" fill="transparent" 
              stroke="#3b82f6" strokeWidth="10" 
              strokeDasharray={301.59} 
              strokeDashoffset={301.59 - (301.59 * score) / 100}
              className="transition-all duration-1000 ease-out"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[28px] font-bold text-gray-900 leading-none">{score}</span>
            <span className="text-[11px] font-medium text-gray-500 mt-1">Goal Achieved</span>
          </div>
        </div>

        <div className="w-full space-y-2.5">
          <div className="flex items-center justify-between text-[13px]">
            <div className="flex items-center gap-2"><Heart className="w-3.5 h-3.5 text-red-500 fill-red-500"/><span className="font-medium text-gray-700">Heart</span></div>
            <div><span className="font-semibold text-gray-900">72 / 100</span> <span className="text-gray-400">| Normal resting</span></div>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <div className="flex items-center gap-2"><Droplet className="w-3.5 h-3.5 text-blue-500 fill-blue-500"/><span className="font-medium text-gray-700">Oxygen</span></div>
            <div><span className="font-semibold text-gray-900">98%</span> <span className="text-gray-400">| (Avg 98%)</span></div>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <div className="flex items-center gap-2"><Moon className="w-3.5 h-3.5 text-indigo-500 fill-indigo-500"/><span className="font-medium text-gray-700">Sleep</span></div>
            <div><span className="font-semibold text-gray-900">7h 24m</span> <span className="text-gray-400">| (Avg 7h 24m)</span></div>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <div className="flex items-center gap-2"><Footprints className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500"/><span className="font-medium text-gray-700">Activity</span></div>
            <div><span className="font-semibold text-gray-900">3,246</span> <span className="text-gray-400">| (Avg 3,246 steps / 10k goal)</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ActivityOverview({ data }: { data: any[] }) {
  // Mock fallback for visually matching if data is empty
  const chartData = data?.length > 0 ? data : [
    { name: 'Mon', steps: 4000, spo2: 98, avg: 60 },
    { name: 'Tue', steps: 8000, spo2: 97, avg: 65 },
    { name: 'Wed', steps: 6000, spo2: 98, avg: 70 },
    { name: 'Thu', steps: 9000, spo2: 99, avg: 62 },
    { name: 'Fri', steps: 7000, spo2: 97, avg: 68 },
    { name: 'Sat', steps: 8500, spo2: 98, avg: 66 },
    { name: 'Sun', steps: 5000, spo2: 98, avg: 64 },
  ];

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100/80 flex flex-col h-full">
      <h2 className="text-[15px] font-semibold text-gray-800 mb-4">Activity Overview (This Week)</h2>
      
      <div className="flex justify-center items-center gap-4 text-[11px] font-medium text-gray-500 mb-2">
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"></div>Avg</div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div>SpO₂</div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-gray-300"></div>Steps</div>
      </div>

      <div className="flex-1 w-full min-h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }} barGap={2}>
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}/>
            <Bar dataKey="avg" fill="#3b82f6" radius={[2, 2, 0, 0]} maxBarSize={8} />
            <Bar dataKey="spo2" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={8} />
            <Bar dataKey="steps" fill="#d1d5db" radius={[2, 2, 0, 0]} maxBarSize={8} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-100">
        <div>
          <p className="text-[11px] text-gray-500 font-medium mb-0.5">Steps</p>
          <p className="text-[15px] font-bold text-gray-900">3,246 <span className="text-[10px] font-medium text-gray-400">ft</span></p>
        </div>
        <div>
          <p className="text-[11px] text-gray-500 font-medium mb-0.5">Distance</p>
          <p className="text-[15px] font-bold text-gray-900">33.2 <span className="text-[10px] font-medium text-gray-400">m</span></p>
        </div>
        <div>
          <p className="text-[11px] text-gray-500 font-medium mb-0.5">Calories</p>
          <p className="text-[15px] font-bold text-gray-900">3,246 <span className="text-[10px] font-medium text-gray-400">ave</span></p>
        </div>
      </div>
    </div>
  );
}

export function DeviceStatus({ alerts, device }: { alerts?: any[], device?: any }) {
  const displayAlerts = alerts?.length ? alerts.slice(0, 3) : [
    { title: 'High Heart Rate', time: '10:24 AM', status: 'Resolved', type: 'critical' },
    { title: 'Low SpO₂', time: '11:15 PM', status: 'Resolved', type: 'info' },
    { title: 'High Temp', time: '8:30 PM', status: 'Resolved', type: 'warning' },
  ];

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100/80 flex flex-col h-full">
      <div className="grid grid-cols-2 gap-4 h-full">
        <div className="flex flex-col border-r border-gray-100 pr-4">
          <h2 className="text-[13px] font-semibold text-gray-800 mb-4">Recent Alerts</h2>
          <div className="flex-1 space-y-4">
            {displayAlerts.map((alert, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`p-1.5 rounded-full mt-0.5 ${
                  alert.type === 'critical' || alert.severity === 'critical' ? 'bg-red-50 text-red-500' : 
                  alert.type === 'warning' || alert.severity === 'warning' ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500'
                }`}>
                  {alert.type === 'critical' || alert.severity === 'critical' ? <Heart className="w-3.5 h-3.5" /> : 
                   alert.type === 'warning' || alert.severity === 'warning' ? <Thermometer className="w-3.5 h-3.5" /> : <Droplet className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-gray-800 leading-tight">{alert.title}</p>
                  <p className="text-[11px] font-medium text-gray-400 mt-0.5">{alert.time || new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="ml-auto">
                  <span className="text-[10px] font-medium text-gray-400">Resolved</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col pl-2">
          <h2 className="text-[13px] font-semibold text-gray-800 mb-4">Device Status</h2>
          <div className="flex-1 bg-gray-50/50 rounded-xl p-4 border border-gray-100 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-black rounded-xl mb-3 flex items-center justify-center shadow-inner relative overflow-hidden">
               <div className="absolute inset-2 rounded-full border-4 border-emerald-500"></div>
               <div className="absolute inset-3 rounded-full border-4 border-blue-500"></div>
               <div className="absolute inset-4 rounded-full border-4 border-red-500"></div>
            </div>
            <p className="text-[13px] font-bold text-gray-900 leading-tight">HealthGuard</p>
            <p className="text-[11px] text-gray-500 font-medium mb-1">Band (Apple Watch S10)</p>
            <p className="text-[11px] font-bold text-emerald-500 mb-0.5">Connected</p>
            <p className="text-[11px] font-medium text-gray-600">Battery: {device?.batteryLevel || 85}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
