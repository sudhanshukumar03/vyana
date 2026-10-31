import { Modal } from './Modal';
import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useHealthStore } from '../store/useHealthStore';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Activity, Menu, X, WifiOff } from 'lucide-react';
import { liveEquipment } from '../services/equipment';
import { Onboarding } from './onboarding/Onboarding';
import { BrandLogo } from './BrandLogo';
import {SosCountdown} from './SosCountdown';
import {useSensorPreview} from '../store/useSensorPresentation';
import {startLiveSync} from '../services/liveSync';

export function Layout() {
  const path=useLocation().pathname;
  const isActivityPage=['/activity','/wellness'].includes(path);
  const sensorPage=['/','/vitals','/trends','/history'].includes(path);
  const { fetchInitialData, connectWebSocket, disconnectWebSocket, isConnected,
    fetchProfile, profile, profileLoaded, showOnboarding, isSocketConnected, freshness, device, error } = useHealthStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    fetchProfile();
    const stopSync = startLiveSync({
      refresh: () => { void fetchInitialData(); },
      reconnect: connectWebSocket,
      streaming: () => useHealthStore.getState().isSocketConnected,
      tick: () => {useHealthStore.getState().tick();useSensorPreview.getState().tick();},
      insights: () => { void useHealthStore.getState().fetchInsights(); },
    });

    return () => {
      stopSync(); disconnectWebSocket();
    };
  }, [fetchInitialData, fetchProfile, connectWebSocket, disconnectWebSocket]);

  const needsOnboarding = (profileLoaded && !profile?.onboarded) || showOnboarding;
  const hasEquipment=Boolean(liveEquipment(device));

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {/* Desktop sidebar */}
      <div className="desktop-navigation">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <Modal title="Main navigation" className="navigation-modal" onClose={() => setMobileNavOpen(false)}>
          <div className="navigation-dialog">
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
              className="icon-button"
            >
              <X className="w-5 h-5" />
            </button>
            <Sidebar onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </Modal>
      )}

      <div className="app-workspace">
        {/* Mobile top bar */}
        <div className="workspace-header"><div className="mobile-brand-bar">
          <Link to="/" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
            <BrandLogo variant="small" />
          </Link>
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileNavOpen}
            className="icon-button"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        <Header /></div>
        <SosCountdown />

        {/* Offline / Backend Error Banner */}
        {(!isConnected || (!isSocketConnected&&!isActivityPage) || (sensorPage&&path!=='/'&&freshness.state!=='fresh')) && (
          <div className="connection-notice">
            {hasEquipment&&isConnected&&isSocketConnected ? <Activity aria-hidden="true" /> : <WifiOff aria-hidden="true" />}
            <span role="status" className="font-medium">{!isConnected ? 'Backend unavailable or connecting.' : !isSocketConnected ? 'Live connection interrupted; refreshing periodically.' : hasEquipment ? 'Live equipment data; some vital readings are unavailable.' : freshness.state === 'missing' ? 'Waiting for device readings.' : 'Readings are stale; check your device.'}</span>
          </div>
        )}

        <main id="main-content" tabIndex={0} className="app-content">
          {error && (
            <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-critical/30 bg-critical-bg p-3.5 text-critical text-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-medium truncate">{error}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => { void fetchInitialData(); }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface border border-critical/30 text-critical hover:bg-critical-bg transition-colors"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => { useHealthStore.getState().clearError(); }}
                  aria-label="Dismiss alert"
                  className="p-1 rounded-lg hover:bg-critical/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          <Outlet />
        </main>
      </div>

      {needsOnboarding && <Onboarding />}
    </div>
  );
}
