import { Bell, AlertTriangle, LogOut } from 'lucide-react';
import { useHealthStore } from '../store/useHealthStore';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';

export function Header() {
  const { alerts, logout, updateAlert } = useHealthStore();
  const activeAlerts = alerts.filter((a) => a.status === 'active');
  const unreadCount = activeAlerts.length;
  const hasCritical = activeAlerts.some((a) => a.severity === 'critical');

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const [open, setOpen] = useState(false);
  const [alertError, setAlertError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const dot = (sev: string) => (sev === 'critical' ? 'bg-critical' : sev === 'warning' ? 'bg-warn' : 'bg-success');
  const recent = alerts.slice(0, 6);

  return (
    <header className="bg-transparent px-4 lg:px-8 pt-5 pb-4 lg:h-[120px] lg:pt-0 lg:pb-6 flex items-end justify-between shrink-0">
      <div className="flex flex-col">
        <h1 className="font-display text-2xl sm:text-3xl lg:text-[40px] font-semibold text-ink leading-tight tracking-tight">{greeting}.</h1>
        <p className="text-sm lg:text-[15px] text-slate font-medium mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <Link
          to="/emergency"
          aria-label="SOS Emergency"
          className="flex items-center gap-1.5 bg-critical/10 text-critical hover:bg-critical/20 text-[13px] font-semibold px-3 py-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <AlertTriangle className="w-4 h-4" /> <span className="hidden sm:inline">SOS</span>
        </Link>

        <div className="relative" ref={panelRef}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="true"
            aria-expanded={open}
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} active alert${unreadCount > 1 ? 's' : ''}` : 'Notifications, no active alerts'}
            className="relative p-2 text-slate hover:text-ink rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Bell className="w-6 h-6" strokeWidth={1.5} />
            {unreadCount > 0 && (
              <span className={`absolute top-1.5 right-2 w-2.5 h-2.5 ${hasCritical ? 'bg-critical' : 'bg-warn'} rounded-full border-2 border-canvas`}></span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-80 max-w-[85vw] bg-surface rounded-2xl shadow-lg border border-line z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-line flex items-center justify-between">
                <span className="text-[14px] font-semibold text-ink">Notifications</span>
                <span className="text-[11px] font-medium text-slate">{unreadCount} active</span>
              </div>
              {alertError && <p role="alert" className="p-3 text-critical">{alertError}</p>}
              <div className="max-h-80 overflow-y-auto">
                {recent.length === 0 ? (
                  <p className="px-4 py-6 text-center text-[13px] text-slate">No notifications yet.</p>
                ) : (
                  recent.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 px-4 py-3 border-b border-line/60 last:border-0">
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dot(a.severity)}`}></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-ink leading-tight">{a.title}</p>
                        <p className="text-[12px] text-slate leading-snug">{a.detail}</p>
                        <p className="text-[11px] text-slate mt-0.5">{a.timestamp ? format(new Date(a.timestamp), 'MMM d, HH:mm') : ''}{a.status !== 'active' ? ' · resolved' : ''}</p>
                        {a.status === 'active' && <div className="flex flex-wrap gap-2 mt-2">
                          {!a.acknowledged_at && <button type="button" className="text-xs text-brand underline" onClick={() => { setAlertError('');void updateAlert(a.id,'acknowledge').catch(() => setAlertError('Could not acknowledge. Please retry.')); }}>Acknowledge</button>}
                          <button type="button" className="text-xs text-brand underline" onClick={() => { setAlertError('');void updateAlert(a.id,'resolve').catch(() => setAlertError('Could not resolve. Please retry.')); }}>Resolve</button>
                        </div>}

                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <Link to="/profile" aria-label="Your profile" className="w-10 h-10 rounded-full overflow-hidden bg-line border border-line block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          <img src="https://ui-avatars.com/api/?name=User&background=e4e0d8&color=15233b" alt="Your profile" className="w-full h-full object-cover" />
        </Link>

        <button
          type="button"
          onClick={logout}
          aria-label="Sign out"
          className="p-2 text-slate hover:text-ink rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <LogOut className="w-5 h-5" strokeWidth={1.75} />
        </button>

      </div>
    </header>
  );
}
