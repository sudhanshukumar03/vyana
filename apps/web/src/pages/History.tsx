import {EquipmentHistory} from '../components/EquipmentHistory';
import { useHealthStore } from '../store/useHealthStore';
import { isGeneratedSource, readingSourceLabel } from '../services/equipment';
import { Clock, Download, Filter } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
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
  const [filterAbnormal, setFilterAbnormal] = useState(false);
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

  const stats = useMemo(() => {
    if (!rows.length) return null;
    let sumHr = 0, sumSpo2 = 0, minHr = Infinity, maxHr = -Infinity, abnormal = 0;
    for (const r of rows) {
      sumHr += r.heart_rate;
      sumSpo2 += r.spo2;
      if (r.heart_rate < minHr) minHr = r.heart_rate;
      if (r.heart_rate > maxHr) maxHr = r.heart_rate;
      if (
        r.heart_rate > 100 ||
        r.heart_rate < 50 ||
        r.spo2 < 95 ||
        r.temperature > 37.8 ||
        r.temperature < 35.5 ||
        r.ecg_status !== 'Normal'
      ) {
        abnormal++;
      }
    }
    return {
      count: rows.length,
      avgHr: Math.round(sumHr / rows.length),
      minHr: Number.isFinite(minHr) ? minHr : 0,
      maxHr: Number.isFinite(maxHr) ? maxHr : 0,
      avgSpo2: Math.round(sumSpo2 / rows.length),
      abnormal,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!filterAbnormal) return rows;
    return rows.filter(r =>
      r.heart_rate > 100 || r.heart_rate < 50 ||
      r.spo2 < 95 ||
      r.temperature > 37.8 || r.temperature < 35.5 ||
      r.ecg_status !== 'Normal'
    );
  }, [rows, filterAbnormal]);

  const exportCsv = () => {
    if (!rows.length) return;
    const headers = ['Timestamp', 'Heart Rate (bpm)', 'SpO2 (%)', 'Temperature (°C)', 'ECG Status', 'Source'];
    const lines = [
      headers.join(','),
      ...rows.map(r => [
        `"${new Date(r.timestamp).toISOString()}"`,
        r.heart_rate,
        r.spo2,
        r.temperature.toFixed(1),
        `"${r.ecg_status}"`,
        `"${isGeneratedSource(r.source)?'Simulated':'Recorded'}: ${r.source.replaceAll('"','""')}"`
      ].join(','))
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vyana-vitals-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const ecgBadge = (status: string) => {
    if (status === 'Normal') return 'bg-emerald-50 text-emerald-700 border-emerald-200/70 font-semibold';
    if (status === 'Irregular') return 'bg-rose-50 text-rose-700 border-rose-200/70 font-bold';
    return 'bg-amber-50 text-amber-800 border-amber-200/70';
  };

  return (
    <div className="page-stack max-w-6xl mx-auto w-full space-y-6">
      <PageHeader
        title="History"
        description="Browse your saved readings, from the newest observations to earlier records."
        icon={Clock}
        action={
          <button
            type="button"
            onClick={exportCsv}
            disabled={!rows.length}
            className="ui-button secondary text-xs"
            aria-label="Export loaded rows to CSV"
          >
            <Download className="w-4 h-4" /> Export loaded rows
          </button>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="surface p-4 rounded-2xl border border-line bg-surface shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
              Readings Logged
            </span>
            <div className="flex items-baseline gap-1.5">
              <strong className="text-xl font-bold font-mono text-ink">{stats.count}</strong>
              <span className="text-xs text-muted">records</span>
            </div>
            <p className="text-[11px] text-muted mt-1">Current page window</p>
          </div>

          <div className="surface p-4 rounded-2xl border border-line bg-surface shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
              Heart Rate Range
            </span>
            <div className="flex items-baseline gap-1.5">
              <strong className="text-xl font-bold font-mono text-ink">{stats.minHr}–{stats.maxHr}</strong>
              <span className="text-xs text-muted">bpm</span>
            </div>
            <p className="text-[11px] text-muted mt-1">Avg: {stats.avgHr} bpm</p>
          </div>

          <div className="surface p-4 rounded-2xl border border-line bg-surface shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
              Average SpO₂
            </span>
            <div className="flex items-baseline gap-1.5">
              <strong className="text-xl font-bold font-mono text-ink">{stats.avgSpo2}%</strong>
              <span className="text-xs text-muted">capillary</span>
            </div>
            <p className="text-[11px] text-muted mt-1">{stats.avgSpo2 >= 95 ? 'Normoxic range' : 'Review needed'}</p>
          </div>

          <div className="surface p-4 rounded-2xl border border-line bg-surface shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
              Triage Flagged
            </span>
            <div className="flex items-baseline gap-1.5">
              <strong className={`text-xl font-bold font-mono ${stats.abnormal > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {stats.abnormal}
              </strong>
              <span className="text-xs text-muted">observations</span>
            </div>
            <p className="text-[11px] text-muted mt-1">
              {stats.abnormal > 0 ? 'Abnormal parameters found' : 'All parameters normal'}
            </p>
          </div>
        </div>
      )}

      <div className="table-toolbar flex items-center justify-between flex-wrap gap-3" aria-label="History pages">
        <div className="flex items-center gap-2">
          <button
            className="ui-button secondary text-xs"
            disabled={loading || !cursors.length}
            onClick={() => setCursors(previous => previous.slice(0, -1))}
          >
            Newer readings
          </button>
          <button
            className="ui-button secondary text-xs"
            disabled={loading || Boolean(error) || rows.length < 100}
            onClick={() => oldest && setCursors(previous => [...previous, `${oldest.observed_at}|${oldest.id}`])}
          >
            Older readings
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setFilterAbnormal(v => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-2xs ${
              filterAbnormal
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-surface border-line text-muted hover:text-ink hover:bg-surface-soft'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            {filterAbnormal ? `Showing abnormal only (${filteredRows.length})` : 'Filter abnormal'}
          </button>
          <span role="status" className="text-xs font-semibold text-slate-600 bg-surface-soft px-3 py-1.5 rounded-xl border border-line">
            {loading ? 'Loading history…' : `Page ${cursors.length+1} · ${filteredRows.length} readings`}
          </span>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3.5 rounded-2xl bg-critical-bg border border-critical/30 text-critical text-sm flex items-center justify-between">
          <span>{error}</span>
          <button className="underline font-semibold ml-3" onClick={() => setRetry(value => value + 1)}>Retry</button>
        </div>
      )}

      <div aria-busy={loading} className="surface rounded-2xl border border-line bg-surface shadow-xs overflow-hidden">
        <div className="table-scroll overflow-x-auto" tabIndex={0} aria-label="Vitals history table">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-soft/60 border-b border-line text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th scope="col" className="px-4 py-3">Timestamp</th>
                <th scope="col" className="px-4 py-3">Heart Rate (bpm)</th>
                <th scope="col" className="px-4 py-3">SpO2 (%)</th>
                <th scope="col" className="px-4 py-3">Temperature (°C)</th>
                <th scope="col" className="px-4 py-3">ECG Status</th>
                <th scope="col" className="px-4 py-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted">
                    {filterAbnormal ? 'No abnormal readings found in this page.' : 'No history data available'}
                  </td>
                </tr>
              ) : (
                [...filteredRows].reverse().map(v => (
                  <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 text-ink whitespace-nowrap font-mono text-[11.5px]">
                      {new Date(v.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-ink">
                      <span className={v.heart_rate > 120 || v.heart_rate < 45 ? 'text-critical font-bold' : ''}>
                        {v.heart_rate}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-ink">
                      <span className={v.spo2 < 90 ? 'text-critical font-bold' : v.spo2 < 95 ? 'text-warn font-semibold' : ''}>
                        {v.spo2}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-ink">
                      <span className={v.temperature > 38 ? 'text-warn font-semibold' : ''}>
                        {v.temperature.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${ecgBadge(v.ecg_status)}`}>
                        {v.ecg_status}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-sm ${isGeneratedSource(v.source)?'text-warn':'text-muted'}`}>
                      {isGeneratedSource(v.source)?'Simulated · not measured':readingSourceLabel(v.source)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <EquipmentHistory/>
    </div>
  );
}
