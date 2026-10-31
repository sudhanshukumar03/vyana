import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {Mail,Phone,ShieldAlert,MessageSquare,FileText} from 'lucide-react';
import type {SosCapabilities,SosIncident,SosOverview,SosPreferences} from '../../../../shared/types/sos';
import {apiJson} from '../services/api';
import {sosNotificationLabel} from '../services/sos';
import {useHealthStore} from '../store/useHealthStore';

type ToggleKey={ [K in keyof SosPreferences]:SosPreferences[K] extends boolean?K:never }[keyof SosPreferences];
function SosHistory({incidents,capabilities}:{incidents:SosIncident[];capabilities:SosCapabilities}) {
  return <div className="space-y-3" aria-label="SOS notification history">
    {incidents.length?incidents.slice(0,5).map(incident=><article key={incident.id} className="border-t border-line pt-3">
      <p className="text-sm font-semibold text-ink">{incident.kind==='daily'?'Monitoring report':incident.kind==='sensor_fault'?'Sensor review':incident.kind==='automatic'?'Automatic SOS':'SOS request'}</p>
      <p className="text-sm text-muted break-words">{incident.reason}</p>
      <p className="text-xs text-muted mt-1">{new Date(incident.created_at).toLocaleString()} · {incident.status==='pending'?'Countdown running':incident.status==='recorded'?'Recorded without external notifications':incident.status}</p>
      {incident.notifications.map(job=><p key={job.id} className="text-xs text-body mt-1">{job.contact_name} · {job.channel==='call'?'Voice call':job.channel.toUpperCase()} · {sosNotificationLabel(job,capabilities)}{job.error_code==='service_not_configured'?' — configure the sending service':''}</p>)}
    </article>):<p className="surface-description">Your SOS requests, reports and notification status will appear here.</p>}
  </div>;
}

export function SosSettings() {
  const {contacts,fetchContacts}=useHealthStore();
  const [overview,setOverview]=useState<SosOverview|null>(null);
  const [settings,setSettings]=useState<SosPreferences|null>(null);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{
    let active=true,fetching=false;void fetchContacts();
    const controller=new AbortController();
    const refresh=async(initial=false)=>{
      if(fetching)return;fetching=true;
      try{const value=await apiJson<SosOverview>('/sos',{signal:controller.signal});if(active){setOverview(value);if(initial)setSettings(value.preferences);}}
      catch(err){if(active&&initial)setError(err instanceof Error?err.message:'SOS settings could not be loaded');}
      finally{fetching=false;}
    };
    void refresh(true);const timer=window.setInterval(()=>void refresh(),5000);
    return ()=>{active=false;controller.abort();window.clearInterval(timer);};
  },[fetchContacts]);
  const update=<K extends keyof SosPreferences>(key:K,value:SosPreferences[K])=>setSettings(old=>old?{...old,[key]:value}:old);
  const toggleContact=(key:'emergency_contact_ids'|'report_contact_ids',id:number)=>{
    if(!settings)return;
    update(key,settings[key].includes(id)?settings[key].filter(value=>value!==id):[...settings[key],id]);
  };
  const save=async(event:React.FormEvent)=>{
    event.preventDefault();if(!settings)return;setBusy(true);setError('');setNotice('');
    try {
      const saved=await apiJson<SosPreferences>('/sos/preferences',{method:'PUT',body:JSON.stringify(settings)});
      setSettings(saved);setOverview(old=>old?{...old,preferences:saved}:old);setNotice('SOS preferences saved.');
    }catch(err){setError(err instanceof Error?err.message:'Settings could not be saved');}
    finally{setBusy(false);}
  };
  const sendReport=async()=>{
    setBusy(true);setError('');setNotice('');
    try {await apiJson('/sos/report',{method:'POST'});setNotice('Report queued for your saved report recipients. Check delivery status below.');
      setOverview(await apiJson<SosOverview>('/sos'));
    }catch(err){setError(err instanceof Error?err.message:'Report could not be queued');}
    finally{setBusy(false);}
  };
  const downloadReport=async()=>{
    setError('');
    try {
      const report=await apiJson<unknown>('/sos/report');
      const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download='vyaana-monitoring-report.json';link.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(err){setError(err instanceof Error?err.message:'Report could not be downloaded');}
  };
  const check=(key:ToggleKey,label:string,detail?:string)=>
    <label className="flex min-h-11 items-start gap-3 py-2 text-sm text-ink">
      <input className="mt-1 h-5 w-5 shrink-0 accent-brand" type="checkbox" checked={Boolean(settings?.[key])} onChange={event=>update(key,event.target.checked)}/>
      <span><span className="font-semibold">{label}</span>{detail&&<span className="block text-xs text-muted mt-1">{detail}</span>}</span>
    </label>;
  return <section id="sos-settings" className="surface space-y-5" aria-labelledby="sos-settings-title">
    <div className="insights-heading"><ShieldAlert aria-hidden="true"/><h2 id="sos-settings-title" className="surface-title">SOS and report sharing</h2></div>
    <p className="surface-description">Choose who receives emergency alerts and daily monitoring reports. Automatic alerts run on the server, even when this page is closed.</p>
    {error&&<p role="alert" className="text-sm text-critical">{error}</p>}
    {notice&&<p role="status" className="text-sm text-brand">{notice}</p>}
    {!settings||!overview?<p className="text-sm text-muted">{error?'Reload this page to retry.':'Loading SOS preferences…'}</p>:<>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm" aria-label="Notification services">
        {[{label:'Email reports',ready:overview.capabilities.email,Icon:Mail},{label:'Text messages',ready:overview.capabilities.sms,Icon:MessageSquare},{label:'Voice calls',ready:overview.capabilities.call,Icon:Phone}].map(({label,ready,Icon})=>{
          return <div key={label} className="flex items-center gap-2"><Icon className="h-4 w-4" aria-hidden="true"/><span>{label}<span className="block text-xs text-muted">{ready?'Service configured':'Setup required'}</span></span></div>;
        })}
      </div>
      <form onSubmit={event=>void save(event)} className="space-y-5">
        <fieldset className="space-y-2"><legend className="text-sm font-semibold text-ink">People to notify</legend>
          <p className="text-xs text-muted">Reports are emailed. Emergency recipients use the enabled channels available in their saved contact details. Phone numbers for server calls and texts need a country code, such as +91.</p>
          {!contacts.length?<p className="text-sm text-muted">Add your doctor or trusted contact on the <Link className="underline" to="/emergency">Emergency page</Link> first.</p>:
            contacts.map(contact=><div key={contact.id} className="border-t border-line py-3">
              <p className="text-sm font-semibold text-ink">{contact.name}{contact.is_doctor?' · Doctor':''}</p>
              <p className="text-xs text-muted break-all">{[contact.email,contact.phone].filter(Boolean).join(' · ')}</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2 mt-2">
                <label className="flex min-h-11 items-center gap-2 text-sm"><input className="h-5 w-5 accent-brand" type="checkbox" checked={settings.emergency_contact_ids.includes(contact.id)} onChange={()=>toggleContact('emergency_contact_ids',contact.id)}/>Emergency alerts for {contact.name}</label>
                <label className="flex min-h-11 items-center gap-2 text-sm"><input className="h-5 w-5 accent-brand" type="checkbox" disabled={!contact.email} checked={settings.report_contact_ids.includes(contact.id)} onChange={()=>toggleContact('report_contact_ids',contact.id)}/>Reports for {contact.name}</label>
              </div>
            </div>)}
        </fieldset>
        <fieldset><legend className="text-sm font-semibold text-ink">Delivery channels</legend>
          {check('email_enabled','Email alerts and reports')}
          {check('sms_enabled','Send an SMS to emergency recipients')}
          {check('call_enabled','Call emergency recipients with a spoken alert')}
          {check('attach_report','Attach the 24-hour readings as a CSV file','The email includes a readable monitoring summary. CSV contains up to 2,000 recent observations.')}
        </fieldset>
        <fieldset><legend className="text-sm font-semibold text-ink">Automatic monitoring</legend>
          {check('auto_enabled','Enable automatic SOS','Triggers on repeated fresh device readings: heart rate below 40 or above 150 bpm, or oxygen below 88%. These are project alert rules, not a diagnosis.')}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            {([['critical_seconds','Abnormal reading duration (seconds)',30,600],['minimum_samples','Minimum consecutive readings',3,120],
              ['cancel_seconds','Time to cancel SOS (seconds)',15,120],['cooldown_minutes','Minimum time between automatic alerts (minutes)',15,1440]] as const).map(([key,label,min,max])=>
              <label key={key} className="text-sm text-body">{label}<input className="ui-input mt-1" type="number" min={min} max={max} required value={settings[key]} onChange={event=>update(key,Number(event.target.value))}/></label>)}
          </div>
          <p className="text-xs text-muted mt-3">Invalid optical values, ECG lead loss and clipping do not initiate emergency calls. ECG rhythm detection is unavailable in the current sensor firmware.</p>
          {check('fault_report_enabled','Email a sensor-quality report after five minutes of faults','Includes disconnected leads, significant ECG clipping and unavailable sensor readings. Sent at most once per device per UTC day.')}
          {check('daily_report_enabled','Email a daily monitoring report')}
          <label className="block text-sm text-body mt-2">Daily report hour ({overview.timezone})
            <select className="ui-input mt-1" value={settings.daily_hour} onChange={event=>update('daily_hour',Number(event.target.value))}>
              {Array.from({length:24},(_,hour)=><option key={hour} value={hour}>{String(hour).padStart(2,'0')}:00</option>)}
            </select>
          </label>
        </fieldset>
        {check('sharing_enabled','Share my monitoring reports with the selected contacts','Enable this only after choosing the people you want Vyaana to contact. Turning sharing off cancels notifications that have not begun sending.')}
        <p className="text-xs text-muted">The server needs internet access and configured email/phone services. Browser call and message buttons open your phone apps; this page cannot activate the handset’s built-in Emergency SOS.</p>
        <button className="ui-button primary" type="submit" disabled={busy}>{busy?'Saving…':'Save SOS preferences'}</button>
      </form>
      <div className="flex flex-wrap gap-3 pt-3 border-t border-line">
        <button className="ui-button secondary" type="button" disabled={busy} onClick={()=>void sendReport()}><Mail aria-hidden="true"/>Email report now</button>
        <button className="ui-button secondary" type="button" onClick={()=>void downloadReport()}><FileText aria-hidden="true"/>Download report data</button>
      </div>
      <SosHistory incidents={overview.incidents} capabilities={overview.capabilities}/>
      <p className="text-xs text-muted">“Provider accepted” confirms submission to the delivery service; it does not confirm that the person received or read the alert.</p>
    </>}
  </section>;
}

