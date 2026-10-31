import type {Pool} from 'pg';
/** Starts only in the normal API entrypoint, never as a side effect of constructing a test app. */
export function startGoogleWorker(pool:Pool,integration:{sync:(user:number)=>Promise<void>;abortAll:()=>void},enabled:boolean){
  let stopped=false,running=false;
  const run=async()=>{
    if(stopped||running||!enabled)return;
    running=true;
    try{
      const due=await pool.query(`SELECT user_id FROM google_health_connections WHERE next_sync_at<=NOW()
        AND (error_code IS NULL OR error_code NOT IN ('reconnect_required','access_denied')) ORDER BY next_sync_at LIMIT 2`);
      await Promise.all(due.rows.map(async row=>{if(!stopped)await integration.sync(row.user_id);}));
    }catch{if(!stopped)console.error(JSON.stringify({event:'google_activity_worker_retry'}));}
    finally{running=false;}
  };
  const timer=setInterval(()=>void run(),15000);timer.unref();void run();
  return {run,stop:()=>{stopped=true;clearInterval(timer);integration.abortAll();}};
}
