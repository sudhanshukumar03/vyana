import { useHealthStore } from '../store/useHealthStore';
import { Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiJson } from '../services/api';
import { mergeHistory } from '../store/useHealthStore';
import type { VitalReading } from '../../../../shared/types/health';
import { PageHeader } from '../components/PageHeader';

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
    <div className="page-stack">
      <PageHeader title="Vitals History" description="Browse your saved readings, from the newest observations to earlier records." icon={Clock} />

      <div className="table-toolbar" aria-label="History pages">
        <button className="ui-button secondary" disabled={loading || !cursors.length}
          onClick={() => setCursors(previous => previous.slice(0, -1))}>Newer readings</button>
        <span role="status">{loading ? 'Loading history…' : `Page ${cursors.length + 1} · ${rows.length} readings`}</span>
        <button className="ui-button secondary" disabled={loading || Boolean(error) || rows.length < 100}
          onClick={() => oldest && setCursors(previous => [...previous, `${oldest.observed_at}|${oldest.id}`])}>Older readings</button>
      </div>
      {error && <div role="alert" className="text-critical">{error} <button className="underline px-3 py-2" onClick={() => setRetry(value => value + 1)}>Retry</button></div>}

      <p className="table-hint">Scroll the table to see all measurements.</p>

      <div aria-busy={loading} className="surface table-surface">
        <div className="table-scroll" tabIndex={0} aria-label="Vitals history table">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Heart Rate (bpm)</th>
                <th className="p-4">SpO2 (%)</th>
                <th className="p-4">Temperature (°C)</th>
                <th className="p-4">ECG Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted">
                    No history data available
                  </td>
                </tr>
              ) : (
                [...rows].reverse().map(v => (
                  <tr key={v.id} className="hover:bg-canvas transition-colors">
                    <td className="p-4 text-sm text-ink">
                      {new Date(v.timestamp).toLocaleString()}
                    </td>
                    <td className="p-4 text-sm font-medium text-ink">
                      <span className={v.heart_rate > 150 || v.heart_rate < 40 ? 'text-critical' : ''}>
                        {v.heart_rate}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-ink">
                      <span className={v.spo2 < 88 ? 'text-critical font-medium' : ''}>
                        {v.spo2}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-ink">
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
