import { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { transaction } from './db';
import { vitalsSchema, activitySchema } from './schemas';
import { vitalAlerts } from './alerts';

export type Broadcast = (owner: number, event: string, data: unknown) => void;
type Device = { id: string; user_id: number; active: boolean };

export async function ingest(pool: Pool, device: Device, kind: 'vitals' | 'activity',
  input: z.infer<typeof vitalsSchema> | z.infer<typeof activitySchema>, staleSeconds: number, broadcast: Broadcast) {
  const result = await transaction(pool, async (client) => {
    const current = (await client.query('SELECT * FROM devices WHERE id=$1 AND revoked_at IS NULL FOR UPDATE', [device.id])).rows[0];
    if (!current) throw Object.assign(new Error('Device revoked'), { status: 401 });
    const fields = kind === 'vitals' ? ['heart_rate','spo2','temperature','ecg_status'] : ['steps','distance_km','calories','active_minutes'];
    const values = [device.user_id,device.id,input.session_id,input.sequence,input.observed_at,input.source,
      ...fields.map((key) => (input as Record<string,unknown>)[key])];
    const { rows } = await client.query(`INSERT INTO ${kind}(user_id,device_id,session_id,sequence,observed_at,source,${fields.join(',')})
      VALUES(${values.map((_,i) => `$${i+1}`).join(',')}) ON CONFLICT(device_id,session_id,sequence) DO NOTHING RETURNING *`, values);
    if (!rows[0]) return { duplicate: true, row: null, changes: [], active: current.active };
    await client.query('UPDATE devices SET connected=TRUE,last_seen=NOW(),source=$1 WHERE id=$2', [input.source,device.id]);
    const newest = await client.query(`SELECT id FROM ${kind} WHERE device_id=$1 ORDER BY observed_at DESC,id DESC LIMIT 1`, [device.id]);
    const age = Date.now() - Date.parse(input.observed_at);
    const fresh = age >= -5000 && age <= staleSeconds*1000;
    const changes = kind === 'vitals' && current.active && fresh && newest.rows[0].id === rows[0].id ?
      await evaluateEpisodes(client, device, input as z.infer<typeof vitalsSchema>) : [];
    return { duplicate: false, row: rows[0], changes, active: current.active };
  });
  if (result.row && result.active) broadcast(device.user_id,'health_update',{type:kind,data:result.row});
  result.changes.forEach((alert) => broadcast(device.user_id,'new_alert',alert));
  return { success: true, duplicate: result.duplicate };
}

async function evaluateEpisodes(client: PoolClient, device: Device, input: z.infer<typeof vitalsSchema>) {
  const flags = vitalAlerts(input.heart_rate,input.spo2,input.temperature).map((flag) => ({ ...flag,
    direction: flag.metric === 'spo2' || (flag.metric === 'heart_rate' && input.heart_rate<45) ||
      (flag.metric === 'temperature' && input.temperature<35) ? 'low' : 'high' }));
  const active = (await client.query("SELECT * FROM alerts WHERE device_id=$1 AND status='active' AND metric!='emergency' FOR UPDATE", [device.id])).rows;
  const changes: Record<string,unknown>[] = [];
  for (const episode of active) {
    const flag = flags.find((entry) => entry.metric===episode.metric && entry.direction===episode.direction);
    if (!flag) {
      const row = (await client.query(`UPDATE alerts SET recovery_count=recovery_count+1,
        status=CASE WHEN recovery_count>=2 THEN 'resolved' ELSE status END,
        resolved_at=CASE WHEN recovery_count>=2 THEN NOW() ELSE NULL END WHERE id=$1 RETURNING *`,[episode.id])).rows[0];
      if(row.status==='resolved') changes.push(row);
      continue;
    }
    const escalate = flag.severity==='critical' && episode.severity!=='critical';
    const repeat = Date.now()-new Date(episode.last_emitted_at).getTime()>=3600000;
    if(escalate || repeat) {
      const row=(await client.query(`UPDATE alerts SET severity=$1,title=$2,detail=$3,last_emitted_at=NOW(),
        recovery_count=0,acknowledged_at=NULL WHERE id=$4 RETURNING *`,[flag.severity,flag.title,flag.detail,episode.id])).rows[0];
      changes.push(row);
    } else await client.query('UPDATE alerts SET recovery_count=0 WHERE id=$1',[episode.id]);
  }
  for(const flag of flags) {
    if(active.some((entry)=>entry.metric===flag.metric&&entry.direction===flag.direction)) continue;
    const row=(await client.query(`INSERT INTO alerts(user_id,device_id,severity,title,detail,metric,direction)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[device.user_id,device.id,flag.severity,flag.title,flag.detail,flag.metric,flag.direction])).rows[0];
    changes.push(row);
  }
  return changes;
}

export function fallbackInsights(vitals: Record<string,unknown> | null, fresh: boolean) {
  if (!vitals || !fresh) return [{type:'info',title:'Insufficient current data',detail:'Fresh readings are needed before generating a wellness summary.'}];
  const flags=vitalAlerts(Number(vitals.heart_rate),Number(vitals.spo2),Number(vitals.temperature));
  const insights=flags.map(flag=>({type:flag.severity,title:flag.title,detail:`${flag.detail}. Review this reading; contact a qualified clinician if concerned.`}));
  if(vitals.ecg_status!=='Normal') insights.push({type:'warning',title:'ECG status needs review',detail:`ECG status: ${vitals.ecg_status}. This prototype does not interpret or diagnose rhythms.`});
  if(!insights.length) return [{type:'info',title:'Current readings received',detail:'No configured threshold alert was triggered. This is not a clinical assessment.'}];
  return insights;
}

export async function summary(pool: Pool, userId: number, staleSeconds: number) {
  const [v,a,d,al,p] = await Promise.all([
    pool.query(`SELECT v.* FROM vitals v WHERE v.user_id=$1
      AND v.device_id=(SELECT id FROM devices WHERE user_id=$1 AND active AND revoked_at IS NULL)
      ORDER BY v.observed_at DESC,v.id DESC LIMIT 1`,[userId]),
    pool.query(`WITH deltas AS (
      SELECT a.*, previous.steps AS ps,previous.distance_km AS pd,previous.calories AS pc,previous.active_minutes AS pm
      FROM activity a
      LEFT JOIN LATERAL (SELECT steps,distance_km,calories,active_minutes FROM activity p
        WHERE p.device_id=a.device_id AND p.session_id=a.session_id AND p.sequence<a.sequence ORDER BY p.sequence DESC LIMIT 1) previous ON TRUE
      WHERE a.user_id=$1 AND a.device_id=(SELECT id FROM devices WHERE user_id=$1 AND active AND revoked_at IS NULL)
        AND a.observed_at>=NOW()-INTERVAL '2 days'
    ) SELECT COALESCE(SUM(CASE WHEN steps<COALESCE(ps,0) THEN steps ELSE steps-COALESCE(ps,0) END),0)::float AS steps,
      COALESCE(SUM(CASE WHEN distance_km<COALESCE(pd,0) THEN distance_km ELSE distance_km-COALESCE(pd,0) END),0) AS distance_km,
      COALESCE(SUM(CASE WHEN calories<COALESCE(pc,0) THEN calories ELSE calories-COALESCE(pc,0) END),0)::float AS calories,
      COALESCE(SUM(CASE WHEN active_minutes<COALESCE(pm,0) THEN active_minutes ELSE active_minutes-COALESCE(pm,0) END),0)::float AS active_minutes,
      MAX(observed_at) AS timestamp
      FROM deltas WHERE (observed_at AT TIME ZONE COALESCE((SELECT timezone FROM profile WHERE user_id=$1),'Asia/Kolkata'))::date=
      (NOW() AT TIME ZONE COALESCE((SELECT timezone FROM profile WHERE user_id=$1),'Asia/Kolkata'))::date`,[userId]),
    pool.query('SELECT id,device_name,connected,battery,last_seen,source,active FROM devices WHERE user_id=$1 AND revoked_at IS NULL ORDER BY active DESC,last_seen DESC NULLS LAST LIMIT 1',[userId]),
    pool.query("SELECT * FROM alerts WHERE user_id=$1 AND status='active' ORDER BY CASE severity WHEN 'critical' THEN 0 ELSE 1 END,id DESC LIMIT 100",[userId]),
    pool.query('SELECT * FROM profile WHERE user_id=$1',[userId]),
  ]);
  const vitals=v.rows[0]||null, device=d.rows[0]||null, profile=p.rows[0]||null;
  const age = vitals ? (Date.now()-new Date(vitals.observed_at).getTime())/1000 : null;
  const fresh = age!==null && age>=-5 && age<=staleSeconds;
  if(device) device.connected=Boolean(device.connected && device.last_seen && Date.now()-new Date(device.last_seen).getTime()<=staleSeconds*1000);
  let score: number|null=null;
  if(fresh && vitals.ecg_status==='Normal') {
    const {rows}=await pool.query(`SELECT AVG(heart_rate)::float AS hr,AVG(spo2)::float AS spo2,
      MIN(temperature)::float AS min_temp,MAX(temperature)::float AS max_temp FROM vitals
      WHERE user_id=$1 AND device_id=$2 AND observed_at>=NOW()-INTERVAL '24 hours'`,[userId,vitals.device_id]);
    const values=rows[0];
    score=100-(values.hr>90||values.hr<60?10:0)-(values.spo2<95?15:0)-(values.max_temp>38||values.min_temp<35?20:0);
    const current=vitalAlerts(vitals.heart_rate,vitals.spo2,vitals.temperature);
    if(current.some(flag=>flag.severity==='critical'))score=Math.min(score,60);
    else if(current.length)score=Math.min(score,80);
  }
  return {vitals,activity:a.rows[0]?.timestamp?a.rows[0]:null,device,alerts:al.rows,profile,
    insights:fallbackInsights(vitals,fresh),wellness_score:score,wellness_version:'prototype-v2',
    freshness:{state:!vitals?'missing':fresh?'fresh':'stale',age_seconds:age,stale_seconds:staleSeconds},server_time:new Date().toISOString()};
}
