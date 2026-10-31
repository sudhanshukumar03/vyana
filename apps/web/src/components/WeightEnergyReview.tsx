import {useState,type FormEvent} from 'react';
import {LineChart,Line,XAxis,YAxis,Tooltip,ResponsiveContainer,ReferenceLine} from 'recharts';
import {ArrowUpRight,ArrowDownRight,SlidersHorizontal,Plus,Flame,Info,X} from 'lucide-react';
import {WeightScaleIcon} from './WeightScaleIcon';
import type {HealthReview} from '../../../../shared/types/health-review';
import type {Profile} from '../../../../shared/types/health';
import {useHealthStore} from '../store/useHealthStore';
import {getSessionEpoch} from '../services/api';
import {useHealthReview} from '../services/useHealthReview';
import {Modal} from './Modal';
import {ActivityReview} from './HealthReview';

const fmt=(value:number|null|undefined,decimals=1)=>value==null?'—':value.toLocaleString(undefined,{maximumFractionDigits:decimals});
const activities={inactive:'Inactive',low_active:'Low active',active:'Active',very_active:'Very active'};
export function WeightEnergyReview(){
  const {data,error,loading,reload}=useHealthReview();
  const profile=useHealthStore(state=>state.profile);
  const [dialog,setDialog]=useState<'profile'|'weight'|null>(null);
  const saved=async()=>{setDialog(null);reload();};
  return <>
    {error&&<div role="alert" className="review-error">{error}<button type="button" onClick={reload}>Try again</button></div>}
    {!data?<section className="health-review-panel"><p role="status" className="review-muted">{loading?'Preparing health review…':'Review is not available.'}</p></section>:<>
      <div className="review-body-grid">
        <section className="review-weight-card" aria-labelledby="weight-review-title">
          <header className="review-section-heading">
            <div>
              <span className="review-label"><WeightScaleIcon aria-hidden="true"/>Body Mass Tracking</span>
              <h2 id="weight-review-title">Your weight over time</h2>
            </div>
            <button type="button" className="review-button secondary" onClick={()=>setDialog('weight')}><Plus aria-hidden="true"/>Add weight</button>
          </header>
          <div className="review-weight-current"><strong>{fmt(data.body.current_weight_kg)}<span> kg</span></strong><p>{data.weights.length?'Latest recorded body mass':'Profile baseline · No timeline points logged'}</p></div>
          <WeightChart data={data}/>
          <div className="review-weight-bottom"><div><span>Selected goal</span><strong>{data.body.goal_type==='maintain'?'Maintain weight':`${data.body.goal_type==='reduce'?'Reduce':'Gain'}${data.body.goal_weight_kg?` to ${fmt(data.body.goal_weight_kg)} kg`:''}`}</strong></div><button type="button" className="review-text-link" onClick={()=>setDialog('profile')}>Edit plan<ArrowUpRight aria-hidden="true"/></button></div>
        </section>
        <section className="review-energy-card" aria-labelledby="energy-review-title">
          <header className="review-section-heading">
            <div>
              <span className="review-label"><Flame aria-hidden="true"/>Metabolic Energy</span>
              <h2 id="energy-review-title">Estimated maintenance</h2>
            </div>
            {data.body.maintenance_kcal!==null&&<button type="button" className="review-icon-button" aria-label="Edit energy profile" onClick={()=>setDialog('profile')}><SlidersHorizontal aria-hidden="true"/></button>}
          </header>
          {data.body.maintenance_kcal!==null?<><strong className="review-energy-number">{fmt(data.body.maintenance_kcal,0)}<span> kcal / day</span></strong><p>Estimated daily baseline caloric expenditure for weight stabilization.</p><span className="review-energy-category">{data.body.energy_activity?activities[data.body.energy_activity]:''} lifestyle</span></>:
            <div className="review-energy-unavailable"><Info aria-hidden="true"/><strong>{data.body.energy_status==='review_required'?'Clinical review required':data.body.energy_status==='age_restricted'?'Adult estimates unavailable':'Profile calibration required'}</strong><p>{data.body.reasons[0]??'Complete your profile parameters to calculate metabolic maintenance.'}</p><button type="button" className="review-button" onClick={()=>setDialog('profile')}>Review profile<ArrowUpRight aria-hidden="true"/></button></div>}
        </section>
      </div>
      <section className="review-bmi-row" aria-label="BMI and reference weight">
        <div className="review-bmi-tile">
          <span>Body Mass Index</span>
          <strong>{fmt(data.body.bmi)}</strong>
          {data.body.bmi_category&&<span className="review-badge">{data.body.bmi_category}</span>}
        </div>
        <div className="review-bmi-tile">
          <span>Healthy Reference</span>
          <strong>{data.body.reference_kg?`${fmt(data.body.reference_kg[0])}–${fmt(data.body.reference_kg[1])}`:'—'}<small> kg</small></strong>
          <span className="review-subtext">{profile?.height_cm?`Calibrated for ${profile.height_cm} cm`:'Standard reference (18.5–24.9)'}</span>
        </div>
        <div className="review-bmi-tile">
          <span>Target Trajectory</span>
          <strong>{data.body.goal_type==='maintain'?'Maintain Weight':`${data.body.goal_type==='reduce'?'Reduction':'Gain'}${data.body.goal_weight_kg?` (${fmt(data.body.goal_weight_kg)} kg)`:''}`}</strong>
          <span className="review-subtext">Active clinical objective</span>
        </div>
      </section>
      <section className="health-review-panel" aria-labelledby="wellness-week-title"><header className="review-section-heading"><div><h2 id="wellness-week-title">Your week in movement</h2><p>{data.activity.period.start} to {data.activity.period.end} · 7-day cycle</p></div></header><ActivityReview data={data}/></section>
    </>}
    {dialog==='profile'&&<EnergyProfileForm profile={profile} onClose={()=>setDialog(null)} onSaved={saved}/>}
    {dialog==='weight'&&<WeightForm initial={profile?.weight_kg??null} onClose={()=>setDialog(null)} onSaved={saved}/>}
  </>;
}
function WeightChart({data}:{data:HealthReview}){
  const points=[...data.weights].sort((a,b)=>Date.parse(a.observed_at)-Date.parse(b.observed_at)),change=points.length>1?points.at(-1)!.weight_kg-points[0].weight_kg:null,Trend=(change??0)<0?ArrowDownRight:ArrowUpRight;
  return <>
    {points.length>1?<><div className="review-weight-change"><Trend aria-hidden="true"/>{fmt(Math.abs(change!),1)} kg {(change??0)<0?'decrease':change===0?'stable':'increase'} across {points.length} entries</div>
      <div className="review-weight-chart" role="img" aria-label="Your recorded weight updates. Exact values are in weight records."><ResponsiveContainer width="100%" height="100%"><LineChart data={points} margin={{left:0,right:12,top:14,bottom:0}}><XAxis dataKey="observed_at" tickFormatter={value=>new Date(value).toLocaleDateString(undefined,{timeZone:data.timezone,day:'numeric',month:'short'})} minTickGap={42} axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#646e70'}}/><YAxis domain={['dataMin - 1','dataMax + 1']} width={36} tick={{fontSize:11,fill:'#646e70'}} axisLine={false} tickLine={false}/><Tooltip labelFormatter={value=>new Date(String(value)).toLocaleString(undefined,{timeZone:data.timezone})}/>{data.body.goal_weight_kg&&<ReferenceLine y={data.body.goal_weight_kg} stroke="#82779f" strokeDasharray="4 4"/>}<Line type="linear" dataKey="weight_kg" name="Weight (kg)" stroke="#2563eb" strokeWidth={2.5} dot={{r:3,fill:'#2563eb'}} isAnimationActive={false}/></LineChart></ResponsiveContainer></div></>:
      <div className="review-weight-chart-empty"><WeightScaleIcon aria-hidden="true"/><p>{points.length?'Single observation logged. Multi-point trajectory populates with 2+ updates.':'No historical logs recorded. Add weight entries to track trajectory.'}</p></div>}
    {points.length>0&&<details className="review-details"><summary>Weight records ({points.length})</summary><div className="review-table-scroll" tabIndex={0} role="region" aria-label="Weight records"><table><thead><tr><th scope="col">Recorded</th><th scope="col">Weight</th><th scope="col">Source</th></tr></thead><tbody>{data.weights.map(point=><tr key={point.id}><th scope="row"><time dateTime={point.observed_at}>{new Date(point.observed_at).toLocaleString(undefined,{timeZone:data.timezone})}</time></th><td>{fmt(point.weight_kg)} kg</td><td>{point.source==='profile'?'Profile update':'Manual entry'}</td></tr>)}</tbody></table></div></details>}
  </>;
}
function EnergyProfileForm({profile,onClose,onSaved}:{profile:Profile|null;onClose:()=>void;onSaved:()=>Promise<void>}){
  const [form,setForm]=useState({dob:profile?.dob?String(profile.dob).slice(0,10):'',sex:profile?.sex??'',height:String(profile?.height_cm??''),weight:String(profile?.weight_kg??''),activity:profile?.energy_activity??'',review:profile?.nutrition_review??'unknown',goal:profile?.weight_goal_type??'maintain',target:String(profile?.goal_weight_kg??'')});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const update=(key:keyof typeof form,value:string)=>setForm(previous=>({...previous,[key]:value}));
  const save=async(event:FormEvent)=>{event.preventDefault();setBusy(true);setError('');const epoch=getSessionEpoch();
    try{const saved=await useHealthStore.getState().saveProfile({dob:form.dob||null,sex:form.sex||null,height_cm:Number(form.height),weight_kg:Number(form.weight),energy_activity:form.activity?(form.activity as NonNullable<Profile['energy_activity']>):null,nutrition_review:form.review,weight_goal_type:form.goal,goal_weight_kg:form.goal==='maintain'||!form.target?null:Number(form.target)});if(!saved)throw new Error(useHealthStore.getState().error||'Could not save your profile.');if(epoch===getSessionEpoch())await onSaved();}
    catch(reason){if(epoch===getSessionEpoch())setError(reason instanceof Error?reason.message:'Could not save your profile.');}finally{setBusy(false);}
  };
  return <Modal title="Your weight & energy profile" onClose={onClose} className="review-profile-dialog"><form onSubmit={event=>void save(event)} className="review-profile-form"><header className="review-dialog-heading"><h2>Your weight & energy profile</h2><button type="button" onClick={onClose} aria-label="Close energy profile"><X aria-hidden="true"/></button></header><div className="review-form-grid">
    <label>Date of birth<input type="date" className="ui-input" value={form.dob} onChange={event=>update('dob',event.target.value)}/></label>
    <label>Sex used by the energy equation<select className="ui-input" value={form.sex} onChange={event=>update('sex',event.target.value)}><option value="">Not provided</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other / unsupported by this equation</option></select></label>
    <label>Height (cm)<input type="number" className="ui-input" min="50" max="250" step="0.1" required value={form.height} onChange={event=>update('height',event.target.value)}/></label>
    <label>Current weight (kg)<input type="number" className="ui-input" min="20" max="300" step="0.1" required value={form.weight} onChange={event=>update('weight',event.target.value)}/></label>
    </div>
    <label>Usual activity category<select className="ui-input" value={form.activity} onChange={event=>update('activity',event.target.value)}><option value="">Not selected</option>{Object.entries(activities).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <p className="review-form-help">Select baseline physical activity level across daily routine.</p>
    <fieldset><legend>Suitability for a general energy estimate</legend><label className="review-radio"><input type="radio" name="nutrition-review" value="standard" checked={form.review==='standard'} onChange={()=>update('review','standard')}/><span>Standard screening criteria applies.</span></label><label className="review-radio"><input type="radio" name="nutrition-review" value="required" checked={form.review==='required'} onChange={()=>update('review','required')}/><span>Individual clinical nutrition review required.</span></label><p className="review-form-help">Screening applies standard DRI calculation criteria.</p></fieldset>
    <div className="review-form-grid"><label>Your goal<select className="ui-input" value={form.goal} onChange={event=>update('goal',event.target.value)}><option value="maintain">Maintain weight</option><option value="reduce">Reduce weight</option><option value="gain">Gain weight</option></select></label>{form.goal!=='maintain'&&<label>Selected goal weight (kg), optional<input type="number" className="ui-input" min="20" max="300" step="0.1" value={form.target} onChange={event=>update('target',event.target.value)}/></label>}</div>
    {error&&<p role="alert" className="review-error">{error}</p>}<div className="review-form-actions"><button type="button" className="review-button secondary" onClick={onClose}>Cancel</button><button type="submit" disabled={busy} className="review-button">{busy?'Saving…':'Save profile'}</button></div>
  </form></Modal>;
}
function WeightForm({initial,onClose,onSaved}:{initial:number|null;onClose:()=>void;onSaved:()=>Promise<void>}){
  const [weight,setWeight]=useState(initial==null?'':String(initial)),[timestamp]=useState(()=>new Date().toISOString()),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const save=async(event:FormEvent)=>{event.preventDefault();setBusy(true);setError('');const epoch=getSessionEpoch();try{const saved=await useHealthStore.getState().recordWeight(Number(weight),timestamp);if(!saved)throw new Error(useHealthStore.getState().error||'Could not record your weight.');if(epoch===getSessionEpoch())await onSaved();}catch(reason){if(epoch===getSessionEpoch())setError(reason instanceof Error?reason.message:'Could not record your weight.');}finally{setBusy(false);}};
  return <Modal title="Add a weight update" onClose={onClose}><form className="review-profile-form" onSubmit={event=>void save(event)}><header className="review-dialog-heading"><h2>Add a weight update</h2><button type="button" onClick={onClose} aria-label="Close weight update"><X aria-hidden="true"/></button></header><label>Weight (kg)<input autoFocus type="number" className="ui-input" min="20" max="300" step="0.1" required value={weight} onChange={event=>setWeight(event.target.value)}/></label>{error&&<p role="alert" className="review-error">{error}</p>}<div className="review-form-actions"><button type="button" className="review-button secondary" onClick={onClose}>Cancel</button><button type="submit" className="review-button" disabled={busy}>{busy?'Saving…':'Save weight'}</button></div></form></Modal>;
}
