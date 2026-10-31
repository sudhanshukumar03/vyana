import {useEffect,useState} from 'react';
import {BarChart,Bar,XAxis,YAxis,Tooltip,ResponsiveContainer,CartesianGrid} from 'recharts';
import {apiJson} from '../services/api';
import type {GoogleActivityTimeline,GoogleTimelineMetric,GoogleHealthDay} from '../../../../shared/types/google-health';
import {Clock} from 'lucide-react';

const metrics:Record<GoogleTimelineMetric,{label:string;unit:string;peak:string}>={
  steps:{label:'Steps',unit:'steps',peak:'Most steps in a recorded period'},
  distance_km:{label:'Distance',unit:'km',peak:'Longest recorded distance period'},
  active_calories_kcal:{label:'Active calories',unit:'kcal',peak:'Highest recorded active calories period'},
  active_minutes:{label:'Active time',unit:'min',peak:'Most active recorded period'},
};
const number=(value:number|null)=>value===null?'No data':value.toLocaleString(undefined,{maximumFractionDigits:6});

/** The parent keys this view by owner, date, timezone and import version to discard stale requests/pages. */
export function ActivityTimeline({date,timezone,days=[]}:{date:string;timezone:string;days?:GoogleHealthDay[]}) {
  const [timeline,setTimeline]=useState<GoogleActivityTimeline|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const [pages,setPages]=useState<(string|null)[]>([null]),[retry,setRetry]=useState(0),[selection,setSelection]=useState<GoogleTimelineMetric|null>(null);
  const [recordView,setRecordView]=useState('timestamps');
  const cursor=pages.at(-1);
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError('');
    void apiJson<GoogleActivityTimeline>(`/integrations/google-health/timeline?date=${date}${cursor?`&cursor=${encodeURIComponent(cursor)}`:''}`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])})
      .then(data=>{if(!controller.signal.aborted)setTimeline(data);})
      .catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Could not load timestamped activity.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[date,cursor,retry]);
  const metric=selection??(timeline?.hours.some(hour=>hour.active_minutes!==null)?'active_minutes':'steps');
  const details=metrics[metric],hours=timeline?.hours??[];
  const maximum=Math.max(0,...hours.map(hour=>hour[metric]??0));
  const peaks=maximum>0?hours.filter(hour=>hour[metric]===maximum):[];
  const time=(value:string,offset=false)=>new Date(value).toLocaleTimeString(undefined,{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23',...(offset?{timeZoneName:'shortOffset' as const}:{})});
  const offset=(value:string)=>new Intl.DateTimeFormat('en',{timeZone:timezone,timeZoneName:'shortOffset'}).formatToParts(new Date(value)).find(part=>part.type==='timeZoneName')?.value;
  const hasClockChange=new Set(hours.map(hour=>time(hour.start_time))).size<hours.length||hours.some(hour=>offset(hour.start_time)!==offset(hour.end_time));
  const range=(start:string,end:string,offset=hasClockChange)=>`${time(start,offset)} – ${time(end,offset)}`;
  const timestamp=(value:string)=>new Date(value).toLocaleString(undefined,{timeZone:timezone,month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',fractionalSecondDigits:3,hourCycle:'h23'});
  return <section className="activity-statistics" aria-labelledby="activity-timeline-title" aria-busy={loading}>
    <header className="activity-statistics-header"><div><h2 id="activity-timeline-title">Statistics</h2><p>{timezone}</p></div>
        <div className="activity-chart-control"><label htmlFor="activity-timeline-metric" className="sr-only">Show hourly</label>
          <select id="activity-timeline-metric" value={metric} onChange={event=>setSelection(event.target.value as GoogleTimelineMetric)}>
            {Object.entries(metrics).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}
          </select>
        </div>
    </header>
    {loading&&<p role="status" className="activity-chart-note">Loading activity…</p>}
    {error&&<div className="activity-chart-error"><p role="alert">{error}</p><button type="button" className="ui-button secondary" onClick={()=>{setPages([null]);setRetry(value=>value+1);}}>Reload records</button></div>}
    {timeline&&timeline.interval_count>0?<>
        {hours.some(hour=>hour[metric]!==null)?<div className="activity-hourly-chart" role="img" aria-label={`Hourly ${details.label.toLowerCase()} for ${date}. Exact values are in hourly totals.`}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={hours}>
            <CartesianGrid vertical={false} stroke="#eef0f4"/>
            <XAxis dataKey="start_time" tickFormatter={value=>time(value)} minTickGap={30} axisLine={false} tickLine={false} tick={{fill:'#606779',fontSize:12}}/>
            <YAxis width={38} axisLine={false} tickLine={false} tick={{fill:'#606779',fontSize:12}}/>
            <Tooltip cursor={{fill:'#fff4eb'}} labelFormatter={value=>{const hour=hours.find(row=>row.start_time===value);return hour?range(hour.start_time,hour.end_time,true):time(String(value),true);}}/>
            <Bar dataKey={metric} name={`${details.label} (${details.unit})`} fill="#d97736" maxBarSize={18} radius={[5,5,2,2]} isAnimationActive={false}/>
          </BarChart></ResponsiveContainer>
        </div>:<p className="activity-chart-empty">No hourly {details.label.toLowerCase()} available.</p>}
        <div className="activity-peak" data-testid="activity-peak"><span className="activity-peak-icon"><Clock aria-hidden="true"/></span><div><p>{details.peak}</p>
          {peaks.length?<><strong>{range(peaks[0].start_time,peaks[0].end_time)}</strong><span>{number(maximum)} {details.unit}{peaks.length>1?` · tied with ${peaks.length-1} other ${peaks.length===2?'period':'periods'}`:''}</span></>:<span>No positive {details.label.toLowerCase()} recorded.</span>}
        </div></div>
    </>:!loading&&!error&&<div className="activity-chart-empty"><Clock aria-hidden="true"/><p>Your hourly breakdown will appear here.</p></div>}
    {(Boolean(timeline?.interval_count)||days.some(day=>[day.steps,day.distance_km,day.active_minutes,day.active_calories_kcal].some(value=>value!=null)))&&<details className="activity-records activity-all-records"><summary>View activity records</summary>
      <label htmlFor="activity-record-view" className="sr-only">Record type</label><select id="activity-record-view" className="ui-input" value={recordView} onChange={event=>setRecordView(event.target.value)}><option value="timestamps">Original timestamps</option><option value="hours">Hourly totals</option><option value="days">Daily totals</option></select>
      {recordView==='hours'&&<>
          <div className="activity-records-scroll" tabIndex={0} role="region" aria-label="Hourly activity totals"><table>
            <caption className="sr-only">Hourly totals for {date} in {timezone}</caption>
            <thead><tr><th scope="col">Period</th><th scope="col">Steps</th><th scope="col">Distance (km)</th><th scope="col">Active calories (kcal)</th><th scope="col">Active time (min)</th></tr></thead>
            <tbody>{hours.map(hour=><tr key={hour.start_time}><th scope="row">{range(hour.start_time,hour.end_time,true)}</th><td>{number(hour.steps)}</td><td>{number(hour.distance_km)}</td><td>{number(hour.active_calories_kcal)}</td><td>{number(hour.active_minutes)}</td></tr>)}</tbody>
          </table></div>
      </>}
      {recordView==='timestamps'&&<>
          <p className="activity-record-note">{timeline?.interval_count.toLocaleString()??0} recorded intervals</p>
          <div className="activity-records-scroll" tabIndex={0} role="region" aria-label="Timestamped activity records"><table>
            <caption className="sr-only">Original activity intervals in {timezone}</caption>
            <thead><tr><th scope="col">Start</th><th scope="col">End</th><th scope="col">Metric</th><th scope="col">Value</th></tr></thead>
            <tbody>{timeline?.intervals.map(row=><tr key={`${row.start_time}:${row.metric}:${row.end_time}`}><td><time dateTime={row.start_time} title={row.start_time}>{timestamp(row.start_time)}</time></td><td><time dateTime={row.end_time} title={row.end_time}>{timestamp(row.end_time)}</time></td><td>{metrics[row.metric].label}</td><td>{number(row.value)} {metrics[row.metric].unit}</td></tr>)}</tbody>
          </table></div>
          <div className="activity-actions mt-4"><button type="button" className="ui-button secondary" disabled={loading||pages.length<2} onClick={()=>setPages(value=>value.slice(0,-1))}>Previous records</button>
            <button type="button" className="ui-button secondary" disabled={loading||Boolean(error)||!timeline?.next_cursor} onClick={()=>setPages(value=>[...value,timeline?.next_cursor??null])}>Next records</button></div>
      </>}
      {recordView==='days'&&<div className="activity-records-scroll" tabIndex={0} role="region" aria-label="Daily activity records table"><table><caption className="sr-only">Daily Google Health activity records</caption><thead><tr><th scope="col">Day</th><th scope="col">Steps</th><th scope="col">Distance (km)</th><th scope="col">Active calories (kcal)</th><th scope="col">Active time (min)</th></tr></thead><tbody>{days.map(day=><tr key={day.date}><th scope="row">{day.date}</th><td>{number(day.steps)}</td><td>{number(day.distance_km)}</td><td>{number(day.active_calories_kcal??null)}</td><td>{number(day.active_minutes??null)}</td></tr>)}</tbody></table></div>}
    </details>}
  </section>;
}
