import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import type {GoogleHealthOverview} from '../../../../shared/types/google-health';
let store:typeof import('../store/useHealthStore').useHealthStore;
let api:typeof import('./api');
let hook:typeof import('./useHealthReview').useHealthReview;
let root:Root,container:HTMLDivElement;
let current:ReturnType<typeof hook>;
let pending:((value:Response)=>void)[];
function Probe(){current=hook();return <span>{current.data?.body.maintenance_kcal??'Unavailable'}</span>;}
beforeEach(async()=>{
  vi.resetModules();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);pending=[];
  store=(await import('../store/useHealthStore')).useHealthStore;api=await import('./api');hook=(await import('./useHealthReview')).useHealthReview;
  vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>pending.push(resolve))));
  const google:GoogleHealthOverview={provider:'GoogleHealth',configured:true,connected:true,account_email:'fixture@example.test',timezone:'Asia/Kolkata',today:'2026-10-30',last_synced_at:null,last_attempt_at:null,error_code:null,days:[]};
  api.setToken('synthetic-review-token');store.setState({token:'synthetic-review-token',user:{id:1,email:'fixture@example.test'},profile:{onboarded:true,height_cm:175,weight_kg:70,nutrition_review:'standard'},googleActivity:google,device:null});
  container=document.createElement('div');root=createRoot(container);
});
afterEach(()=>{act(()=>root.unmount());vi.unstubAllGlobals();});
it.each(['google','profile','device','session'] as const)('clears old review data on a %s context change and rejects a late response',async context=>{
  await act(async()=>{root.render(<Probe/>);});
  await act(async()=>{pending[0](new Response(JSON.stringify({body:{maintenance_kcal:2550}})));});
  expect(container.textContent).toBe('2550');
  await act(async()=>{current.reload();});
  const oldResponse=pending[1];
  await act(async()=>{
    if(context==='google')store.setState({googleActivity:{...store.getState().googleActivity!,connected:false,days:[]}});
    if(context==='profile')store.setState({profile:{...store.getState().profile!,nutrition_review:'required'}});
    if(context==='device')store.setState({device:{id:'new-device',device_name:'New source',active:true,connected:false,battery:null,last_seen:null,source:'ESP32_MAX30102_DS18B20_AD8232'}});
    if(context==='session')store.getState().logout();
  });
  expect(container.textContent).toBe('Unavailable');
  await act(async()=>{oldResponse(new Response(JSON.stringify({body:{maintenance_kcal:9999}})));});
  expect(container.textContent).toBe('Unavailable');
});
