import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { VitalReading } from '../../../../shared/types/health';

vi.mock('socket.io-client',()=>({io:vi.fn(()=>({on:vi.fn(),connect:vi.fn(),disconnect:vi.fn(),connected:false}))}));
let store: typeof import('./useHealthStore').useHealthStore;
let api: typeof import('../services/api');
const reading=(id:number):VitalReading=>({id,device_id:'device',session_id:'session',sequence:id,timestamp:new Date(1700000000000+id*1000).toISOString(),observed_at:'',received_at:'',source:'test',heart_rate:72,spo2:98,temperature:36.7,ecg_status:'Normal'});
beforeEach(async()=>{vi.resetModules();store=(await import('./useHealthStore')).useHealthStore;api=await import('../services/api');vi.stubGlobal('fetch',vi.fn());});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});

describe('health state regressions',()=>{
  it('keeps readings 2–21 instead of dropping the newest prior sample',async()=>{
    const {mergeHistory}=await import('./useHealthStore');
    expect(mergeHistory(Array.from({length:20},(_,index)=>reading(index+1)),[reading(21)]).map(row=>row.id)).toEqual(Array.from({length:20},(_,index)=>index+2));
  });
  it('deduplicates out-of-order socket/REST snapshots',async()=>{
    const {mergeHistory}=await import('./useHealthStore');
    expect(mergeHistory([reading(3),reading(1)],[reading(2),reading(3)]).map(row=>row.id)).toEqual([1,2,3]);
  });
  it('clears all patient state on logout',()=>{
    vi.mocked(fetch).mockResolvedValue(new Response('{}'));
    api.setToken('old');store.setState({token:'old',vitals:reading(1),wellnessScore:85,insights:[{type:'info',title:'Old',detail:'Private'}],historicalVitals:[reading(1)],showOnboarding:true});
    store.getState().logout();
    const state=store.getState();
    expect(state.vitals).toBeNull();expect(state.wellnessScore).toBeNull();expect(state.insights).toEqual([]);expect(state.historicalVitals).toEqual([]);expect(state.showOnboarding).toBe(false);
  });
  it('discards a response from the previous session',async()=>{
    let release!:(value:Response)=>void;
    vi.mocked(fetch).mockReturnValue(new Promise(resolve=>{release=resolve;}));
    api.setToken('old');
    const result=api.apiFetch('/profile').catch(error=>error);
    api.clearToken();release(new Response('{"full_name":"Old account"}',{status:200}));
    expect((await result).name).toBe('AbortError');
  });
  it('marks expired readings stale and removes unavailable score',()=>{
    store.setState({vitals:reading(1),wellnessScore:100});store.getState().tick();
    expect(store.getState().freshness.state).toBe('stale');expect(store.getState().wellnessScore).toBeNull();
  });
  it('surfaces structured non-success API messages',async()=>{
    vi.mocked(fetch).mockResolvedValue(new Response('{"error":"File too large (maximum 10 MiB)"}',{status:413}));
    await expect(api.apiJson('/assistant/report')).rejects.toThrow('File too large');
  });
  it('uses same-origin calls without persistent bearer storage',async()=>{
    vi.mocked(fetch).mockResolvedValue(new Response('{}'));
    api.setToken('short-lived');await api.apiFetch('/profile');
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/profile');expect(localStorage.getItem('hg_token')).toBeNull();
  });
  it('clears health state if a request is still unauthorized after refresh',async()=>{
    api.setToken('old');store.setState({token:'old',vitals:reading(1),historicalVitals:[reading(1)]});
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}',{status:401}))
      .mockResolvedValueOnce(new Response(JSON.stringify({token:'rotated',user:{id:1,email:'test@example.test'}})))
      .mockResolvedValueOnce(new Response('{}',{status:401}));
    await expect(api.apiFetch('/profile')).rejects.toMatchObject({name:'AbortError'});
    expect(api.getToken()).toBeNull();expect(store.getState().vitals).toBeNull();expect(store.getState().historicalVitals).toEqual([]);
  });
  it('replaces source history even when the previous device has a newer reading',async()=>{
    const now=new Date().toISOString();
    const old={...reading(9),device_id:'old-device',timestamp:new Date(Date.now()+1000).toISOString()};
    const incoming={...reading(2),device_id:'new-device',timestamp:now,observed_at:now};
    const device={id:'new-device',device_name:'New',connected:true,battery:null,last_seen:now,source:'Test',active:true};
    api.setToken('session');store.setState({token:'session',vitals:old,historicalVitals:[old],device:{...device,id:'old-device'}});
    vi.mocked(fetch).mockImplementation(async path=>new Response(JSON.stringify(String(path).endsWith('/health/summary')?
      {vitals:incoming,device,activity:null,insights:[],wellness_score:90,freshness:{state:'fresh',age_seconds:0,stale_seconds:30},server_time:now}:
      String(path).endsWith('/vitals/trends')?[incoming]:[])));
    await store.getState().fetchInitialData();
    expect(store.getState().vitals?.id).toBe(2);expect(store.getState().historicalVitals.map(row=>row.device_id)).toEqual(['new-device']);
  });
  it('preserves a first live reading when an earlier empty snapshot finishes later',async()=>{
    const now=new Date().toISOString(),live={...reading(7),timestamp:now,device_id:'new-device'};
    api.setToken('session');store.setState({token:'session',vitals:live,historicalVitals:[live],device:null});
    vi.mocked(fetch).mockImplementation(async path=>new Response(JSON.stringify(String(path).endsWith('/health/summary')?
      {vitals:null,device:{id:'new-device',device_name:'New',active:true,connected:true,battery:null,last_seen:now,source:'Test'},profile:null,activity:null,insights:[],wellness_score:null,freshness:{state:'missing',age_seconds:null,stale_seconds:30},server_time:now}:[])));
    await store.getState().fetchInitialData();
    expect(store.getState().vitals?.id).toBe(7);expect(store.getState().historicalVitals.map(row=>row.id)).toEqual([7]);
  });
  it('does not restore a login whose JSON body finishes after logout',async()=>{
    let release!:(value:unknown)=>void;
    const response=new Response('{}');
    vi.spyOn(response,'json').mockReturnValue(new Promise(resolve=>{release=resolve;}));
    vi.mocked(fetch).mockResolvedValueOnce(response).mockResolvedValue(new Response('{}'));
    const pending=store.getState().login('old@example.test','synthetic-password');
    await vi.waitFor(()=>expect(response.json).toHaveBeenCalled());
    store.getState().logout();release({token:'old-session',user:{id:1,email:'old@example.test'}});
    expect(await pending).toBe(false);expect(store.getState().token).toBeNull();expect(store.getState().user).toBeNull();
  });
  it('keeps a valid local session when refresh is temporarily unavailable',async()=>{
    api.setToken('session');store.setState({token:'session',vitals:reading(1)});
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}',{status:401})).mockResolvedValueOnce(new Response('{}',{status:503}));
    await expect(api.apiFetch('/profile')).rejects.toThrow('Session service unavailable');
    expect(api.getToken()).toBe('session');expect(store.getState().vitals?.id).toBe(1);
  });
  it('retries a temporary socket outage and cancels the retry on logout',async()=>{
    vi.useFakeTimers();
    const {io}=await import('socket.io-client');
    const listeners=new Map<string,(error:Error)=>void>();
    const client={auth:{token:'session'},connected:false,on:vi.fn((name:string,handler:(error:Error)=>void)=>listeners.set(name,handler)),connect:vi.fn(),disconnect:vi.fn()};
    vi.mocked(io).mockReturnValue(client as unknown as ReturnType<typeof io>);
    vi.mocked(fetch).mockResolvedValue(new Response('{}'));
    api.setToken('session');store.setState({token:'session'});store.getState().connectWebSocket();
    listeners.get('connect_error')!(new Error('Service temporarily unavailable'));
    await vi.advanceTimersByTimeAsync(1000);expect(client.connect).toHaveBeenCalledTimes(2);
    expect(store.getState().token).toBe('session');
    listeners.get('connect_error')!(new Error('Service temporarily unavailable'));
    store.getState().logout();await vi.advanceTimersByTimeAsync(30000);
    expect(client.connect).toHaveBeenCalledTimes(2);expect(store.getState().token).toBeNull();
  });
  it('recovers the profile and replaces alert snapshots while preserving a concurrent live alert',async()=>{
    const {io}=await import('socket.io-client');
    const listeners=new Map<string,(value:unknown)=>void>();
    vi.mocked(io).mockReturnValue({auth:{},connected:false,on:vi.fn((name:string,handler:(value:unknown)=>void)=>listeners.set(name,handler)),connect:vi.fn(),disconnect:vi.fn()} as unknown as ReturnType<typeof io>);
    api.setToken('session');store.setState({token:'session',profileLoaded:false});store.getState().connectWebSocket();
    const profile={onboarded:true,height_cm:175,weight_kg:72,medications:'Preserved'};
    const snapshot={vitals:null,device:null,activity:null,profile,insights:[],wellness_score:null,freshness:{state:'missing',age_seconds:null,stale_seconds:30},server_time:new Date().toISOString()};
    let release!:(value:Response)=>void;
    vi.mocked(fetch).mockImplementation(async path=>String(path).endsWith('/alerts')?new Promise(resolve=>{release=resolve;}):new Response(JSON.stringify(String(path).endsWith('/health/summary')?snapshot:[])));
    const pending=store.getState().fetchInitialData();await vi.waitFor(()=>expect(release).toBeDefined());
    const alert={id:99,timestamp:new Date().toISOString(),severity:'critical',title:'Synthetic SOS',detail:'Test',status:'active',metric:'emergency',direction:'high',acknowledged_at:null,resolved_at:null};
    listeners.get('new_alert')!(alert);release(new Response('[]'));await pending;
    expect(store.getState().alerts.map(row=>row.id)).toEqual([99]);expect(store.getState().profile?.medications).toBe('Preserved');expect(store.getState().profileLoaded).toBe(true);
    vi.mocked(fetch).mockImplementation(async path=>new Response(JSON.stringify(String(path).endsWith('/health/summary')?snapshot:String(path).endsWith('/alerts')?[{...alert,status:'resolved'}]:[])));
    await store.getState().fetchInitialData();expect(store.getState().alerts[0].status).toBe('resolved');
  });
});
