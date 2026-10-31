import type {PoolClient} from 'pg';
import {z} from 'zod';
import type {GoogleActivityInterval,GoogleActivityMetric,GoogleHealthDay} from '../../../shared/types/google-health';
export type ExerciseRecord={start_time:string;end_time:string;exercise_type:string;active_seconds:number|null;source:string};
export function parseExercises(points:unknown[],now=Date.now()):ExerciseRecord[]{
  const schema=z.object({interval:z.object({startTime:z.iso.datetime({offset:true}),endTime:z.iso.datetime({offset:true})}),exerciseType:z.string().regex(/^[A-Z_]+$/).max(100),activeDuration:z.string().regex(/^\d+(\.\d+)?s$/).optional()});
  const records=new Map<string,ExerciseRecord>();
  for(const point of points){
    const raw=z.record(z.string(),z.unknown()).parse(point),exercise=schema.parse(raw.exercise);
    const start=Date.parse(exercise.interval.startTime),end=Date.parse(exercise.interval.endTime),duration=exercise.activeDuration?Number(exercise.activeDuration.slice(0,-1)):null;
    if(end<=start||end>now+300000||end-start>7*86400000||duration!==null&&duration>(end-start)/1000)throw Error('Invalid exercise interval');
    const record={start_time:new Date(start).toISOString(),end_time:new Date(end).toISOString(),exercise_type:exercise.exerciseType,active_seconds:duration,source:'Google Health'};
    records.set(`${record.start_time}:${record.end_time}:${record.exercise_type}`,record);
  }
  return [...records.values()];
}
export async function persistGoogleActivity(client:PoolClient,input:{user:number;generation:string;zone:string;first:string;today:string;rawFirst:string;days:GoogleHealthDay[];intervals:GoogleActivityInterval[];warnings:GoogleActivityMetric[];exercises:ExerciseRecord[]|null;backfill:boolean;failedFeeds:string[];intervalSeconds?:number}){
  const {user,generation,zone,first,today,rawFirst,days,intervals,warnings,exercises,backfill,failedFeeds}=input;
  const current=await client.query('SELECT user_id FROM google_health_connections WHERE user_id=$1 AND generation=$2 FOR UPDATE',[user,generation]);
  if(!current.rowCount)return;
  const success=['steps','distance_km','active_calories_kcal','active_minutes'].filter(metric=>!warnings.includes(metric as GoogleActivityMetric));
  await client.query(`DELETE FROM google_health_intervals WHERE user_id=$1 AND (timezone<>$2 OR day<$3 OR (day BETWEEN $4 AND $5 AND metric=ANY($6::text[])))`,[user,zone,rawFirst,first,today,success]);
  await client.query(`DELETE FROM google_health_hour_totals WHERE user_id=$1 AND (timezone<>$2 OR (day BETWEEN $3 AND $4 AND metric=ANY($5::text[])))`,[user,zone,first,today,success]);
  // Keep fifteen derived dates during a short incremental import, rather than pruning to that import's first date.
  const historyFirst=new Date(`${today}T12:00:00Z`);historyFirst.setUTCDate(historyFirst.getUTCDate()-14);
  await client.query('DELETE FROM google_health_hour_totals WHERE user_id=$1 AND day<$2',[user,historyFirst.toISOString().slice(0,10)]);
  await client.query(`INSERT INTO google_health_intervals(user_id,timezone,day,metric,start_at,end_at,value)
    SELECT $1,$2,(start_time AT TIME ZONE $2)::date,metric,start_time,end_time,value FROM jsonb_to_recordset($3::jsonb)
      AS r(metric text,start_time timestamptz,end_time timestamptz,value double precision)
      WHERE (start_time AT TIME ZONE $2)::date >= $4`,[user,zone,JSON.stringify(intervals),rawFirst]);
  await client.query(`WITH raw AS (
      SELECT *, (start_time AT TIME ZONE $2)::date AS day FROM jsonb_to_recordset($3::jsonb) AS r(metric text,start_time timestamptz,end_time timestamptz,value double precision)
    ), timed AS (
      SELECT *,day::timestamp AT TIME ZONE $2 AS midnight,(day+1)::timestamp AT TIME ZONE $2 AS day_end FROM raw
    ), bucketed AS (
      SELECT *,midnight+FLOOR(EXTRACT(EPOCH FROM (start_time-midnight))/3600)*INTERVAL '1 hour' AS hour_start FROM timed
    ) INSERT INTO google_health_hour_totals(user_id,timezone,day,start_at,end_at,metric,value,record_count)
      SELECT $1,$2,day,hour_start,LEAST(hour_start+INTERVAL '1 hour',day_end),metric,SUM(value),COUNT(*)::int
      FROM bucketed WHERE end_time<=LEAST(hour_start+INTERVAL '1 hour',day_end) GROUP BY day,hour_start,day_end,metric`,[user,zone,JSON.stringify(intervals)]);
  for(const day of days)await client.query(`INSERT INTO google_health_days(user_id,timezone,day,steps,distance_km,active_calories_kcal,active_minutes,light_minutes,moderate_minutes,vigorous_minutes)
    VALUES($1,$2,$3,$4,$5,$6,$7,$10,$11,$12) ON CONFLICT(user_id,timezone,day) DO UPDATE SET steps=EXCLUDED.steps,distance_km=EXCLUDED.distance_km,
    active_calories_kcal=CASE WHEN $8 THEN google_health_days.active_calories_kcal ELSE EXCLUDED.active_calories_kcal END,
    active_minutes=CASE WHEN $9 THEN google_health_days.active_minutes ELSE EXCLUDED.active_minutes END,
    light_minutes=CASE WHEN $9 THEN google_health_days.light_minutes ELSE EXCLUDED.light_minutes END,
    moderate_minutes=CASE WHEN $9 THEN google_health_days.moderate_minutes ELSE EXCLUDED.moderate_minutes END,
    vigorous_minutes=CASE WHEN $9 THEN google_health_days.vigorous_minutes ELSE EXCLUDED.vigorous_minutes END`,
    [user,zone,day.date,day.steps,day.distance_km,day.active_calories_kcal,day.active_minutes,warnings.includes('active_calories_kcal'),warnings.includes('active_minutes'),day.light_minutes??null,day.moderate_minutes??null,day.vigorous_minutes??null]);
  if(exercises!==null){
    await client.query(`DELETE FROM google_health_exercises WHERE user_id=$1 AND (start_at<($2::date::timestamp AT TIME ZONE $3) OR (start_at>=($4::date::timestamp AT TIME ZONE $3) AND start_at<(($5::date+1)::timestamp AT TIME ZONE $3)))`,[user,historyFirst.toISOString().slice(0,10),zone,first,today]);
    await client.query(`INSERT INTO google_health_exercises(user_id,start_at,end_at,exercise_type,active_seconds,source)
      SELECT $1,start_time,end_time,exercise_type,active_seconds,source FROM jsonb_to_recordset($2::jsonb) AS r(start_time timestamptz,end_time timestamptz,exercise_type text,active_seconds double precision,source text)`,[user,JSON.stringify(exercises)]);
  }
  for(const feed of ['steps','distance','active-energy-burned','active-minutes','exercise']){
    const failed=failedFeeds.includes(feed);
    await client.query(`INSERT INTO google_health_feed_state(user_id,feed,last_attempt_at,last_success_at,error_code) VALUES($1,$2,NOW(),CASE WHEN $3 THEN NULL ELSE NOW() END,CASE WHEN $3 THEN 'unavailable' ELSE NULL END)
      ON CONFLICT(user_id,feed) DO UPDATE SET last_attempt_at=NOW(),last_success_at=CASE WHEN $3 THEN google_health_feed_state.last_success_at ELSE NOW() END,error_code=CASE WHEN $3 THEN 'unavailable' ELSE NULL END`,[user,feed,failed]);
  }
  await client.query(`UPDATE google_health_connections SET last_synced_at=NOW(),error_code=NULL,metric_warnings=$2,
    sync_failures=0,next_sync_at=NOW()+make_interval(secs=>$3),history_synced_at=CASE WHEN $4 THEN NOW() ELSE history_synced_at END WHERE user_id=$1`,[user,warnings,(input.intervalSeconds??120)+Math.floor(Math.random()*16),backfill]);
}
