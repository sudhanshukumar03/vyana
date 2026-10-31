import type {Pool} from 'pg';
import {z} from 'zod';
import {transaction} from './db';
import {HttpError} from './auth';
import type {GoogleActivityTimeline} from '../../../shared/types/google-health';

const cursorSchema=z.object({start:z.iso.datetime(),end:z.iso.datetime(),
  metric:z.enum(['steps','distance_km','active_calories_kcal','active_minutes']),version:z.string().nullable()});
const iso=(value:Date|null)=>value?.toISOString()??null;
/** Read one account-owned day atomically. Long intervals are never divided into invented hourly observations. */
export async function readGoogleTimeline(pool:Pool,user:number,timezone:string,date:string,rawCursor:unknown):Promise<GoogleActivityTimeline> {
  let cursor:z.infer<typeof cursorSchema>|null=null;
  if(rawCursor!==undefined){
    try{
      if(typeof rawCursor!=='string'||rawCursor.length>1024||!/^[\w-]+$/.test(rawCursor))throw Error();
      cursor=cursorSchema.parse(JSON.parse(Buffer.from(rawCursor,'base64url').toString()));
    }catch{throw new HttpError(400,'Invalid activity cursor.');}
  }
  return transaction(pool,async client=>{
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const connection=(await client.query('SELECT last_synced_at,metric_warnings FROM google_health_connections WHERE user_id=$1',[user])).rows[0];
    const version=iso(connection?.last_synced_at??null);
    if(cursor&&cursor.version!==version)throw new HttpError(409,'Activity changed during pagination. Return to the first records.');
    const hours=(await client.query(`WITH bounds AS (
        SELECT $3::date::timestamp AT TIME ZONE $2 AS lo, ($3::date+1)::timestamp AT TIME ZONE $2 AS hi
      ), slots AS (
        SELECT t AS start_at,LEAST(t+INTERVAL '1 hour',hi) AS end_at
        FROM bounds,LATERAL generate_series(lo,hi-INTERVAL '1 microsecond',INTERVAL '1 hour') t
      ) SELECT s.start_at,s.end_at,COUNT(i.metric)::int AS included,
        SUM(i.value) FILTER(WHERE i.metric='steps') AS steps,
        SUM(i.value) FILTER(WHERE i.metric='distance_km') AS distance_km,
        SUM(i.value) FILTER(WHERE i.metric='active_calories_kcal') AS active_calories_kcal,
        SUM(i.value) FILTER(WHERE i.metric='active_minutes') AS active_minutes
      FROM slots s LEFT JOIN google_health_intervals i ON i.user_id=$1 AND i.timezone=$2 AND i.day=$3
        AND i.start_at>=s.start_at AND i.start_at<s.end_at AND i.end_at<=s.end_at
      GROUP BY s.start_at,s.end_at ORDER BY s.start_at`,[user,timezone,date])).rows;
    const total=(await client.query('SELECT COUNT(*)::int AS count FROM google_health_intervals WHERE user_id=$1 AND timezone=$2 AND day=$3',[user,timezone,date])).rows[0].count as number;
    const rows=(await client.query(`SELECT metric,start_at,end_at,value FROM google_health_intervals
      WHERE user_id=$1 AND timezone=$2 AND day=$3
        AND ($4::timestamptz IS NULL OR (start_at,metric,end_at)>($4::timestamptz,$5::text,$6::timestamptz))
      ORDER BY start_at,metric,end_at LIMIT 101`,[user,timezone,date,cursor?.start??null,cursor?.metric??null,cursor?.end??null])).rows;
    const page=rows.slice(0,100),last=page.at(-1);
    return {date,timezone,last_synced_at:version,metric_warnings:connection?.metric_warnings??[],
      interval_count:total,unallocated_intervals:total-hours.reduce((sum,row)=>sum+row.included,0),
      hours:hours.map(row=>({start_time:iso(row.start_at)!,end_time:iso(row.end_at)!,steps:row.steps,distance_km:row.distance_km,
        active_calories_kcal:row.active_calories_kcal,active_minutes:row.active_minutes})),
      intervals:page.map(row=>({metric:row.metric,start_time:iso(row.start_at)!,end_time:iso(row.end_at)!,value:row.value})),
      next_cursor:rows.length>100&&last?Buffer.from(JSON.stringify({start:iso(last.start_at),end:iso(last.end_at),metric:last.metric,version})).toString('base64url'):null};
  });
}
