import { Bell, AlertTriangle, LogOut, UserRound } from 'lucide-react';
import { useHealthStore } from '../store/useHealthStore';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';

export function Header() {
  const { alerts, logout, updateAlert } = useHealthStore();
  const activeAlerts = alerts.filter(alert => alert.status === 'active');
  const unreadCount = activeAlerts.length;
  const hasCritical = activeAlerts.some(alert => alert.severity === 'critical');
  const [open, setOpen] = useState(false);
  const [alertError, setAlertError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onEsc = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);
  const dot = (severity: string) => severity === 'critical' ? 'bg-critical' : severity === 'warning' ? 'bg-warn' : 'bg-success';
  const recent = alerts.slice(0, 6);

  return (
    <header className="app-toolbar">
      <p className="toolbar-date"><time dateTime={format(new Date(), 'yyyy-MM-dd')}>{format(new Date(), 'EEE, d MMM yyyy')}</time></p>
      <div className="toolbar-actions">
        <Link to="/emergency" aria-label="SOS Emergency" className="icon-button sos-shortcut"><AlertTriangle aria-hidden="true" /><span>SOS</span></Link>
        <div className="relative" ref={panelRef}>
          <button type="button" onClick={() => setOpen(value => !value)} aria-haspopup="true" aria-expanded={open}
            aria-label={unreadCount ? `Notifications, ${unreadCount} active alert${unreadCount > 1 ? 's' : ''}` : 'Notifications, no active alerts'}
            className="icon-button relative">
            <Bell aria-hidden="true" />
            {unreadCount > 0 && <span className={`notification-dot ${hasCritical ? 'bg-critical' : 'bg-warn'}`} aria-hidden="true" />}
          </button>
          {open && (
            <div className="notification-panel" role="region" aria-label="Notifications">
              <div className="px-4 py-4 border-b border-line flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Notifications</h2><span className="text-xs text-muted">{unreadCount} active</span>
              </div>
              {alertError && <p role="alert" className="p-3 text-critical">{alertError}</p>}
              {recent.length === 0 ? <p className="px-4 py-6 text-sm text-muted text-center">No notifications yet.</p> : recent.map(alert => (
                <div key={alert.id} className="flex items-start gap-3 px-4 py-4 border-b border-line last:border-0">
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dot(alert.severity)}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">{alert.title}</p>
                    <p className="text-xs text-muted mt-1 [overflow-wrap:anywhere]">{alert.detail}</p>
                    <p className="text-xs text-muted mt-2">{alert.timestamp ? format(new Date(alert.timestamp), 'MMM d, HH:mm') : ''}{alert.status !== 'active' ? ' · resolved' : ''}</p>
                    {alert.status === 'active' && <div className="flex flex-wrap gap-2 mt-3">
                      {!alert.acknowledged_at && <button type="button" className="ui-button secondary" onClick={() => { setAlertError(''); void updateAlert(alert.id, 'acknowledge').catch(() => setAlertError('Could not acknowledge. Please retry.')); }}>Acknowledge</button>}
                      <button type="button" className="ui-button secondary" onClick={() => { setAlertError(''); void updateAlert(alert.id, 'resolve').catch(() => setAlertError('Could not resolve. Please retry.')); }}>Resolve</button>
                    </div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <Link to="/profile" aria-label="Your profile" className="icon-button profile-shortcut"><UserRound aria-hidden="true" /></Link>
        <button type="button" onClick={logout} aria-label="Sign out" className="icon-button"><LogOut aria-hidden="true" /></button>
      </div>
    </header>
  );
}
