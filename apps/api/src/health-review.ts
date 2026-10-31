import type {Pool} from 'pg';
import type {BodyReview,EnergyActivity,HealthReview} from '../../../shared/types/health-review';
import {transaction} from './db';
import {googleCalendarDay} from './google-health';

export const ENERGY_MODEL='DRI-EER-2023' as const;
// Health Canada/NASEM 2023 adult EER: intercept + age*y + height*cm + weight*kg.
// https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html
const coefficients:Record<'male'|'female',Record<EnergyActivity,readonly number[]>>={
  male:{inactive:[753.07,-10.83,6.50,14.10],low_active:[581.47,-10.83,8.30,14.94],active:[1004.82,-10.83,6.52,15.91],very_active:[-517.88,-10.83,15.61,19.11]},
  female:{inactive:[584.90,-7.01,5.72,11.71],low_active:[575.77,-7.01,6.60,12.14],active:[710.25,-7.01,6.54,12.34],very_active:[511.83,-7.01,9.07,12.56]},
};
const declared=(value:string|null|undefined)=>Boolean(value?.trim()&&!/^(none|no|n\/a|nil|not applicable|no (known )?(conditions|medications))$/i.test(value.trim()));
export function reviewAge(dob:unknown,today:string):number|null {
  const date=dob instanceof Date?dob.toISOString().slice(0,10):String(dob??'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>today)return null;
  const age=Number(today.slice(0,4))-Number(date.slice(0,4))-(today.slice(5)<date.slice(5)?1:0);
  return age>=0&&age<=120?age:null;
}
type BodyProfile=Partial<{dob:string|Date|null;height_cm:number|null;weight_kg:number|null;sex:string|null;energy_activity:EnergyActivity|null;nutrition_review:string;conditions:string|null;medications:string|null;weight_goal_type:'maintain'|'reduce'|'gain';goal_weight_kg:number|null}>;
export function bodyReview(profile:BodyProfile|null,today:string):BodyReview {
  const p=profile??{},age=reviewAge(p.dob,today),height=p.height_cm,weight=p.weight_kg;
  const valid=typeof height==='number'&&Number.isFinite(height)&&height>=50&&height<=250&&typeof weight==='number'&&Number.isFinite(weight)&&weight>=20&&weight<=300;
  const raw=valid?weight!/(height!/100)**2:null,adult=age!==null&&age>=20;
  const category=adult&&raw!==null?raw<18.5?'Underweight':raw<25?'Healthy range':raw<30?'Overweight':'Obesity range':null;
  const reasons:string[]=[];
  if(age===null)reasons.push('Add a valid date of birth.');
  if(!valid)reasons.push('Add your height and current weight.');
  if(p.sex!=='male'&&p.sex!=='female')reasons.push('The published energy equations need a supported sex input.');
  if(!p.energy_activity)reasons.push('Choose an energy activity category in your profile.');
  if(!p.nutrition_review||p.nutrition_review==='unknown')reasons.push('Complete the one-time energy estimate setup.');
  let status:BodyReview['energy_status']=reasons.length?'profile_needed':'ready';
  if(age!==null&&!adult){status='age_restricted';reasons.unshift('Adult weight and energy targets are unavailable below age 20.');}
  else if(p.nutrition_review==='required'||declared(p.conditions)||declared(p.medications)||adult&&raw!==null&&raw<18.5){status='review_required';reasons.unshift('Use an individual nutrition review for this profile.');}
  let energy:number|null=null;
  if(status==='ready'&&valid&&age!==null&&(p.sex==='male'||p.sex==='female')&&p.energy_activity){
    const c=coefficients[p.sex][p.energy_activity];
    if(c){const estimate=c[0]+c[1]*age+c[2]*height!+c[3]*weight!;if(Number.isFinite(estimate)&&estimate>0)energy=Math.round(estimate/10)*10;}
    if(energy===null){status='profile_needed';reasons.push('The supplied inputs do not support an energy estimate.');}
  }
  return {age_years:age,bmi:raw===null?null:Math.round(raw*10)/10,bmi_category:category,
    reference_kg:adult&&valid?[Math.round(18.5*(height!/100)**2*10)/10,Math.round(24.9*(height!/100)**2*10)/10]:null,
    maintenance_kcal:energy,energy_status:status,reasons,model:ENERGY_MODEL,energy_activity:p.energy_activity??null,
    goal_type:p.weight_goal_type??'maintain',goal_weight_kg:p.goal_weight_kg??null,current_weight_kg:weight??null};
}
export function shiftDay(day:string,offset:number){const date=new Date(`${day}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10);}
const sum=(rows:Record<string,number|null>[],key:string)=>rows.some(row=>row[key]!=null)?rows.reduce((total,row)=>total+(row[key]??0),0):null;
const iso=(value:Date|null|undefined)=>value?.toISOString()??null;
export async function healthReview(pool:Pool,user:number):Promise<HealthReview>{
  return transaction(pool,async client=>{
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const profile=(await client.query('SELECT * FROM profile WHERE user_id=$1',[user])).rows[0]??null;
    const zone=profile?.timezone||'Asia/Kolkata',today=googleCalendarDay(Date.now(),zone),first=shiftDay(today,-14),start=shiftDay(today,-7),end=shiftDay(today,-1);
    const connection=(await client.query('SELECT last_synced_at,error_code,metric_warnings FROM google_health_connections WHERE user_id=$1',[user])).rows[0];
    const rows=(await client.query('SELECT day::text AS date,steps,distance_km,active_minutes,active_calories_kcal,light_minutes,moderate_minutes,vigorous_minutes FROM google_health_days WHERE user_id=$1 AND timezone=$2 AND day BETWEEN $3 AND $4 ORDER BY day',[user,zone,first,end])).rows;
    const current=rows.filter(row=>row.date>=start),previous=rows.filter(row=>row.date<start);
    const feeds=(await client.query('SELECT feed,last_success_at,error_code FROM google_health_feed_state WHERE user_id=$1 ORDER BY feed',[user])).rows;
    const warnings=[...new Set<string>([...(connection?.metric_warnings??[]),...(connection?.error_code?[connection.error_code]:[]),...feeds.filter(row=>row.error_code).map(row=>row.feed)])];
    const steps=sum(current,'steps'),previousSteps=sum(previous,'steps');
    const enough=current.filter(row=>row.steps!=null).length===7&&previous.filter(row=>row.steps!=null).length===7;
    const failure=Boolean(connection?.error_code||feeds.find(row=>row.feed==='steps')?.error_code);
    const comparison:HealthReview['activity']['comparison']={status:failure?'refresh_failed':!enough?'insufficient':previousSteps===0?'zero_baseline':'ready',step_delta:enough&&!failure?steps!-previousSteps!:null,step_percent:enough&&!failure&&previousSteps!>0?Math.round((steps!-previousSteps!)/previousSteps!*1000)/10:null,previous_steps:previousSteps};
    const recordedDays=current.filter(row=>['steps','distance_km','active_minutes','active_calories_kcal'].some(key=>row[key]!=null)).length;
    const movementDays=current.filter(row=>row.steps>0||row.distance_km>0||row.active_minutes>0).length;
    const recurring=(await client.query(`WITH daily AS (
      SELECT day,EXTRACT(HOUR FROM start_at AT TIME ZONE $2)::int AS hour,
        BOOL_OR((metric='steps' OR metric='active_minutes') AND value>0) AS moved,
        SUM(value) FILTER(WHERE metric='active_minutes') AS active_minutes
      FROM google_health_hour_totals WHERE user_id=$1 AND timezone=$2 AND day BETWEEN $3 AND $4 GROUP BY day,hour
    ) SELECT hour,COUNT(*) FILTER(WHERE moved)::int AS days,SUM(active_minutes) FILTER(WHERE moved) AS active_minutes
      FROM daily GROUP BY hour HAVING COUNT(*) FILTER(WHERE moved)>0 ORDER BY days DESC,active_minutes DESC NULLS LAST,hour LIMIT 3`,[user,zone,first,end])).rows;
    const hourlyDays=(await client.query('SELECT COUNT(DISTINCT day)::int AS count FROM google_health_hour_totals WHERE user_id=$1 AND timezone=$2 AND day BETWEEN $3 AND $4',[user,zone,first,end])).rows[0].count;
    const exercises=(await client.query(`SELECT start_at,end_at,exercise_type,source FROM google_health_exercises WHERE user_id=$1 AND end_at>$2::date::timestamp AT TIME ZONE $3 AND start_at<$4::date::timestamp AT TIME ZONE $3 ORDER BY start_at DESC LIMIT 10`,[user,first,zone,today])).rows;
    const matches=(await client.query(`WITH chosen AS (SELECT id FROM devices WHERE user_id=$1 AND active AND revoked_at IS NULL),
      readings AS (SELECT observed_at,heart_rate,source,0 AS priority FROM vitals WHERE user_id=$1 AND device_id=(SELECT id FROM chosen) AND observed_at>=NOW()-INTERVAL '7 days'
      UNION ALL SELECT observed_at,(equipment->>'heart_rate')::double precision,source,1 FROM equipment_history WHERE user_id=$1 AND device_id=(SELECT id FROM chosen) AND observed_at>=NOW()-INTERVAL '7 days'),
      unique_readings AS (SELECT DISTINCT ON(observed_at) * FROM readings WHERE heart_rate BETWEEN 20 AND 250 AND source=ANY($3::text[]) ORDER BY observed_at,priority)
      SELECT r.observed_at,r.heart_rate,r.source,i.start_at,i.end_at FROM unique_readings r JOIN LATERAL (
        SELECT start_at,end_at FROM google_health_intervals WHERE user_id=$1 AND timezone=$2 AND metric='steps' AND value>0 AND start_at<=r.observed_at AND end_at>r.observed_at ORDER BY end_at-start_at LIMIT 1
      ) i ON TRUE ORDER BY r.observed_at DESC LIMIT 3`,[user,zone,['ESP32_MAX30102_DS18B20_AD8232','ESP32_RealVitals_SimulatedSteps']])).rows;
    const weights=(await client.query('SELECT id::text,weight_kg,observed_at,source FROM weight_measurements WHERE user_id=$1 ORDER BY observed_at DESC,id DESC LIMIT 60',[user])).rows;
    const facts:HealthReview['facts']=[];
    if(connection&&recordedDays)facts.push({id:'consistency',title:'Your recorded movement',detail:`Movement was recorded on ${movementDays} of the last 7 completed days. Records are available for ${recordedDays} days.`});
    if(comparison.status==='ready')facts.push({id:'comparison',title:'Compared with the previous week',detail:`Recorded steps ${comparison.step_percent===0?'were unchanged':`${comparison.step_percent!>0?'increased':'decreased'} by ${Math.abs(comparison.step_percent!)}%`} across two seven-day periods.`});
    if(matches.length)facts.push({id:'context',title:'Readings alongside movement',detail:`${matches.length} recent heart-rate ${matches.length===1?'observation overlaps':'observations overlap'} recorded step intervals. This describes timing, not a cause.`});
    return {generated_at:new Date().toISOString(),timezone:zone,today,body:bodyReview(profile,today),weights:weights.map(row=>({...row,observed_at:iso(row.observed_at)!})),facts,
      activity:{connected:Boolean(connection),last_synced_at:iso(connection?.last_synced_at),warnings,feeds:feeds.map(row=>({...row,last_success_at:iso(row.last_success_at)})),period:{start,end},previous_period:{start:first,end:shiftDay(start,-1)},movement_days:movementDays,recorded_days:recordedDays,steps,distance_km:sum(current,'distance_km'),active_minutes:sum(current,'active_minutes'),active_calories_kcal:sum(current,'active_calories_kcal'),comparison,
        recurring:recurring.map(row=>({...row,recorded_days:hourlyDays})),intensity:{light:sum(current,'light_minutes'),moderate:sum(current,'moderate_minutes'),vigorous:sum(current,'vigorous_minutes')},
        exercises:exercises.map(row=>({start_time:iso(row.start_at)!,end_time:iso(row.end_at)!,type:row.exercise_type,source:row.source})),
        matches:matches.map(row=>({observed_at:iso(row.observed_at)!,heart_rate:row.heart_rate,activity_start:iso(row.start_at)!,activity_end:iso(row.end_at)!,source:row.source}))}};
  });
}
