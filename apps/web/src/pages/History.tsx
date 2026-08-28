import { useHealthStore } from '../store/useHealthStore';
import { Clock } from 'lucide-react';

export default function History() {
  const { historicalVitals } = useHealthStore();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <Clock className="w-8 h-8 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Vitals History</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-sm font-medium text-gray-500 uppercase tracking-wider">
                <th className="p-4">Timestamp</th>
                <th className="p-4">Heart Rate (bpm)</th>
                <th className="p-4">SpO2 (%)</th>
                <th className="p-4">Temperature (°C)</th>
                <th className="p-4">ECG Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {historicalVitals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    No history data available
                  </td>
                </tr>
              ) : (
                historicalVitals.map((v, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-sm text-gray-900">
                      {new Date(v.timestamp).toLocaleString()}
                    </td>
                    <td className="p-4 text-sm font-medium text-gray-900">
                      <span className={v.heart_rate > 100 || v.heart_rate < 50 ? 'text-red-500' : ''}>
                        {v.heart_rate}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-900">
                      <span className={v.spo2 < 95 ? 'text-red-500 font-medium' : ''}>
                        {v.spo2}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-900">
                      {v.temperature.toFixed(1)}
                    </td>
                    <td className="p-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        v.ecg_status === 'normal' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {v.ecg_status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
