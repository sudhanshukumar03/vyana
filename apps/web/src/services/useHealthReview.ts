import {useCallback,useEffect,useState} from 'react';
import type {HealthReview} from '../../../../shared/types/health-review';
import {useHealthStore} from '../store/useHealthStore';
import {apiJson,getSessionEpoch} from './api';

export function useHealthReview(){
  const owner=useHealthStore(state=>state.user?.id),token=useHealthStore(state=>state.token);
  const profile=useHealthStore(state=>state.profile),deviceId=useHealthStore(state=>state.device?.id),googleActivity=useHealthStore(state=>state.googleActivity);
  const epoch=getSessionEpoch();
  const profileKey=JSON.stringify([profile?.dob,profile?.sex,profile?.height_cm,profile?.weight_kg,profile?.timezone,profile?.energy_activity,profile?.nutrition_review,profile?.weight_goal_type,profile?.goal_weight_kg,profile?.conditions,profile?.medications]);
  const sourceKey=JSON.stringify([deviceId,googleActivity?.connected,googleActivity?.last_synced_at,googleActivity?.error_code,googleActivity?.metric_warnings]);
  const identity=JSON.stringify([owner,epoch,profileKey,deviceId,googleActivity?.connected,googleActivity?.account_email]);
  const [version,setVersion]=useState(0),[state,setState]=useState<{owner:number|undefined;epoch:number;identity:string;data:HealthReview|null;error:string;loading:boolean}>({owner,epoch,identity,data:null,error:'',loading:true});
  const reload=useCallback(()=>setVersion(value=>value+1),[]);
  useEffect(()=>{
    if(!token)return;
    const lifetime=new AbortController();let request:AbortController|null=null;
    const load=async()=>{
      request?.abort();const current=new AbortController();request=current;
      setState(previous=>({...previous,owner,epoch,identity,data:previous.identity===identity?previous.data:null,loading:true,error:''}));
      try{
        const data=await apiJson<HealthReview>('/health/review',{signal:AbortSignal.any([lifetime.signal,current.signal,AbortSignal.timeout(15000)])});
        if(!current.signal.aborted&&!lifetime.signal.aborted&&epoch===getSessionEpoch())setState({owner,epoch,identity,data,error:'',loading:false});
      }catch(reason){if(!current.signal.aborted&&!lifetime.signal.aborted&&epoch===getSessionEpoch())setState(previous=>({...previous,owner,epoch,error:reason instanceof Error?reason.message:'Could not load your health review.',loading:false}));}
    };
    const wake=()=>{if(document.visibilityState!=='hidden'&&navigator.onLine!==false)void load();};
    void load();const timer=window.setInterval(wake,60000);
    window.addEventListener('focus',wake);window.addEventListener('online',wake);
    return ()=>{lifetime.abort();request?.abort();window.clearInterval(timer);window.removeEventListener('focus',wake);window.removeEventListener('online',wake);};
  },[token,owner,epoch,version,profileKey,sourceKey,identity]);
  const sameOwner=state.owner===owner&&state.epoch===epoch&&state.identity===identity;
  return {data:sameOwner?state.data:null,error:sameOwner?state.error:'',loading:!sameOwner||state.loading,reload};
}
