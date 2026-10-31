import {useState} from 'react';
import {Footprints,ArrowUpRight,RefreshCw,Unplug,Map,Flame,Clock,CalendarDays,ChevronDown} from 'lucide-react';
import {useHealthStore} from '../store/useHealthStore';
import {apiJson,getSessionEpoch} from '../services/api';
import {ActivityTimeline} from '../components/ActivityTimeline';
import {HealthReviewSection} from '../components/HealthReview';
import {PageHeader} from '../components/PageHeader';

const issues:Record<string,string>={reconnect_required:'Reconnect Google Health to resume syncing.',access_denied:'Google denied activity access. Check your permissions.',rate_limited:'Google asked us to wait. Saved activity is still available.',sync_failed:'The last sync could not finish. Your saved activity is still available.'};
const callbacks:Record<string,string>={denied:'Google connection cancelled.',invalid_state:'That connection request expired. Connect again.',session_expired:'Sign in to Vyana again before connecting Google Health.',permission_missing:'Allow read access to connect your activity.',failed:'Could not connect Google Health. Check your API setup and Google Health profile.'};
const format=(value:number|null|undefined)=>value==null?'—':value.toLocaleString(undefined,{maximumFractionDigits:2});

export default function Activity() {
  const {googleActivity:data,googleActivityError,isGoogleActivitySyncing,syncGoogleActivity,disconnectGoogleActivity}=useHealthStore();
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[selectedDate,setSelectedDate]=useState(''),[syncFeedback,setSyncFeedback]=useState('');
  const callback=new URLSearchParams(window.location.search).get('google');
  const days=data?.days??[],availableDays=days.filter(day=>[day.steps,day.distance_km,day.active_calories_kcal,day.active_minutes].some(value=>value!=null));
  const date=availableDays.some(day=>day.date===selectedDate)?selectedDate:data?.today;
  const selectedDay=days.find(day=>day.date===date),latestDay=availableDays.at(-1);
  const dateLabel=(value:string)=>new Date(`${value}T12:00:00`).toLocaleDateString(undefined,{day:'numeric',month:'short'});
  const connected=Boolean(data?.connected),configured=Boolean(data?.configured),working=busy||isGoogleActivitySyncing;
  const hasSelectedRecords=availableDays.some(day=>day.date===date);
  async function connect() {
    setBusy(true);setError('');const epoch=getSessionEpoch();
    try{const result=await apiJson<{url:string}>('/integrations/google-health/connect',{method:'POST'});
      if(epoch!==getSessionEpoch())return;
      const url=new URL(result.url);if(url.origin!=='https://accounts.google.com')throw Error('Invalid connection address.');
      window.location.assign(url.href);
    }catch(e){if(epoch===getSessionEpoch())setError(e instanceof Error?e.message:'Could not start the connection.');}
    finally{setBusy(false);}
  }
  async function sync() {
    setBusy(true);setSyncFeedback('');const epoch=getSessionEpoch(),previous=data?.last_attempt_at;
    try{await syncGoogleActivity();if(epoch!==getSessionEpoch())return;
      const current=useHealthStore.getState();
      if(!current.googleActivityError&&!current.googleActivity?.error_code)setSyncFeedback(current.googleActivity?.last_attempt_at===previous?'Already up to date.':'Activity checked.');
    }finally{setBusy(false);}
  }
  async function disconnect(){setBusy(true);setError('');setSyncFeedback('');try{await disconnectGoogleActivity();}finally{setBusy(false);}}
  const notice=error||googleActivityError||(data?.error_code?issues[data.error_code]:null)||(callback&&Object.hasOwn(callbacks,callback)?callbacks[callback]:null);
  const stats=[
    {label:'Active calories',value:connected?selectedDay?.active_calories_kcal:null,unit:'kcal',icon:Flame,test:'activity-calories',tone:'warm'},
    {label:'Distance',value:connected?selectedDay?.distance_km:null,unit:'km',icon:Map,test:undefined,tone:'violet'},
    {label:'Active time',value:connected?selectedDay?.active_minutes:null,unit:'min',icon:Clock,test:'activity-active-time',tone:'mint'},
  ];
  return <div className="activity-page">
    <PageHeader
      title="Activity"
      description="Hourly step cadence, distance, active burn and movement distribution."
      icon={Footprints}
      action={connected ? (
        <div className="activity-date-control">
          <CalendarDays aria-hidden="true"/>
          <label htmlFor="activity-day" className="sr-only">Showing activity for</label>
          <select id="activity-day" value={date??''} onChange={event=>setSelectedDate(event.target.value)}>
            <option value={data?.today}>Today{data?.today?` · ${dateLabel(data.today)}`:''}</option>
            {[...availableDays].reverse().filter(day=>day.date!==data?.today).map(day=><option key={day.date} value={day.date}>{dateLabel(day.date)}</option>)}
          </select>
        </div>
      ) : undefined}
    />
    {notice&&<p role="alert" className="activity-message is-error">{notice}</p>}
    {Boolean(data?.metric_warnings?.length)&&<p role="status" className="activity-message">Some values could not refresh. Previous recorded values are retained where available.</p>}
    {connected&&!hasSelectedRecords&&<div className="activity-empty-day"><p>No activity recorded for today yet.</p>{latestDay&&<button type="button" className="activity-text-button" onClick={()=>setSelectedDate(latestDay.date)}>View {dateLabel(latestDay.date)}</button>}</div>}
    {!connected&&<section className="activity-connect-card" aria-labelledby="activity-connect-title">
      <span className="activity-connect-symbol"><Footprints aria-hidden="true"/></span>
      <div>
        <h2 id="activity-connect-title">Google Health Activity</h2>
        <p>Sync steps, distance, active minutes, and hourly movement distribution.</p>
        {configured?<button type="button" disabled={busy} className="ui-button primary" onClick={()=>void connect()}>Connect Google Health<ArrowUpRight aria-hidden="true"/></button>:<p className="activity-setup-note">Google Health connection setup is pending.</p>}
      </div>
    </section>}
    {connected&&<div className="activity-overview-grid">
      <section className="activity-step-card" aria-label="Activity summary">
        <div className={`activity-step-dial${selectedDay?.steps==null?' is-empty':''}`}>
          <svg viewBox="0 0 240 220" aria-hidden="true" focusable="false"><path className="activity-dial-track" d="M 55 180 A 88 88 0 1 1 185 180"/><path className="activity-dial-dots" d="M 67 169 A 72 72 0 1 1 173 169"/></svg>
          <div className="activity-dial-value"><Footprints aria-hidden="true"/><strong data-testid="activity-steps">{format(connected?selectedDay?.steps:null)}</strong><span>Steps</span></div>
        </div>
        <div className="activity-small-stats">{stats.map(({label,value,unit,icon:Icon,test,tone})=><div key={label} className="activity-small-stat"><span className={`activity-stat-icon ${tone}`}><Icon aria-hidden="true"/></span><p>{label}</p><strong data-testid={test}>{format(value)} <span>{unit}</span></strong></div>)}</div>
      </section>
      {connected&&date&&data?<ActivityTimeline key={`${data.account_email}:${data.timezone}:${date}:${data.last_synced_at}:${data.metric_warnings?.join(',')}`} date={date} timezone={data.timezone} days={days}/>:
        <section className="activity-statistics activity-connect-prompt"><h2>Statistics</h2><Footprints aria-hidden="true"/><p>Hourly breakdown will appear once connected.</p>{configured?<button type="button" disabled={busy} className="ui-button primary" onClick={()=>void connect()}>Connect Google Health<ArrowUpRight aria-hidden="true"/></button>:<span>Connection setup pending</span>}</section>}
    </div>}
    {connected&&<HealthReviewSection/>}
    {connected&&<footer className="activity-sync-bar">
      <div className="activity-sync-meta"><span className="activity-source-dot"/>Google Health<span>{data?.last_synced_at?`Updated ${new Date(data.last_synced_at).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}`:'Awaiting first sync'}</span></div>
      <div className="activity-actions"><button type="button" disabled={working} className="activity-sync-button" onClick={()=>void sync()} aria-label="Sync activity"><RefreshCw aria-hidden="true"/>{working?'Syncing…':'Sync'}</button>
        <details className="activity-connection"><summary>Connection<ChevronDown aria-hidden="true"/></summary><div className="activity-connection-options"><p>{data?.account_email}</p>{['reconnect_required','access_denied'].includes(data?.error_code??'')&&<button type="button" disabled={busy} className="ui-button primary" onClick={()=>void connect()}>Reconnect Google Health<ArrowUpRight aria-hidden="true"/></button>}<button type="button" disabled={busy} className="ui-button secondary" onClick={()=>void disconnect()}><Unplug aria-hidden="true"/>Disconnect</button></div></details>
      </div>
      {syncFeedback&&!notice&&!isGoogleActivitySyncing&&<p role="status" className="activity-sync-feedback">{syncFeedback}</p>}{isGoogleActivitySyncing&&!notice&&<p role="status" className="activity-sync-feedback">Checking Google Health…</p>}
    </footer>}
  </div>;
}
