import type {Pool} from 'pg';
import {z} from 'zod';
import {transaction} from './db';
import {HttpError} from './auth';

export const ecgBatchSchema=z.object({
  session_id:z.uuid(),sequence:z.number().int().min(1).max(9007199254740863),
  observed_at:z.iso.datetime({offset:true}).refine(value=>{
    const age=Date.now()-Date.parse(value);return age>=-5000&&age<=600000;
  },'ECG batches must be within the last ten minutes and at most five seconds ahead'),
  source:z.enum(['ESP32_MAX30102_DS18B20_AD8232','BackOffice_Simulator']),
  samples:z.array(z.tuple([z.number().int().min(0).max(2000),z.number().int().min(0).max(4095),z.number().int().min(0).max(3)]))
    .min(1).max(128),
}).strict().refine(batch=>batch.samples[0]?.[0]===0&&batch.samples.every((point,i)=>!i||point[0]>batch.samples[i-1][0]),
  'Sample offsets must start at zero and increase strictly')
  .refine(batch=>batch.samples.length>0&&Date.parse(batch.observed_at)+batch.samples.at(-1)![0]<=Date.now()+5000,'Sample end must not be in the future');

export function ecgStorage(pool:Pool) {
  return {
    async accept(owner:number,device:string,body:unknown,allowSimulation=false) {
      const batch=ecgBatchSchema.parse(body),end=batch.sequence+batch.samples.length-1;
      if(batch.source==='BackOffice_Simulator'&&!allowSimulation)throw new HttpError(400,'Generated ECG is accepted only by the simulation service');
      return transaction(pool,async client=>{
        const found=await client.query('SELECT id FROM devices WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL FOR UPDATE',[device,owner]);
        if(!found.rowCount)throw new HttpError(401,'Device revoked');
        const previous=await client.query(`SELECT id,observed_at,source,samples FROM ecg_batches WHERE device_id=$1 AND session_id=$2 AND sequence=$3`,[device,batch.session_id,batch.sequence]);
        if(previous.rows[0]) {
          const row=previous.rows[0];
          if(new Date(row.observed_at).getTime()!==Date.parse(batch.observed_at)||row.source!==batch.source||JSON.stringify(row.samples)!==JSON.stringify(batch.samples))
            throw new HttpError(409,'ECG sequence already has different samples');
          return {success:true,duplicate:true,id:row.id};
        }
        const overlap=await client.query(`SELECT id FROM ecg_batches WHERE device_id=$1 AND session_id=$2
          AND sequence<=$3 AND sequence+jsonb_array_length(samples)>$4 LIMIT 1`,[device,batch.session_id,end,batch.sequence]);
        if(overlap.rowCount)throw new HttpError(409,'ECG sample sequences overlap');
        const result=await client.query(`INSERT INTO ecg_batches(user_id,device_id,session_id,sequence,observed_at,source,samples)
          VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[owner,device,batch.session_id,batch.sequence,batch.observed_at,batch.source,JSON.stringify(batch.samples)]);
        await client.query(`DELETE FROM ecg_batches WHERE device_id=$1 AND (observed_at<NOW()-INTERVAL '10 minutes'
          OR id IN(SELECT id FROM ecg_batches WHERE device_id=$1 ORDER BY id DESC OFFSET 1200))`,[device]);
        return {success:true,duplicate:false,id:result.rows[0].id};
      });
    },
    async read(owner:number,query:unknown) {
      const {after,device}=z.object({after:z.coerce.number().int().min(0).max(2147483647).optional(),device:z.uuid().optional()}).strict().parse(query);
      // Select and read atomically: a response cannot combine two different active devices.
      const result=await pool.query(`WITH active AS (SELECT id FROM devices WHERE user_id=$1 AND active AND revoked_at IS NULL)
        SELECT active.id AS selected, b.* FROM active LEFT JOIN LATERAL
        (SELECT id,device_id,session_id,sequence::float8,observed_at,source,samples FROM ecg_batches
          WHERE user_id=$1 AND device_id=active.id AND source='ESP32_MAX30102_DS18B20_AD8232' AND observed_at>=NOW()-INTERVAL '10 minutes'
          AND ($2::int IS NULL OR id>$2) AND ($3::uuid IS NULL OR active.id=$3)
          ORDER BY CASE WHEN $2::int IS NULL THEN -id ELSE id END LIMIT 24) b ON TRUE`,[owner,after??null,device??null]);
      const selected=result.rows[0]?.selected??null;
      const batches=result.rows.filter(row=>row.id!=null).map(({selected:_selected,...row})=>row).sort((a,b)=>a.id-b.id);
      return {device_id:selected,cursor:batches.at(-1)?.id??(device&&selected!==device?0:after??0),batches};
    },
  };
}

export function startECGRetention(pool:Pool) {
  const timer=setInterval(()=>{void pool.query("DELETE FROM ecg_batches WHERE observed_at<NOW()-INTERVAL '10 minutes'").catch(()=>{
    console.error(JSON.stringify({event:'ecg_retention_failed'}));
  });},60000);timer.unref();return ()=>clearInterval(timer);
}
