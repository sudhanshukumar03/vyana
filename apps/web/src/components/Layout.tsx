import { Modal } from './Modal';
import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useHealthStore } from '../store/useHealthStore';
import { Link, Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
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
    <div className="flex h-screen bg-porcelain font-sans overflow-hidden">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex shrink-0">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <Modal title="Main navigation" onClose={() => setMobileNavOpen(false)}>
          <div className="relative w-[260px] max-h-[85dvh] overflow-y-auto bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
              className="absolute top-4 right-4 p-1.5 text-gray-500 hover:text-gray-900 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <X className="w-5 h-5" />
            </button>
            <Sidebar onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </Modal>
      )}

      <div className="min-w-0 flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 h-18 border-b border-line bg-surface shrink-0">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileNavOpen}
            className="p-2.5 -ml-2 text-slate hover:text-ink rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Link to="/"  className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
            <BrandLogo variant="small" />
          </Link>
        </div>

        <Header />

        {/* Offline / Backend Error Banner */}
        {(!isConnected || !isSocketConnected || freshness.state !== 'fresh') && (
          <div className="bg-amber-50 text-amber-800 px-6 py-2 text-sm flex items-center justify-center border-b border-amber-200">
            <span role="status" className="font-medium">{!isConnected ? 'Backend unavailable or connecting.' : !isSocketConnected ? 'Live connection interrupted; refreshing periodically.' : freshness.state === 'missing' ? 'Waiting for device readings.' : 'Readings are stale; check your device.'}</span>
            <span className="ml-2 hidden sm:inline">Live updates may be delayed.</span>
          </div>
        )}

        <main id="main-content" tabIndex={0} className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {error && <p role="alert" className="mb-4 rounded-xl bg-critical-bg text-critical p-3">{error}</p>}
          <Outlet />
        </main>
      </div>

      {needsOnboarding && <Onboarding />}
    </div>
  );
}
