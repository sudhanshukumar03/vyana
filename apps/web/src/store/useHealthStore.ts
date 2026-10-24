import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';
import { apiFetch, apiJson, setToken, clearToken, setUnauthorizedHandler, setRefreshHandler, refreshSession, getSessionEpoch } from '../services/api';
import type { AuthResult } from '../services/api';
import type { VitalReading, ActivityReading, DailyActivity, HealthAlert, DeviceStatus, HealthInsight, InsightResponse, Profile, Contact, Freshness, HealthSummary, HealthUpdate } from '../../../../shared/types/health';
export type { VitalReading as Vitals, ActivityReading, HealthAlert as Alert, DeviceStatus, HealthInsight, Profile, Contact } from '../../../../shared/types/health';
export interface AuthUser { id: number; email: string }
interface HealthState {
  token: string | null; user: AuthUser | null; authReady: boolean; authError: string; error: string;
  vitals: VitalReading | null; activity: DailyActivity | null; alerts: HealthAlert[]; device: DeviceStatus | null;
  insights: HealthInsight[]; insightsOffline: boolean | null; wellnessScore: number | null; freshness: Freshness;
  isConnected: boolean; isSocketConnected: boolean; lastUpdated: Date | null;
  historicalVitals: VitalReading[]; historicalActivity: ActivityReading[]; profile: Profile | null;
  profileLoaded: boolean; showOnboarding: boolean; contacts: Contact[];
  bootstrap: () => Promise<void>; login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>; logout: () => void;
  fetchInitialData: () => Promise<void>; fetchInsights: () => Promise<void>;
  connectWebSocket: () => void; disconnectWebSocket: () => void; tick: () => void;
  fetchProfile: () => Promise<void>; saveProfile: (value: Partial<Profile>) => Promise<boolean>;
  setShowOnboarding: (value: boolean) => void; fetchContacts: () => Promise<void>;
  addContact: (value: Omit<Contact,'id'>) => Promise<boolean>; triggerSos: (note?: string) => Promise<boolean>;
  updateAlert: (id: number, action: 'acknowledge' | 'resolve') => Promise<void>;
}
const empty = () => ({ vitals:null,activity:null,alerts:[],device:null,insights:[],insightsOffline:null,wellnessScore:null,
  freshness:{state:'missing',age_seconds:null,stale_seconds:30} as Freshness,
  isConnected:false,isSocketConnected:false,lastUpdated:null,historicalVitals:[],historicalActivity:[],
  profile:null,profileLoaded:false,showOnboarding:false,contacts:[],error:'' });
export function mergeHistory<T extends { id: number; timestamp: string }>(old: T[], incoming: T[], limit=20): T[] {
  const records=new Map(old.map(row=>[row.id,row])); incoming.forEach(row=>records.set(row.id,row));
  return [...records.values()].sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp)||a.id-b.id).slice(-limit);
}
const errorMessage=(error:unknown)=>error instanceof Error?error.message:'Request failed. Please retry.';
let socket: Socket | null=null;
let retryTimer:ReturnType<typeof setTimeout>|null=null;
let bootstrap: Promise<void>|null=null;
let fetching=false;
let queued=false;
let insightsAt=0;
let clockOffset=0;
let alertRevision=0;
let profileRevision=0;
const recentAlertEvents=new Map<number,{revision:number;alert:HealthAlert}>();
export const useHealthStore=create<HealthState>((set,get)=>{
  const reset=()=>{if(retryTimer!==null)clearTimeout(retryTimer);retryTimer=null;socket?.disconnect();socket=null;clearToken();insightsAt=0;recentAlertEvents.clear();alertRevision=0;set({...empty(),token:null,user:null,authReady:true});};
  setUnauthorizedHandler(reset);
  setRefreshHandler(data=>{set({token:data.token,user:data.user});if(socket){socket.auth={token:data.token};if(!socket.connected)socket.connect();}});
  const authenticate=async(path:string,email:string,password:string)=>{
    reset();const epoch=getSessionEpoch();
    try {
      const data=await apiJson<AuthResult>(path,{method:'POST',body:JSON.stringify({email,password})});
      if(epoch!==getSessionEpoch())return false;
      setToken(data.token);set({...empty(),token:data.token,user:data.user,authReady:true,authError:''});return true;
    } catch(error){if(epoch===getSessionEpoch())set({authError:errorMessage(error)});return false;}
  };
  return {...empty(),token:null,user:null,authReady:false,authError:'',
    bootstrap:()=>{
      if(bootstrap)return bootstrap;
      bootstrap=(async()=>{try{localStorage.removeItem('hg_token');await refreshSession();}catch(error){set({authError:errorMessage(error)});}finally{set({authReady:true});}})();return bootstrap;
    },
    login:(email,password)=>authenticate('/auth/login',email,password),
    register:(email,password)=>authenticate('/auth/register',email,password),
    logout:()=>{void apiFetch('/auth/logout',{method:'POST',signal:new AbortController().signal}).catch(()=>{});reset();},
    fetchInitialData:async()=>{
      if(!get().token)return;
      if(fetching){queued=true;return;}
      fetching=true;const epoch=getSessionEpoch();const startedAlertRevision=alertRevision;const startedProfileRevision=profileRevision;
      try {
        const [data,vitals,activity,alerts]=await Promise.all([apiJson<HealthSummary>('/health/summary'),apiJson<VitalReading[]>('/vitals/trends'),apiJson<ActivityReading[]>('/activity/summary'),apiJson<HealthAlert[]>('/alerts')]);
        if(epoch!==getSessionEpoch())return;
        clockOffset=Date.parse(data.server_time)-Date.now();
        const current=get();
        const sameSource=(!current.device||current.device.id===data.device?.id)&&(!current.vitals||current.vitals.device_id===data.device?.id);
        const incoming=data.vitals?.device_id===data.device?.id?data.vitals:null;
        const latest=sameSource&&current.vitals&&(!incoming||Date.parse(current.vitals.timestamp)>Date.parse(incoming.timestamp))?current.vitals:incoming;
        const useRules=!sameSource||current.insightsOffline!==false||Date.now()-insightsAt>60000||data.insights.some(item=>item.type==='critical'||item.type==='warning');
        set({vitals:latest,activity:data.activity,device:data.device,
          ...(profileRevision===startedProfileRevision?{profile:data.profile||{onboarded:false},profileLoaded:true}:{}),
          alerts:[...new Map([...alerts,...[...recentAlertEvents.values()].filter(event=>event.revision>startedAlertRevision).map(event=>event.alert)].map(alert=>[alert.id,alert])).values()],
          insights:useRules?data.insights:current.insights,insightsOffline:useRules?true:current.insightsOffline,wellnessScore:data.wellness_score,
          freshness:data.freshness,isConnected:true,lastUpdated:new Date(),error:'',
          historicalVitals:mergeHistory(sameSource?current.historicalVitals:[],vitals.filter(row=>row.device_id===data.device?.id)),
          historicalActivity:mergeHistory(sameSource?current.historicalActivity:[],activity.filter(row=>row.device_id===data.device?.id))});
        get().tick();
      }catch(error){if(epoch===getSessionEpoch())set({isConnected:false,error:errorMessage(error)});}
      finally{fetching=false;if(queued){queued=false;void get().fetchInitialData();}}
    },
    fetchInsights:async()=>{
      if(!get().token||Date.now()-insightsAt<30000)return;
      const epoch=getSessionEpoch();insightsAt=Date.now();
      try{const data=await apiJson<InsightResponse>('/health/insights');if(epoch===getSessionEpoch())set({insights:data.insights,insightsOffline:data.offline});}
      catch{ /* Core summary already contains deterministic guidance. */ }
    },
    connectWebSocket:()=>{
      if(socket||!get().token)return;
      const socketEpoch=getSessionEpoch();
      let retries=0;
      const retry=()=>{
        if(retryTimer!==null)clearTimeout(retryTimer);
        retryTimer=setTimeout(()=>{retryTimer=null;if(socketEpoch===getSessionEpoch()&&get().token&&!socket?.connected)socket?.connect();},Math.min(30000,1000*2**Math.min(retries++,5)));
      };
      socket=io({auth:{token:get().token},autoConnect:false});
      socket.on('connect',()=>{if(socketEpoch!==getSessionEpoch())return;if(retryTimer!==null)clearTimeout(retryTimer);retryTimer=null;retries=0;set({isSocketConnected:true});void get().fetchInitialData();});
      socket.on('disconnect',(reason)=>{if(socketEpoch!==getSessionEpoch())return;set({isSocketConnected:false});if(reason==='io server disconnect'&&get().token)void refreshSession().then(data=>{if(socketEpoch!==getSessionEpoch())return;if(data){socket?.connect();}else reset();}).catch(retry);});
      socket.on('connect_error',(error:Error)=>{if(socketEpoch!==getSessionEpoch())return;set({isSocketConnected:false});if(error.message==='Authentication required')void refreshSession().then(data=>{if(socketEpoch!==getSessionEpoch())return;if(data)socket?.connect();else reset();}).catch(retry);else if(error.message==='Service temporarily unavailable')retry();});
      socket.on('health_update',(update:HealthUpdate)=>{
        if(socketEpoch!==getSessionEpoch())return;
        const source=update.type==='device'?update.data.id:update.data.device_id;
        if(get().device && source!==get().device?.id){void get().fetchInitialData();return;}
        if(update.type==='vitals')set(state=>({vitals:!state.vitals||Date.parse(update.data.timestamp)>=Date.parse(state.vitals.timestamp)?update.data:state.vitals,
          historicalVitals:mergeHistory(state.historicalVitals,[update.data]),lastUpdated:new Date()}));
        if(update.type==='activity'){set(state=>({historicalActivity:mergeHistory(state.historicalActivity,[update.data]),lastUpdated:new Date()}));void get().fetchInitialData();}
        if(update.type==='device' && (update.data.active || !get().device))set({device:update.data});
        get().tick();
      });
      socket.on('new_alert',(alert:HealthAlert)=>{
        if(socketEpoch!==getSessionEpoch())return;
        recentAlertEvents.set(alert.id,{revision:++alertRevision,alert});
        if(recentAlertEvents.size>100)recentAlertEvents.delete(recentAlertEvents.keys().next().value!);
        set(state=>({alerts:[alert,...state.alerts.filter(row=>row.id!==alert.id)].sort((a,b)=>Number(b.status==='active'&&b.severity==='critical')-Number(a.status==='active'&&a.severity==='critical')||b.id-a.id).slice(0,100)}));
      });
      socket.connect();
    },
    disconnectWebSocket:()=>{if(retryTimer!==null)clearTimeout(retryTimer);retryTimer=null;socket?.disconnect();socket=null;set({isSocketConnected:false});},
    tick:()=>{
      const {vitals,device,freshness}=get();const now=Date.now()+clockOffset;
      const age=vitals?(now-Date.parse(vitals.timestamp))/1000:null;
      const state=!vitals?'missing':age!==null&&age>=-5&&age<=freshness.stale_seconds?'fresh':'stale';
      set({freshness:{...freshness,state,age_seconds:age},...(state!=='fresh'?{wellnessScore:null}:{}),
        ...(device?{device:{...device,connected:Boolean(device.connected&&device.last_seen&&now-Date.parse(device.last_seen)<=freshness.stale_seconds*1000)}}:{})});
    },
    fetchProfile:async()=>{
      const epoch=getSessionEpoch(),revision=profileRevision;if(!get().token)return;
      try{const profile=await apiJson<Profile>('/profile');if(epoch===getSessionEpoch()&&revision===profileRevision)set({profile,profileLoaded:true});}
      catch(error){if(epoch===getSessionEpoch())set({error:errorMessage(error)});}
    },
    saveProfile:async(value)=>{
      const epoch=getSessionEpoch();
      try{const profile=await apiJson<Profile>('/profile',{method:'PATCH',body:JSON.stringify(value)});
        if(epoch!==getSessionEpoch())return false;profileRevision++;set({profile,profileLoaded:true,showOnboarding:false,error:''});insightsAt=0;void get().fetchInitialData();void get().fetchInsights();return true;
      }catch(error){if(epoch===getSessionEpoch())set({error:errorMessage(error)});return false;}
    },
    setShowOnboarding:value=>set({showOnboarding:value}),
    fetchContacts:async()=>{const epoch=getSessionEpoch();if(!get().token)return;try{const contacts=await apiJson<Contact[]>('/profile/contacts');if(epoch===getSessionEpoch())set({contacts});}catch(error){if(epoch===getSessionEpoch())set({error:errorMessage(error)});}},
    addContact:async(value)=>{const epoch=getSessionEpoch();try{const contact=await apiJson<Contact>('/profile/contacts',{method:'POST',body:JSON.stringify(value)});if(epoch!==getSessionEpoch())return false;set(state=>({contacts:[contact,...state.contacts]}));return true;}catch(error){if(epoch===getSessionEpoch())set({error:errorMessage(error)});return false;}},
    triggerSos:async(note)=>{try{await apiJson('/sos',{method:'POST',body:JSON.stringify({note})});return true;}catch(error){set({error:errorMessage(error)});return false;}},
    updateAlert:async(id,action)=>{await apiJson(`/alerts/${id}/${action}`,{method:'POST'});await get().fetchInitialData();},
  };
});
