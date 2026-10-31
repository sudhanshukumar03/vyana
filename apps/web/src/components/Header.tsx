import {
  Bell,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { useHealthStore } from '../store/useHealthStore';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';

export function Header() {
  const { alerts, updateAlert, profile, user, isSocketConnected, isConnected } = useHealthStore();

  const activeAlerts = alerts.filter((alert) => alert.status === 'active');
  const unreadCount = activeAlerts.length;
  const hasCritical = activeAlerts.some((alert) => alert.severity === 'critical');
  const [open, setOpen] = useState(false);
  const [alertError, setAlertError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const dot = (severity: string) =>
    severity === 'critical' ? 'bg-critical' : severity === 'warning' ? 'bg-warn' : 'bg-success';
  const recent = alerts.slice(0, 6);

  const displayName = profile?.full_name?.trim() || (user?.email ? user.email.split('@')[0] : 'Patient');
  const userInitial = displayName.charAt(0).toUpperCase() || 'P';

  return (
    <header className="app-toolbar" aria-label="Toolbar">
      {/* Left: Calendar Date Chip */}
      <div className="toolbar-context">
        <div
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-line bg-surface text-xs font-medium text-slate-700 shadow-2xs"
          aria-label="Current date"
        >
          <Calendar className="w-3.5 h-3.5 text-brand shrink-0" aria-hidden="true" />
          <time dateTime={format(new Date(), 'yyyy-MM-dd')}>
            {format(new Date(), 'EEEE, d MMM yyyy')}
          </time>
        </div>
      </div>

      {/* Center: Live Hardware Telemetry Monitor */}
      <div className="toolbar-telemetry" aria-label="Hardware telemetry status">
        {isSocketConnected ? (
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold shadow-2xs"
            title="ESP32 hardware sensor telemetry streaming at 50Hz"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="font-mono">ESP32 50Hz</span>
            <span className="text-emerald-600 font-normal">· Live Stream</span>
          </div>
        ) : isConnected ? (
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs"
            title="Cloud synchronisation active"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-mono">Cloud Sync</span>
            <span className="text-slate-500 font-normal">· Active</span>
          </div>
        ) : (
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold shadow-2xs"
            title="Connecting to telemetry services..."
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Connecting...</span>
          </div>
        )}
      </div>

      {/* Right: Actions, Notifications & Patient Identity Pill */}
      <div className="toolbar-actions">
        {/* SOS Emergency Quick Trigger */}
        <Link
          to="/emergency"
          aria-label="SOS Emergency"
          onClick={() => {
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              try { navigator.vibrate(60); } catch { void 0; }
            }
          }}
          className="icon-button sos-shortcut"
        >
          <AlertTriangle aria-hidden="true" />
          <span>SOS</span>
        </Link>

        {/* Notifications Tray */}
        <div className="relative" ref={panelRef}>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={open ? 'notifications-panel' : undefined}
            aria-label={
              unreadCount
                ? `Notifications, ${unreadCount} active alert${unreadCount > 1 ? 's' : ''}`
                : 'Notifications, no active alerts'
            }
            className="icon-button relative"
          >
            <Bell aria-hidden="true" />
            {unreadCount > 0 && (
              <span
                className={`notification-dot ${hasCritical ? 'bg-critical' : 'bg-warn'}`}
                aria-hidden="true"
              />
            )}
          </button>
          {open && (
            <div
              id="notifications-panel"
              className="notification-panel"
              role="region"
              aria-label="Notifications"
            >
              <div className="px-4 py-3.5 border-b border-line flex items-center justify-between gap-3 bg-surface-soft/40">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-brand" />
                  <h2 className="text-sm font-bold text-ink">Notifications</h2>
                </div>
                <span className="text-[11px] font-semibold text-muted bg-surface px-2 py-0.5 rounded-md border border-line">
                  {unreadCount} active
                </span>
              </div>
              {alertError && <p role="alert" className="p-3 text-xs text-critical bg-critical-bg">{alertError}</p>}
              {recent.length === 0 ? (
                <p className="px-4 py-7 text-xs text-muted text-center">No active notifications.</p>
              ) : (
                recent.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 px-4 py-3.5 border-b border-line last:border-0 hover:bg-surface-soft/30 transition-colors"
                  >
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dot(alert.severity)}`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold leading-snug text-ink">{alert.title}</p>
                      <p className="text-[11px] text-muted mt-0.5 [overflow-wrap:anywhere] leading-relaxed">
                        {alert.detail}
                      </p>
                      <p className="text-[10px] text-muted/80 mt-1.5 font-mono">
                        {alert.timestamp ? format(new Date(alert.timestamp), 'MMM d, HH:mm') : ''}
                        {alert.status !== 'active' ? ' · resolved' : ''}
                      </p>
                      {alert.status === 'active' && (
                        <div className="flex flex-wrap gap-2 mt-2.5">
                          {!alert.acknowledged_at && (
                            <button
                              type="button"
                              className="ui-button secondary text-xs py-1 px-2.5"
                              onClick={() => {
                                setAlertError('');
                                void updateAlert(alert.id, 'acknowledge').catch(() =>
                                  setAlertError('Could not acknowledge. Please retry.')
                                );
                              }}
                            >
                              Acknowledge
                            </button>
                          )}
                          <button
                            type="button"
                            className="ui-button secondary text-xs py-1 px-2.5"
                            onClick={() => {
                              setAlertError('');
                              void updateAlert(alert.id, 'resolve').catch(() =>
                                setAlertError('Could not resolve. Please retry.')
                              );
                            }}
                          >
                            Resolve
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Executive Profile Pill */}
        <Link
          to="/profile"
          aria-label={`Your profile, ${displayName}`}
          className="toolbar-profile-pill group inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-line bg-surface hover:bg-surface-soft transition-colors shadow-2xs"
        >
          <div
            className="w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center font-bold text-xs shrink-0"
            aria-hidden="true"
          >
            {userInitial}
          </div>
          <span className="text-xs font-bold text-ink pr-1">{displayName}</span>
        </Link>
      </div>
    </header>
  );
}
