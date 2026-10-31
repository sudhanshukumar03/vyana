import {type Alert,type DeviceStatus as DeviceData} from '../store/useHealthStore';
import { Heart, Droplet, Footprints, Cpu, AlertTriangle, Info, ArrowUpRight } from 'lucide-react';
import {Link} from 'react-router-dom';
import {useSensorPresentation} from '../store/useSensorPresentation';
import { currentSensorReadings, liveEquipment, readingSourceLabel } from '../services/equipment';

const fmt = (value: number | undefined | null, suffix = '') => value == null ? '—' : `${value}${suffix}`;

export function WellnessProgress() {
  const { wellnessScore, vitals, activity, device,previewEnabled,wellnessPreview } = useSensorPresentation();
  const current=currentSensorReadings(vitals??{},previewEnabled?null:liveEquipment(device));
  const strokeColor = wellnessScore == null ? 'var(--color-line)' : wellnessScore >= 80 ? 'var(--color-brand)' : wellnessScore >= 60 ? 'var(--color-warn)' : 'var(--color-critical)';
  const scoreTextColor = wellnessScore == null ? 'text-muted' : wellnessScore >= 80 ? 'text-brand' : wellnessScore >= 60 ? 'text-warn' : 'text-critical';

  return (
    <section className="surface flex flex-col justify-between" aria-labelledby="wellness-overview-title">
      <div>
        <h2 id="wellness-overview-title" className="surface-title">Wellness overview</h2>
        <p className="surface-description">{wellnessPreview?'Preview score from displayed readings. ECG is not assessed.':'A project heuristic, not a clinical assessment.'}</p>
        <div className="score-ring">
          <svg viewBox="0 0 128 128" aria-hidden="true">
            <circle cx="64" cy="64" r="52" fill="none" stroke="var(--color-line)" strokeWidth="8" />
            <circle
              cx="64"
              cy="64"
              r="52"
              fill="none"
              stroke={strokeColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray="326.73"
              strokeDashoffset={wellnessScore == null ? 326.73 : 326.73 * (1 - wellnessScore / 100)}
            />
          </svg>
          <div className="score-ring-value">
            <strong className={scoreTextColor}>{wellnessScore ?? '—'}</strong>
            <span>/ 100</span>
          </div>
        </div>
        <p className="score-ring-caption">
          {wellnessScore == null ? 'Score unavailable with missing, stale or unclassified ECG readings' : wellnessPreview ? 'Preview score · display only' : 'Wellness score'}
        </p>
      </div>
      <dl className="reading-list border-t border-line pt-3 mt-auto">
        <div><dt><Heart aria-hidden="true" />Heart rate</dt><dd>{fmt(current.heart_rate, ' bpm')}</dd></div>
        <div><dt><Droplet aria-hidden="true" />Blood oxygen</dt><dd>{fmt(current.spo2, '%')}</dd></div>
        <div><dt><Footprints aria-hidden="true" />Steps</dt><dd>{fmt(activity?.steps)}</dd></div>
      </dl>
    </section>
  );
}

export function DeviceStatus({ alerts, device }: { alerts?: Alert[]; device?: DeviceData }) {
  const recent = alerts?.slice(0, 3) ?? [];
  const online=Boolean(device?.active&&device.connected);
  const status=!device?'Not set up':!device.active?'Inactive':online?'Online':'Offline';
  const recordedTime=(value:string|null|undefined)=>value&&Number.isFinite(Date.parse(value))?
    new Date(value).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):null;
  const lastSeen=recordedTime(device?.last_seen);
  return (
    <section className="surface device-alerts-card" aria-labelledby="device-alerts-title">
      <header className="device-alerts-heading">
        <h2 id="device-alerts-title" className="surface-title">Device & alerts</h2>
        <span className={`device-link-status${online?' is-online':''}`}><span aria-hidden="true"/>{status}</span>
      </header>
        <div className="device-summary">
          <span className="device-summary-icon"><Cpu aria-hidden="true" /></span>
          <div className="min-w-0">
            <h3>{device?.device_name ?? 'No device added'}</h3>
            <p>{device ? readingSourceLabel(device.source) : 'Add your sensor hub in Settings.'}</p>
            {device&&<p>Last seen: {lastSeen??'No heartbeat received'}</p>}
            {device?.battery!=null&&<p>Battery: {device.battery}%</p>}
          </div>
        </div>
        <div className="device-alerts-label"><h3>Recent alerts</h3>{Boolean(alerts?.length)&&<span>{alerts!.length} {alerts!.length===1?'alert':'alerts'}</span>}</div>
        {recent.length ? (
          <ul className="device-alert-list">
            {recent.map(alert => {
              const Icon=alert.severity==='info'?Info:AlertTriangle;
              return <li key={alert.id} data-severity={alert.severity} data-state={alert.status}>
                <Icon aria-hidden="true"/>
                <div><strong>{alert.title}</strong><p>{recordedTime(alert.timestamp)?<><time dateTime={alert.timestamp}>{recordedTime(alert.timestamp)}</time><span aria-hidden="true"> · </span></>:null}<span className="device-alert-state">{alert.status==='active'?'Active':'Resolved'}</span></p></div>
              </li>;
            })}
          </ul>
        ) : (
          <p className="device-alert-empty">No recent alerts recorded.</p>
        )}
      {alerts&&alerts.length>recent.length&&<p className="device-alert-more">Showing the first {recent.length} of {alerts.length} alerts.</p>}
      <footer className="device-alerts-footer"><Link to="/settings">Device settings<ArrowUpRight aria-hidden="true"/></Link></footer>
    </section>
  );
}
