import { Modal } from './Modal';
import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useHealthStore } from '../store/useHealthStore';
import { Link, Outlet } from 'react-router-dom';
import { Menu, X, WifiOff } from 'lucide-react';
import { Onboarding } from './onboarding/Onboarding';
import { BrandLogo } from './BrandLogo';

export function Layout() {
  const { fetchInitialData, connectWebSocket, disconnectWebSocket, isConnected,
    fetchProfile, profile, profileLoaded, showOnboarding, isSocketConnected, freshness, error } = useHealthStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    fetchInitialData();
    fetchProfile();
    connectWebSocket();
    void useHealthStore.getState().fetchInsights();
    const clock = window.setInterval(() => useHealthStore.getState().tick(), 1000);
    const poll = window.setInterval(() => {
      void useHealthStore.getState().fetchInitialData();
      void useHealthStore.getState().fetchInsights();
    }, 30000);

    return () => {
      clearInterval(clock); clearInterval(poll); disconnectWebSocket();
    };
  }, [fetchInitialData, fetchProfile, connectWebSocket, disconnectWebSocket]);

  const needsOnboarding = (profileLoaded && !profile?.onboarded) || showOnboarding;

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
        <div className="mobile-brand-bar">
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

        <Header />

        {/* Offline / Backend Error Banner */}
        {(!isConnected || !isSocketConnected || freshness.state !== 'fresh') && (
          <div className="connection-notice">
            <WifiOff aria-hidden="true" />
            <span role="status" className="font-medium">{!isConnected ? 'Backend unavailable or connecting.' : !isSocketConnected ? 'Live connection interrupted; refreshing periodically.' : freshness.state === 'missing' ? 'Waiting for device readings.' : 'Readings are stale; check your device.'}</span>
          </div>
        )}

        <main id="main-content" tabIndex={0} className="app-content">
          {error && <p role="alert" className="mb-4 rounded-xl bg-critical-bg text-critical p-3">{error}</p>}
          <Outlet />
        </main>
      </div>

      {needsOnboarding && <Onboarding />}
    </div>
  );
}
