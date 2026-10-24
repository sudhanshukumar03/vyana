import { useHealthStore } from '../store/useHealthStore';
import { Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiJson } from '../services/api';
import { mergeHistory } from '../store/useHealthStore';
import type { VitalReading } from '../../../../shared/types/health';

export default function History() {
  const owner = useHealthStore(state => state.user?.id);
  const device = useHealthStore(state => state.device?.id);
  return <HistoryPages key={`${owner}:${device}`} />;
}

function HistoryPages() {
  const historicalVitals = useHealthStore(state => state.historicalVitals);
  const [rows, setRows] = useState<VitalReading[]>([]);
  const [cursors, setCursors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const cursor = cursors.at(-1);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    void apiJson<VitalReading[]>(`/vitals/trends?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setRows(data); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'History could not be loaded.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [cursor, retry]);
  useEffect(() => {
    if (!cursor) setRows(previous => mergeHistory(previous, historicalVitals, 100));
  }, [historicalVitals, cursor]);
  const oldest = rows[0];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <Clock className="w-8 h-8 text-brand" />
        <h1 className="text-2xl font-bold text-gray-900">Vitals History</h1>
      </div>

      <div className="flex flex-wrap items-center gap-3" aria-label="History pages">
        <button className="px-4 py-2 border rounded-lg disabled:opacity-50" disabled={loading || !cursors.length}
          onClick={() => setCursors(previous => previous.slice(0, -1))}>Newer readings</button>
        <span role="status">{loading ? 'Loading history…' : `Page ${cursors.length + 1} · ${rows.length} readings`}</span>
        <button className="px-4 py-2 border rounded-lg disabled:opacity-50" disabled={loading || Boolean(error) || rows.length < 100}
          onClick={() => oldest && setCursors(previous => [...previous, `${oldest.observed_at}|${oldest.id}`])}>Older readings</button>
      </div>
      {error && <div role="alert" className="text-critical">{error} <button className="underline px-3 py-2" onClick={() => setRetry(value => value + 1)}>Retry</button></div>}

      <div aria-busy={loading} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
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
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    No history data available
                  </td>
                </tr>
              ) : (
                [...rows].reverse().map(v => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-sm text-gray-900">
                      {new Date(v.timestamp).toLocaleString()}
                    </td>
                    <td className="p-4 text-sm font-medium text-gray-900">
                      <span className={v.heart_rate > 150 || v.heart_rate < 40 ? 'text-critical' : ''}>
                        {v.heart_rate}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-900">
                      <span className={v.spo2 < 88 ? 'text-critical font-medium' : ''}>
                        {v.spo2}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-900">
                      {v.temperature.toFixed(1)}
                    </td>
                    <td className="p-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        v.ecg_status === 'Normal' ? 'bg-success-bg text-success' : 'bg-warn-bg text-warn'
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
