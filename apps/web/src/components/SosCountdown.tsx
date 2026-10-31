import {useCallback,useEffect,useState} from 'react';
import type {SosOverview} from '../../../../shared/types/sos';
import {apiJson} from '../services/api';
import {useHealthStore} from '../store/useHealthStore';

/** Shared across routes; the settings form remains in the lazy settings page. */
export function SosCountdown() {
  const [overview,setOverview]=useState<(SosOverview&{receivedAt:number})|null>(null),[error,setError]=useState(''),[now,setNow]=useState(Date.now());
  const [busy,setBusy]=useState(false);
  const refresh=useCallback(async()=>{
    try{const value=await apiJson<SosOverview>('/sos');const receivedAt=Date.now();setOverview({...value,receivedAt});setNow(receivedAt);setError('');}
    catch{setError('Could not refresh SOS status.');}
  },[]);
  useEffect(()=>{void refresh();const timer=window.setInterval(()=>void refresh(),5000);return()=>window.clearInterval(timer);},[refresh]);
  const pending=overview?.incidents.find(incident=>incident.status==='pending');
  const pendingId=pending?.id;
  useEffect(()=>{if(!pendingId)return;const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[pendingId]);
  if(!pending||!overview)return null;
  const serverOffset=Date.parse(overview.server_time)-overview.receivedAt;
  const seconds=Math.max(0,Math.ceil((Date.parse(pending.due_at)-(now+serverOffset))/1000));
  const cancel=async()=>{
    setBusy(true);try{await apiJson(`/sos/${pending.id}/cancel`,{method:'POST'});await refresh();await useHealthStore.getState().fetchInitialData();}
    catch(err){setError(err instanceof Error?err.message:'SOS could not be cancelled');}finally{setBusy(false);}
  };
  return <div role="alert" className="border border-critical rounded-xl bg-critical-bg text-critical px-4 py-3 flex flex-wrap gap-3 items-center justify-between mx-2 mt-2">
    <div><p className="font-semibold">Automatic SOS <span role="timer" aria-live="off">{seconds?`in ${seconds} seconds`:'is being processed'}</span></p><p className="text-sm">{pending.reason}</p>{error&&<p className="text-sm">{error}</p>}</div>
    <button className="ui-button secondary" type="button" disabled={busy||seconds===0} onClick={()=>void cancel()}>{busy?'Cancelling…':'Cancel automatic SOS'}</button>
  </div>;
}
