import { ArrowUpRight, Settings as SettingsIcon, UserRound, Wifi } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { useHealthStore } from '../store/useHealthStore';

export default function Settings() {
  const { isConnected, isSocketConnected, freshness } = useHealthStore();
  return (
    <div className="page-stack page-narrow">
      <PageHeader title="Settings" description="Your profile, connection status and available preferences." icon={SettingsIcon} />
      <div className="two-column">
        <section className="surface">
          <span className="empty-state-symbol"><UserRound aria-hidden="true" /></span>
          <h2 className="surface-title">Make your profile yours</h2>
          <p className="surface-description">Update your details, body measurements, goals and the information used for wellness guidance.</p>
          <Link to="/profile" className="ui-button secondary mt-6">View your profile<ArrowUpRight aria-hidden="true" /></Link>
        </section>
        <section className="surface">
          <div className="insights-heading"><Wifi aria-hidden="true" /><h2 className="surface-title">Connection status</h2></div>
          <dl className="reading-list"><div><dt>Service</dt><dd>{isConnected ? 'Connected' : 'Connecting or unavailable'}</dd></div><div><dt>Live updates</dt><dd>{isSocketConnected ? 'Connected' : 'Reconnecting'}</dd></div><div><dt>Readings</dt><dd>{freshness.state === 'fresh' ? 'Fresh' : freshness.state === 'stale' ? 'Stale' : 'Waiting for data'}</dd></div></dl>
        </section>
      </div>
      <section className="surface"><h2 className="surface-title">Alert & notification preferences</h2><p className="surface-description">Custom thresholds and notification preferences are unavailable in this build. You can review and resolve active alerts from the notification bell.</p></section>
    </div>
  );
}
