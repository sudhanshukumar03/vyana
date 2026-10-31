import {DeviceManagement} from '../components/DeviceManagement';
import { useState } from 'react';
import { ArrowUpRight, Settings as SettingsIcon, UserRound, Wifi, Database, Check, Sliders, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { useHealthStore } from '../store/useHealthStore';
import { useIsAdminOrDev, useAdminAccessStore } from '../store/useAdminAccess';
import {SosSettings} from '../components/SosSettings';

export default function Settings() {
  const { isConnected, isSocketConnected, freshness, user } = useHealthStore();
  const isAdminOrDev = useIsAdminOrDev();
  const { toggleDevTools } = useAdminAccessStore();

  const isEmailAdmin = Boolean(
    user?.email && (
      user.email.toLowerCase().includes('admin') ||
      user.email.toLowerCase().startsWith('dev@') ||
      user.email.toLowerCase().includes('technician')
    )
  );

  const [savedNotice,setSavedNotice]=useState(false);

  const handleExportData = () => {
    const state = useHealthStore.getState();
    const exportData = {
      scope:'Loaded browser snapshot only; not a full account backup',
      exportedAt: new Date().toISOString(),
      profile: state.profile,
      vitals: state.vitals,
      device:state.device,
      activity: state.activity,
      googleActivity:state.googleActivity,
      alerts: state.alerts,
      contacts: state.contacts,
      historicalVitals: state.historicalVitals,
      dailyActivityRecords: state.googleActivity?.days??[]
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vyana-loaded-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className="page-stack page-narrow">
      <PageHeader title="Settings" description="Manage your profile, SOS preferences, connections and loaded-data export." icon={SettingsIcon} />

      {savedNotice && (
        <div className="p-3 rounded-xl bg-surface-soft border border-line text-xs text-brand font-semibold flex items-center gap-2">
          <Check className="w-4 h-4" /> Loaded-data snapshot downloaded.
        </div>
      )}

      <div className="two-column">
        {/* Profile Card */}
        <section className="surface">
          <span className="empty-state-symbol"><UserRound aria-hidden="true" /></span>
          <h2 className="surface-title">Make your profile yours</h2>
          <p className="surface-description">Update your personal details, body measurements, daily targets and medical context.</p>
          <Link to="/profile" className="ui-button secondary mt-6">View your profile<ArrowUpRight aria-hidden="true" /></Link>
        </section>

        {/* Connection Status Card */}
        <section className="surface">
          <div className="insights-heading"><Wifi aria-hidden="true" /><h2 className="surface-title">Connection status</h2></div>
          <dl className="reading-list">
            <div><dt>Service</dt><dd>{isConnected ? 'Connected' : 'Connecting or unavailable'}</dd></div>
            <div><dt>Live updates</dt><dd>{isSocketConnected ? 'Connected' : 'Reconnecting'}</dd></div>
            <div><dt>Readings</dt><dd>{freshness.state === 'fresh' ? 'Fresh' : freshness.state === 'stale' ? 'Stale' : 'Waiting for data'}</dd></div>
          </dl>
        </section>
      </div>

      <SosSettings />
      <DeviceManagement/>

      {/* Back-Office & Hardware Simulation (Visible only for admin accounts or when developer mode is enabled) */}
      {isAdminOrDev && (
        <section className="surface" aria-labelledby="back-office-settings-title">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-start gap-3">
              <Sliders className="w-5 h-5 text-brand shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="back-office-settings-title" className="surface-title">Back-Office Operations &amp; Hardware Simulation</h2>
                  {isEmailAdmin && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand/10 text-brand border border-brand/20">
                      <Shield className="w-2.5 h-2.5" /> Admin
                    </span>
                  )}
                </div>
                <p className="surface-description">
                  Access the remote hardware test harness to simulate heart rate, SpO2, and ECG telemetry from phone or laptop, and synthesize clinical reports.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/admin"
                className="ui-button text-xs gap-1.5"
              >
                <span>Open Back-Office</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
              {!isEmailAdmin && (
                <button
                  type="button"
                  onClick={toggleDevTools}
                  className="ui-button secondary text-xs"
                  title="Hide back-office simulation tools"
                >
                  Hide
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Data Export & Privacy */}
      <section className="surface">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-brand shrink-0 mt-0.5" />
            <div>
              <h2 className="surface-title">Export Personal Health Data</h2>
              <p className="surface-description">Download only the profile, readings, loaded history, activity, alerts and contacts currently in this browser session. Reports, older pages and restore support are not included.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExportData}
            className="ui-button secondary text-xs"
          >
            Export loaded snapshot
          </button>
        </div>
      </section>

      {/* Developer mode toggle for testing (hidden if already an admin user) */}
      {!isEmailAdmin && !isAdminOrDev && (
        <section className="surface border border-dashed border-slate-200">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-start gap-3">
              <Sliders className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-semibold text-slate-600">Hardware Simulation &amp; Testing Mode</h3>
                <p className="text-[11px] text-muted">
                  Enable hardware simulation controls in the navigation for demonstration or sensor calibration testing.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleDevTools}
              className="ui-button secondary text-xs py-1 px-3"
            >
              Enable Test Tools
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
