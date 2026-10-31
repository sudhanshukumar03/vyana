import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ShieldAlert, CheckCircle2, Radio, ArrowRight } from 'lucide-react';
import type { ManualSosResult, SosOverview } from '../../../../shared/types/sos';
import { apiJson } from '../services/api';
import { sosNotificationLabel } from '../services/sos';
import { useHealthStore } from '../store/useHealthStore';

export function ManualSosPanel() {
  const triggerSos = useHealthStore((state) => state.triggerSos);
  const [phase, setPhase] = useState<'idle' | 'confirm' | 'sending' | 'recorded' | 'error'>('idle');
  const [overview, setOverview] = useState<SosOverview | null>(null);
  const [result, setResult] = useState<ManualSosResult | null>(null);
  const [error, setError] = useState('');
  const [statusError, setStatusError] = useState('');
  const inFlight = useRef(false);
  const requestId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let fetching = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const value = await apiJson<SosOverview>('/sos', { signal: controller.signal });
        if (active) {
          setOverview(value);
          setStatusError('');
        }
      } catch {
        if (active) setStatusError('SOS delivery status is unavailable. No delivery is confirmed.');
      } finally {
        fetching = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  const confirm = async () => {
    if (inFlight.current) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([200, 100, 200, 100, 300]); } catch { void 0; }
    }
    inFlight.current = true;
    requestId.current ??= crypto.randomUUID();
    setPhase('sending');
    setError('');
    try {
      const value = await triggerSos('Triggered from the Emergency panel', requestId.current);
      if (value) {
        setResult(value);
        setPhase('recorded');
      } else {
        setError(useHealthStore.getState().error || 'SOS could not be recorded.');
        setPhase('error');
      }
    } finally {
      inFlight.current = false;
    }
  };

  const incident = overview?.incidents.find((item) => item.id === result?.sos_incident_id);
  const sharing = overview?.preferences.sharing_enabled;
  const recipients = overview?.preferences.emergency_contact_ids.length ?? 0;
  const services =
    overview &&
    (['email', 'sms', 'call'] as const).some(
      (channel) => overview.preferences[`${channel}_enabled`] && overview.capabilities[channel]
    );
  const setupComplete = Boolean(sharing && recipients && services);

  const reset = () => {
    requestId.current = null;
    setResult(null);
    setError('');
    setPhase('idle');
  };

  return (
    <section
      className="surface p-3.5 sm:p-4 space-y-3 rounded-xl border border-line bg-surface shadow-2xs"
      aria-labelledby="manual-sos-title"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2.5 border-b border-line">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="p-1 rounded-md bg-rose-500/10 text-rose-600 border border-rose-500/20">
              <ShieldAlert className="w-4 h-4" aria-hidden="true" />
            </span>
            <h2 id="manual-sos-title" className="text-base font-bold text-ink">
              Emergency SOS
            </h2>
          </div>
          <p className="text-[11px] text-muted">
            Record an in-app emergency alert, broadcast vital telemetry, and trigger configured caregiver dispatches.
          </p>
        </div>

        <Link
          to="/settings#sos-settings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline shrink-0"
        >
          <span>SOS Preferences</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Readiness Status Box */}
      <div
        role="status"
        className={`rounded-xl border p-2.5 sm:p-3 text-xs leading-normal flex items-start gap-2.5 shadow-2xs ${
          setupComplete
            ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
            : 'bg-amber-50 border-amber-200 text-amber-950'
        }`}
      >
        <div className={`p-1 rounded-md shrink-0 mt-0.5 border ${
          setupComplete
            ? 'bg-emerald-100 border-emerald-200 text-emerald-700'
            : 'bg-amber-100 border-amber-200 text-amber-800'
        }`}>
          {setupComplete ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5" />
          )}
        </div>
        <div className="flex-1 space-y-0.5">
          <p className="font-bold text-ink text-xs">
            {setupComplete ? 'Emergency notification network active' : 'Emergency setup needs attention'}
          </p>
          <p className="text-body text-[11px] leading-relaxed">
            {!overview
              ? 'Verifying notification dispatch configuration…'
              : !sharing
              ? 'Contact notifications are disabled in settings. SOS will record an in-app incident only.'
              : !recipients
              ? 'No emergency contacts selected. SOS will record an in-app alert only.'
              : !services
              ? 'External SMS/Call sending services are not configured. Notifications will remain local.'
              : 'Contact notifications enabled. Incident reports, GPS coordinates, and latest vitals will be queued.'}
          </p>
          {!setupComplete && (
            <Link
              to="/settings#sos-settings"
              className="inline-flex items-center gap-1 mt-1.5 text-xs font-bold text-brand hover:underline"
            >
              <span>Configure emergency recipients &amp; gateways</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {statusError && <p role="status" className="text-xs text-amber-600 font-medium">{statusError}</p>}
      {error && (
        <p role="alert" className="text-xs text-rose-600 font-medium bg-rose-50 p-3 rounded-xl border border-rose-200">
          {error} Retry preserves the same request ID to avoid duplicate alerts.
        </p>
      )}

      {/* Interactive Trigger States */}
      {phase === 'recorded' && result ? (
        <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2.5" role="status">
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <h3 className="font-bold text-base text-emerald-900">SOS recorded</h3>
          </div>
          <p className="text-sm text-emerald-900 leading-relaxed">
            {result.delivery_status === 'recorded'
              ? 'Incident saved to timeline. No external notifications were queued due to settings.'
              : result.delivery_status === 'setup_required'
              ? 'Emergency event registered. Gateway setup is required before outbound calls or SMS can transmit.'
              : 'Emergency dispatch triggered! Incident details and vital telemetry have been dispatched.'}
          </p>
          {incident?.notifications && incident.notifications.length > 0 && (
            <div className="bg-white/80 rounded-xl p-3 border border-emerald-100 space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1">Queued Dispatches</p>
              {incident.notifications.map((job) => (
                <div key={job.id} className="text-xs text-slate-700 flex items-center justify-between">
                  <span className="font-semibold">{job.contact_name}</span>
                  <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                    {job.channel.toUpperCase()} · {sosNotificationLabel(job, overview!.capabilities)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-3 pt-2">
            <Link to="/settings#sos-settings" className="ui-button secondary text-xs">
              View SOS Audit Log
            </Link>
            <button type="button" className="ui-button primary text-xs" onClick={reset}>
              Acknowledge &amp; Reset SOS
            </button>
          </div>
        </div>
      ) : phase === 'confirm' || phase === 'sending' ? (
        <div className="p-3.5 sm:p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2.5">
          <div className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h3 className="font-bold text-base text-rose-900">Confirm Emergency SOS Dispatch</h3>
          </div>
          <p className="text-xs sm:text-sm text-rose-950 leading-relaxed">
            {setupComplete
              ? 'Are you sure you want to broadcast an emergency alert? This will immediately notify your designated caregivers and emergency contacts.'
              : 'Confirm to record an emergency alert in your health log. Note: external contact gateway setup is incomplete.'}
          </p>
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-surface hover:bg-surface-soft border border-line text-ink transition-colors"
              disabled={phase === 'sending'}
              onClick={() => setPhase('idle')}
            >
              Cancel
            </button>
            <button
              type="button"
              aria-label="Confirm SOS request"
              className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs shadow-rose-600/20 transition-all flex items-center gap-2"
              disabled={phase === 'sending'}
              onClick={() => void confirm()}
            >
              <Radio className={`w-3.5 h-3.5 ${phase === 'sending' ? 'animate-spin' : ''}`} />
              <span>{phase === 'sending' ? 'Transmitting SOS…' : 'Confirm SOS request'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* The Big Bold SOS Dial */
        <div className="flex flex-col items-center justify-center py-2 sm:py-3 text-center">
          <div className="relative flex items-center justify-center group mb-2">
            {/* Pulsing halo */}
            <span className="absolute w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-rose-500/20 animate-ping pointer-events-none duration-1000" />
            <span className="absolute w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-rose-500/10 pointer-events-none" />

            <button
              type="button"
              aria-label="Trigger Emergency SOS"
              onClick={() => {
                if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                  try { navigator.vibrate([120, 60, 120]); } catch { void 0; }
                }
                setPhase('confirm');
              }}
              className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-rose-700 via-rose-600 to-rose-500 text-white font-extrabold text-lg sm:text-xl tracking-wider flex flex-col items-center justify-center gap-0.5 shadow-md shadow-rose-600/30 hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-500/40 cursor-pointer"
            >
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
              <span>SOS</span>
            </button>
          </div>

          <p className="text-xs font-semibold text-ink">
            Press the red SOS button to begin emergency triage broadcast.
          </p>
          <p className="text-[11px] text-muted mt-0.5">Requires confirmation on next step to avoid accidental triggering.</p>
        </div>
      )}
    </section>
  );
}
