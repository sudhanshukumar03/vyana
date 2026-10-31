import { useEffect, useState } from 'react';
import type { ECGBatch, ECGStream } from '../../../../shared/types/ecg';
import { apiJson } from '../services/api';
import { ecgCSV, ecgPath, ecgPoints, mergeECG } from '../services/ecg';

export function RecordedECG({ device, connected }: { device: string; connected: boolean }) {
  const [batches, setBatches] = useState<ECGBatch[]>([]);
  const [error, setError] = useState('');
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (paused) return;
    const controller = new AbortController();
    let cursor = 0;
    let busy = false;
    const update = async () => {
      if (busy || document.visibilityState === 'hidden') return;
      busy = true;
      setNow(Date.now());
      try {
        const stream = await apiJson<ECGStream>(
          `/ecg/stream?device=${encodeURIComponent(device)}${cursor ? `&after=${cursor}` : ''}`,
          { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) }
        );
        if (controller.signal.aborted) return;
        if (stream.device_id !== device) {
          setBatches([]);
          setError('Device selection changed. Waiting for the selected device.');
          return;
        }
        if (!cursor) setBatches(stream.batches);
        else setBatches((previous) => mergeECG(previous, stream.batches));
        cursor = stream.cursor;
        setError('');
        setNow(Date.now());
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error ? reason.message : 'Waveform could not be loaded. Retrying automatically.'
          );
        }
      } finally {
        busy = false;
      }
    };
    void update();
    const timer = window.setInterval(() => void update(), 1000);
    const wake = () => void update();
    document.addEventListener('visibilitychange', wake);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [device, paused]);

  const points = ecgPoints(batches, now);
  const path = ecgPath(points, now);
  const clipped = points.filter((point) => !point.leads && (point.raw <= 5 || point.raw >= 4090)).length;
  const hasTrace = connected && Boolean(path.trim());

  const download = () => {
    const url = URL.createObjectURL(new Blob([ecgCSV(points)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vyana-loaded-ecg-samples.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3" aria-label="Recorded ECG waveform">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <p className="text-xs text-slate-300 font-mono">
          {paused
            ? 'Paused display'
            : hasTrace
            ? 'Recorded ADC samples'
            : 'Waiting for fresh waveform samples'}{' '}
          · Raw input, rhythm unclassified
        </p>
        {points.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="px-3 py-1.5 rounded-xl font-mono text-xs font-semibold transition-all bg-white/10 hover:bg-white/15 text-white/90 border border-white/15 backdrop-blur-md shadow-xs"
              aria-pressed={paused}
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? 'Resume waveform' : 'Pause waveform'}
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-xl font-mono text-xs font-semibold transition-all bg-white/10 hover:bg-white/15 text-white/90 border border-white/15 backdrop-blur-md shadow-xs"
              onClick={download}
            >
              Export loaded ECG samples
            </button>
          </div>
        )}
      </div>

      {error && <p role="status" className="text-sm text-critical font-mono">{error}</p>}

      <div className="text-xs text-slate-400 font-mono flex justify-between">
        <span>{hasTrace ? '4095 ADC counts' : 'ADC Baseline (12-bit)'}</span>
        <span>{hasTrace ? `${points.length} samples loaded` : 'Standby Mode'}</span>
      </div>

      <div className="relative rounded-xl overflow-hidden border border-white/10 bg-[#060B14] p-1 shadow-inner">
        <svg
          viewBox="0 0 720 180"
          preserveAspectRatio="none"
          className="w-full h-44"
          role="img"
          aria-label="Recorded raw ECG input, 0 to 4095 ADC counts over the last four seconds. Gaps show missing samples or lead-off."
        >
          <defs>
            <pattern id="rec-ecg-grid-dark" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M24 0H0V24" fill="none" stroke="rgba(56, 189, 248, 0.08)" strokeWidth="0.75" />
            </pattern>
            <filter id="rec-cyan-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#38BDF8" floodOpacity="0.85" />
            </filter>
          </defs>
          <rect width="720" height="180" fill="url(#rec-ecg-grid-dark)" />
          <path d="M0 10H720 M0 90H720 M0 170H720" fill="none" stroke="rgba(56, 189, 248, 0.15)" />
          {hasTrace ? (
            <path d={path} fill="none" stroke="#38BDF8" strokeWidth="2.2" filter="url(#rec-cyan-glow)" />
          ) : (
            <path
              d="M0 90H720"
              fill="none"
              stroke="rgba(56, 189, 248, 0.35)"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />
          )}
        </svg>

        {!hasTrace && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 bg-[#060B14]/50 backdrop-blur-[1px]">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0A1322]/90 border border-white/10 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="font-mono text-xs font-semibold text-cyan-300 uppercase tracking-wide">
                Awaiting ECG Telemetry Samples
              </span>
            </div>
            <p className="font-mono text-[11px] text-slate-400 text-center mt-2 max-w-sm">
              ESP32 ADC stream online. Waveform will draw live as sample packets are uploaded.
            </p>
          </div>
        )}
      </div>

      <div className="text-xs text-slate-400 font-mono flex flex-wrap justify-between gap-2">
        <span>0 ADC · −4 seconds</span>
        <span>{hasTrace ? 'Latest' : 'Channel Ready'}</span>
      </div>

      {hasTrace ? (
        <p className="text-xs text-slate-400 leading-relaxed font-mono">
          {points.length} loaded samples · {clipped} clipped while leads attached. Last sample:{' '}
          {new Date(points.at(-1)!.time).toLocaleTimeString()}. Gaps are not interpolated. This raw input is not
          a calibrated clinical ECG.
        </p>
      ) : (
        <p className="text-xs text-slate-400 font-mono">
          Telemetry channel active. Connect AD8232 electrode leads to initiate cardiac signal acquisition.
        </p>
      )}

      {points.length > 0 && (
        <details>
          <summary className="text-sm cursor-pointer text-slate-300 font-mono">
            Inspect loaded sample values
          </summary>
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Loaded ECG sample values">
            <table>
              <caption className="text-sm text-slate-400">
                Latest 25 loaded samples; export includes all loaded samples.
              </caption>
              <thead>
                <tr>
                  <th>UTC time</th>
                  <th>Sequence</th>
                  <th>Raw ADC</th>
                  <th>Lead flags</th>
                </tr>
              </thead>
              <tbody>
                {points.slice(-25).map((point) => (
                  <tr key={`${point.session}:${point.sequence}`}>
                    <td>{new Date(point.time).toISOString()}</td>
                    <td>{point.sequence}</td>
                    <td>{point.raw}</td>
                    <td>{point.leads}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
