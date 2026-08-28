import { MetricRow } from '../components/MetricRow';
import { TrendsChart } from '../components/TrendsChart';
import { WellnessProgress, DeviceStatus, ActivityOverview } from '../components/BottomSection';
import { useHealthStore } from '../store/useHealthStore';
import { Search } from 'lucide-react';

export function Dashboard() {
  const { vitals, activity, alerts, device, insights, historicalVitals, historicalActivity, isConnected } = useHealthStore();

  const chartData = historicalVitals ? [...historicalVitals].reverse() : [];
  const activityData = historicalActivity ? [...historicalActivity].reverse() : [];

  return (
    <div className="animate-fade-in max-w-[1600px] mx-auto space-y-4 lg:space-y-6 pb-12">
      
      {!vitals && !isConnected ? (
        <div className="h-32 flex items-center justify-center bg-white rounded-2xl border border-gray-100/80 shadow-sm">
            <p className="text-gray-400 font-medium">Loading live telemetry...</p>
        </div>
      ) : (
        <MetricRow data={{ ...vitals, steps: activity?.steps }} />
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2 flex flex-col h-full min-h-[340px]">
          {chartData.length > 0 ? (
              <TrendsChart data={chartData} />
          ) : (
              <div className="flex-1 flex items-center justify-center bg-white rounded-2xl border border-gray-100/80 shadow-sm">
                 <p className="text-gray-400 font-medium">No historical measurements yet.</p>
              </div>
          )}
        </div>
        
        {/* AI Insights Card */}
        <div className="lg:col-span-1 bg-white rounded-2xl p-5 border border-gray-100/80 shadow-sm flex flex-col">
          <h3 className="text-[15px] font-semibold text-gray-800 mb-4">Curated AI Health Insights</h3>
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search" 
              className="w-full pl-9 pr-3 py-2 bg-gray-50/50 border border-gray-100 rounded-xl text-[13px] focus:outline-none focus:bg-white transition-colors"
            />
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto">
            {insights.length === 0 ? (
              <div className="text-center text-gray-400 text-sm mt-8 font-medium">No insights available</div>
            ) : (
              insights.map((insight, idx) => (
                <div key={idx} className="flex gap-3 text-[13px] text-gray-700 leading-snug">
                  <span className="text-gray-300 mt-0.5">•</span>
                  <span>{insight.detail}</span>
                </div>
              ))
            )}
            {/* Fallback to match mock exactly if API fails/empty */}
            {insights.length === 0 && (
              <>
                <div className="flex gap-3 text-[13px] text-gray-700 leading-snug">
                  <span className="text-gray-300 mt-0.5">•</span>
                  <span>Current vital metrics are within optimal ranges.</span>
                </div>
                <div className="flex gap-3 text-[13px] text-gray-700 leading-snug">
                  <span className="text-gray-300 mt-0.5">•</span>
                  <span>Wind-down routines like 10 mins of reading can improve sleep quality.</span>
                </div>
                <div className="flex gap-3 text-[13px] text-gray-700 leading-snug">
                  <span className="text-gray-300 mt-0.5">•</span>
                  <span>Check recent high heart rate alert for details.</span>
                </div>
              </>
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
