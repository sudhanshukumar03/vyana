import {ArrowUpRight,Heart,TrendingDown,TrendingUp,Clock,Footprints} from 'lucide-react';
import {Link} from 'react-router-dom';
import type {HealthReview as Review} from '../../../../shared/types/health-review';
import {useHealthReview} from '../services/useHealthReview';

const fmt=(value:number|null|undefined,decimals=0)=>value==null?'—':value.toLocaleString(undefined,{maximumFractionDigits:decimals});
const activityName=(value:string)=>value.toLowerCase().replace(/_/g,' ').replace(/^\w/,letter=>letter.toUpperCase());

export function ReviewHighlights({data}:{data:Review}){
  if(!data.facts.length)return <p className="review-muted">Weekly telemetry will populate as device sync completes.</p>;
  return <div className="review-highlights">{data.facts.slice(0,3).map(fact=><div key={fact.id}><span/><p>{fact.detail}</p></div>)}</div>;
}

export function HealthReviewSection({compact=false}:{compact?:boolean}){
  const {data,error,loading,reload}=useHealthReview();
  if(compact)return <div className="review-dashboard"><h2>Your health review</h2>{data?<ReviewHighlights data={data}/>:<p className="review-muted">{loading?'Preparing your review…':error||'Activity history is not available yet.'}</p>}<Link to="/wellness">View your review<ArrowUpRight aria-hidden="true"/></Link></div>;
  return <section className="health-review-panel" id="health-review" aria-labelledby="weekly-review-title">
    <header className="review-section-heading"><div><h2 id="weekly-review-title">Your week in movement</h2><p>{data?`${data.activity.period.start} to ${data.activity.period.end}`:'Recorded activity telemetry'}</p></div></header>
    {error&&<div role="alert" className="review-error">{error}<button type="button" onClick={reload}>Try again</button></div>}
    {!data?<p role="status" className="review-muted">{loading?'Preparing activity review…':'No review available.'}</p>:<ActivityReview data={data}/>}
  </section>;
}

export function ActivityReview({data}:{data:Review}){
  const a=data.activity,change=a.comparison,Trend=(change.step_percent??0)<0?TrendingDown:TrendingUp;
  const time=(value:string)=>new Date(value).toLocaleString(undefined,{timeZone:data.timezone,month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  return <>
    {!a.connected?<div className="review-empty"><Footprints aria-hidden="true"/><p>Connect Google Health in Activity to sync weekly movement records.</p><Link to="/activity">Open Activity<ArrowUpRight aria-hidden="true"/></Link></div>:<>
      <div className="review-week-metrics"><div><strong>{a.movement_days}<span>/ 7 days</span></strong><p>Active movement days</p></div><div><strong>{fmt(a.steps)}</strong><p>Recorded steps</p></div><div><strong>{fmt(a.active_minutes)}<span> min</span></strong><p>Recorded active time</p></div></div>
      {Boolean(a.warnings.length)&&<p role="status" className="review-warning">Some telemetry records could not refresh. Displaying cached records.</p>}
      <div className="review-comparison"><span className="review-icon"><Trend aria-hidden="true"/></span><div><h3>Previous week comparison</h3>{change.status==='ready'?<p><strong>{Math.abs(change.step_percent!)}% {change.step_percent!<0?'fewer':change.step_percent!>0?'more':'change in'} recorded steps</strong><span>{fmt(a.steps)} vs {fmt(change.previous_steps)} · {data.activity.previous_period.start} to {data.activity.previous_period.end}</span></p>:<p>{change.status==='refresh_failed'?'Telemetry sync required before computing comparison.':change.status==='zero_baseline'?`${fmt(change.step_delta)} additional recorded steps vs zero baseline.`:'Additional daily logs required for weekly comparison.'}</p>}</div></div>
      {a.recurring.length>0&&<div className="review-routine"><h3><Clock aria-hidden="true"/>Movement distribution</h3>{a.recurring.map(slot=><div key={slot.hour}><strong>{String(slot.hour).padStart(2,'0')}:00–{String((slot.hour+1)%24).padStart(2,'0')}:00</strong><span>{slot.days} of {slot.recorded_days} recorded days</span></div>)}</div>}
      {a.exercises.length>0&&<div className="review-workouts"><h3>Reported activities</h3>{a.exercises.slice(0,3).map(exercise=><div key={`${exercise.start_time}:${exercise.type}`}><span className="review-workout-type">{activityName(exercise.type)}</span><p>{time(exercise.start_time)} – {time(exercise.end_time)}<small>Reported by {exercise.source}</small></p></div>)}</div>}
      <details className="review-details"><summary>Intensity breakdown</summary><div className="review-intensity"><span>Light <strong>{fmt(a.intensity.light)} min</strong></span><span>Moderate <strong>{fmt(a.intensity.moderate)} min</strong></span><span>Vigorous <strong>{fmt(a.intensity.vigorous)} min</strong></span></div></details>
    </>}
    {a.matches.length>0&&<div className="review-sensor-context"><h3><Heart aria-hidden="true"/>Readings alongside movement</h3>{a.matches.map(match=><div key={match.observed_at}><strong>{fmt(match.heart_rate)} <span>bpm</span></strong><p>{time(match.observed_at)}<span>Active interval: {time(match.activity_start)} – {time(match.activity_end)}</span></p></div>)}</div>}
  </>;
}
