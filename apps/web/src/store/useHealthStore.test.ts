import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { HealthSummary, HealthUpdate, VitalReading } from '../../../../shared/types/health';
import type {GoogleHealthOverview} from '../../../../shared/types/google-health';

vi.mock('socket.io-client',()=>({io:vi.fn(()=>({on:vi.fn(),connect:vi.fn(),disconnect:vi.fn(),connected:false}))}));
let store: typeof import('./useHealthStore').useHealthStore;
let api: typeof import('../services/api');
const reading=(id:number):VitalReading=>({id,device_id:'device',session_id:'session',sequence:id,timestamp:new Date(1700000000000+id*1000).toISOString(),observed_at:'',received_at:'',source:'test',heart_rate:72,spo2:98,temperature:36.7,ecg_status:'Normal'});
beforeEach(async()=>{vi.resetModules();store=(await import('./useHealthStore')).useHealthStore;api=await import('../services/api');vi.stubGlobal('fetch',vi.fn());});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});

describe('health state regressions',()=>{
  it('does not roll back live readings or connection state when an older device event arrives late',async()=>{
    const now=new Date().toISOString(),older=new Date(Date.now()-10000).toISOString();
    const device={id:'device',device_name:'Sensor hub',active:true,connected:false,battery:null,last_seen:now,source:'ESP32_MAX30102_DS18B20_AD8232',
      equipment:{observed_at:now,temperature_c:null,heart_rate:null,spo2:null,ecg_status:'Leads Off' as const,ecg_raw_adc:0,ecg_millivolts:0,ecg_samples:0,ecg_clipped_samples:0}};
    const {io}=await import('socket.io-client');
    const listeners=new Map<string,(update:HealthUpdate)=>void>();
    vi.mocked(io).mockReturnValue({on:vi.fn((name:string,fn:(update:HealthUpdate)=>void)=>listeners.set(name,fn)),
      connect:vi.fn(),disconnect:vi.fn(),connected:false} as unknown as ReturnType<typeof io>);
    api.setToken('session');store.setState({token:'session',device});store.getState().connectWebSocket();
    try {
      listeners.get('health_update')!({type:'device',data:{...device,connected:true,last_seen:older,equipment:{...device.equipment,observed_at:older,temperature_c:25,heart_rate:72,spo2:98}}});
      expect(store.getState().device?.last_seen).toBe(now);
      expect(store.getState().device?.connected).toBe(false);
      expect(store.getState().device?.equipment?.heart_rate).toBeNull();
      expect(store.getState().device?.equipment?.temperature_c).toBeNull();
    } finally {store.getState().disconnectWebSocket();}
  });
  it.each(['snapshot','sync'] as const)('does not restore a disconnected Google account from a delayed %s',async kind=>{
    const now=new Date().toISOString();
    const linked:GoogleHealthOverview={provider:'GoogleHealth',configured:true,connected:true,account_email:'owner@example.test',
      timezone:'Asia/Kolkata',today:'2026-10-29',last_synced_at:now,last_attempt_at:now,error_code:null,days:[{date:'2026-10-29',steps:1234,distance_km:null}]};
    const unlinked={...linked,connected:false,account_email:null,days:[]};
    const daily={steps:1234,distance_km:null,calories:null,active_minutes:null,timestamp:now,source:'GoogleHealth'};
    api.setToken('session');store.setState({token:'session',googleActivity:linked,activity:daily});
    let release!:(response:Response)=>void;
    vi.mocked(fetch).mockImplementation(async(url,init)=>{
      const route=String(url);
      if(init?.method==='DELETE')return new Response(JSON.stringify(unlinked));
      if(route.endsWith(kind==='sync'?'/google-health/sync':'/google-health'))return new Promise(resolve=>{release=resolve;});
      return new Response(JSON.stringify(route.endsWith('/health/summary')?
        {vitals:null,device:null,activity:daily,insights:[],wellness_score:null,freshness:{state:'missing',age_seconds:null,stale_seconds:30},server_time:now}:[]));
    });
    const pending=kind==='sync'?store.getState().syncGoogleActivity():store.getState().fetchInitialData();
    expect(store.getState().isGoogleActivitySyncing).toBe(kind==='sync');
    await store.getState().disconnectGoogleActivity();release(new Response(JSON.stringify(linked)));await pending;
    expect(store.getState().googleActivity?.connected).toBe(false);
    expect(store.getState().googleActivity?.days).toEqual([]);
    expect(store.getState().activity).toBeNull();
    expect(store.getState().isGoogleActivitySyncing).toBe(false);
  });
  it.each(['older','missing'] as const)('keeps newer live equipment when a %s REST heartbeat finishes later',async heartbeat=>{
    const now=new Date().toISOString(),newer=new Date(Date.now()+1000).toISOString();
    const device={id:'device',device_name:'Sensor hub',active:true,connected:true,battery:null,last_seen:now,source:'test',
      equipment:{observed_at:now,temperature_c:25,heart_rate:null,spo2:null,ecg_status:'Leads Off' as const,ecg_raw_adc:0,ecg_millivolts:0,ecg_samples:0,ecg_clipped_samples:0}};
    let release!:(value:Response)=>void;
    const {io}=await import('socket.io-client');
    const listeners=new Map<string,(update:HealthUpdate)=>void>();
    vi.mocked(io).mockReturnValue({on:vi.fn((name:string,fn:(update:HealthUpdate)=>void)=>listeners.set(name,fn)),
      connect:vi.fn(),disconnect:vi.fn(),connected:false} as unknown as ReturnType<typeof io>);
    api.setToken('session');store.setState({token:'session',device});store.getState().connectWebSocket();
    vi.mocked(fetch).mockImplementation(async url=>String(url).endsWith('/health/summary')?
      new Promise(resolve=>{release=resolve;}):new Response('[]'));
    const pending=store.getState().fetchInitialData();
    listeners.get('health_update')!({type:'device',data:{...device,last_seen:newer,equipment:{...device.equipment,observed_at:newer,temperature_c:26}}});
    release(new Response(JSON.stringify({vitals:null,device:heartbeat==='older'?device:{...device,last_seen:null,equipment:null},activity:null,insights:[],wellness_score:null,
      freshness:{state:'missing',age_seconds:null,stale_seconds:30},server_time:now})));
    await pending;
    expect(store.getState().device?.equipment?.temperature_c).toBe(26);
    expect(store.getState().device?.last_seen).toBe(newer);
    store.getState().disconnectWebSocket();
  });
  it('allows the next automatic refresh after a stalled snapshot times out',async()=>{
    const deadline=new AbortController();
    vi.spyOn(AbortSignal,'timeout').mockReturnValueOnce(deadline.signal);
    api.setToken('session');store.setState({token:'session'});
    vi.mocked(fetch).mockImplementation((_url,init)=>new Promise((_resolve,reject)=>{
      init!.signal!.addEventListener('abort',()=>reject(new DOMException('Timed out','TimeoutError')),{once:true});
    }));
    const pending=store.getState().fetchInitialData();
    deadline.abort();await pending;
    expect(store.getState().isConnected).toBe(false);
    const now=new Date().toISOString();
    vi.mocked(fetch).mockImplementation(async url=>new Response(JSON.stringify(String(url).endsWith('/health/summary')?
      {vitals:null,device:null,activity:null,insights:[],wellness_score:null,freshness:{state:'missing',age_seconds:null,stale_seconds:30},server_time:now}:[])));
    await store.getState().fetchInitialData();
    expect(store.getState().isConnected).toBe(true);
  });
  it('reopens a stopped socket without creating a duplicate or interrupting an active retry',async()=>{
    const {io}=await import('socket.io-client');
    const connection={on:vi.fn(),connect:vi.fn(),disconnect:vi.fn(),connected:false,active:false};
    vi.mocked(io).mockReturnValue(connection as unknown as ReturnType<typeof io>);
    api.setToken('session');store.setState({token:'session'});
    store.getState().connectWebSocket();
    expect(connection.connect).toHaveBeenCalledTimes(1);
    store.getState().connectWebSocket();
    expect(connection.connect).toHaveBeenCalledTimes(2);
    connection.active=true;
    store.getState().connectWebSocket();
    expect(connection.connect).toHaveBeenCalledTimes(2);
    connection.connected=true;
    store.getState().connectWebSocket();
    expect(connection.connect).toHaveBeenCalledTimes(2);
    store.getState().disconnectWebSocket();
  });
  it('logout also aborts requests that supply their own cancellation signal',async()=>{
    let supplied:AbortSignal|undefined;
    vi.mocked(fetch).mockImplementation(async(_url,init)=>{supplied=init?.signal as AbortSignal;return new Response('{}');});
    const local=new AbortController();api.setToken('old');
    await api.apiFetch('/assistant/chat',{signal:local.signal});
    api.clearToken();
    expect(supplied?.aborted).toBe(true);expect(local.signal.aborted).toBe(false);
  });
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
  describe('pending insight context',()=>{
    let snapshot:HealthSummary;
    let releaseInsights:(response:Response)=>void;
    const generated=[{type:'info',title:'Device A guidance',detail:'Guidance for the original context'}];
    beforeEach(()=>{
      const now=new Date().toISOString();
      snapshot={vitals:{...reading(1),timestamp:now,observed_at:now},
        device:{id:'device',device_name:'A',active:true,connected:true,battery:null,last_seen:now,source:'test'},
        activity:null,profile:{onboarded:true,medications:'Original'},alerts:[],
        insights:[{type:'info',title:'Rules',detail:'Current deterministic guidance'}],wellness_score:90,
        freshness:{state:'fresh',age_seconds:0,stale_seconds:30},server_time:now};
      api.setToken('session');store.setState({token:'session',vitals:snapshot.vitals,device:snapshot.device,
        profile:snapshot.profile,freshness:snapshot.freshness,insights:snapshot.insights,insightsOffline:true});
      vi.mocked(fetch).mockImplementation(async path=>{
        if(String(path).endsWith('/health/insights'))return new Promise(resolve=>{releaseInsights=resolve;});
        return new Response(JSON.stringify(String(path).endsWith('/health/summary')?snapshot:
          String(path).endsWith('/profile')?snapshot.profile:[]));
      });
    });
    const finish=async(pending:Promise<void>)=>{
      releaseInsights(new Response(JSON.stringify({insights:generated,offline:false})));await pending;
    };
    const subscribe=async()=>{
      const {io}=await import('socket.io-client');
      const listeners=new Map<string,(update:HealthUpdate)=>void>();
      vi.mocked(io).mockReturnValue({auth:{},connected:false,
        on:vi.fn((name:string,handler:(update:HealthUpdate)=>void)=>listeners.set(name,handler)),
        connect:vi.fn(),disconnect:vi.fn()} as unknown as ReturnType<typeof io>);
      store.getState().connectWebSocket();
      return (update:HealthUpdate)=>listeners.get('health_update')!(update);
    };
    it('accepts guidance when the concurrent summary poll returns unchanged inputs',async()=>{
      // Layout starts these together; the faster summary must not invalidate AI.
      const summary=store.getState().fetchInitialData(),pending=store.getState().fetchInsights();
      await summary;await finish(pending);
      expect(store.getState().insights).toEqual(generated);expect(store.getState().insightsOffline).toBe(false);
    });
    it.each(['source','vitals','activity'] as const)('discards guidance after the %s changes',async change=>{
      const pending=store.getState().fetchInsights();
      if(change==='source'){
        snapshot={...snapshot,device:{...snapshot.device!,id:'device-b'},vitals:{...snapshot.vitals!,device_id:'device-b'}};
      }else if(change==='vitals')snapshot={...snapshot,vitals:{...snapshot.vitals!,id:2,heart_rate:130}};
      else snapshot={...snapshot,activity:{steps:100,distance_km:0.1,calories:5,active_minutes:1,timestamp:snapshot.server_time}};
      await store.getState().fetchInitialData();await finish(pending);
      expect(store.getState().device?.id).toBe(snapshot.device?.id);
      expect(store.getState().insights).toEqual(snapshot.insights);expect(store.getState().insightsOffline).toBe(true);
    });
    it('discards guidance after a profile refresh changes its inputs',async()=>{
      const pending=store.getState().fetchInsights();
      snapshot={...snapshot,profile:{...snapshot.profile!,medications:'Changed'}};
      await store.getState().fetchProfile();await finish(pending);
      expect(store.getState().profile?.medications).toBe('Changed');expect(store.getState().insights).toEqual(snapshot.insights);
    });
    it('accepts guidance after a heartbeat and replayed older vital reading',async()=>{
      const update=await subscribe(),pending=store.getState().fetchInsights();
      update({type:'device',data:{...snapshot.device!,last_seen:new Date(Date.now()+1000).toISOString(),battery:80}});
      update({type:'vitals',data:reading(0)});
      await finish(pending);
      expect(store.getState().vitals?.id).toBe(1);expect(store.getState().insights).toEqual(generated);
    });
    it('discards guidance when a live critical reading arrives',async()=>{
      const update=await subscribe(),pending=store.getState().fetchInsights();
      update({type:'vitals',data:{...snapshot.vitals!,id:2,heart_rate:165}});
      await finish(pending);
      expect(store.getState().vitals?.heart_rate).toBe(165);expect(store.getState().insightsOffline).toBe(true);
      expect(store.getState().insights).toEqual(snapshot.insights);
    });
    it('ignores legacy device activity without changing Google activity or AI context',async()=>{
      const update=await subscribe(),pending=store.getState().fetchInsights();
      update({type:'activity',data:{...reading(2),steps:100,distance_km:0.1,calories:5,active_minutes:1}});
      await finish(pending);
      expect(store.getState().activity).toBeNull();
      expect(store.getState().insights).toEqual(generated);
    });
    it('discards guidance when readings become stale during the request',async()=>{
      vi.useFakeTimers();const pending=store.getState().fetchInsights();
      vi.setSystemTime(Date.now()+31000);store.getState().tick();await finish(pending);
      expect(store.getState().freshness.state).toBe('stale');expect(store.getState().insightsOffline).toBe(true);
    });
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
  it('deletes an emergency contact and updates store state',async()=>{
    vi.mocked(fetch).mockResolvedValue(new Response('{}',{status:200}));
    api.setToken('session');
    store.setState({contacts:[{id:1,name:'Dr. Smith',phone:'555-0100',relation:'Doctor'},{id:2,name:'Mom',phone:'555-0101',relation:'Family'}]});
    const result=await store.getState().deleteContact(1);
    expect(result).toBe(true);
    expect(store.getState().contacts).toEqual([{id:2,name:'Mom',phone:'555-0101',relation:'Family'}]);
  });
  it('clears active application error state',async()=>{
    store.setState({error:'Temporary service connection glitch'});
    expect(store.getState().error).toBe('Temporary service connection glitch');
    store.getState().clearError();
    expect(store.getState().error).toBe('');
  });
});
