import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {useHealthStore} from './useHealthStore';
import {useSensorPresentation,useSensorPreview} from './useSensorPresentation';
import {sensorPreview} from '../services/sensorPreview';

let root:Root,container:HTMLDivElement;
let presentation:ReturnType<typeof useSensorPresentation>;
function Probe(){
  presentation=useSensorPresentation();
  const {wellnessScore,wellnessPreview}=presentation;
  return <span data-preview={String(wellnessPreview)}>{wellnessScore??'Unavailable'}</span>;
}
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  useHealthStore.setState({vitals:null,activity:null,device:null,wellnessScore:null,historicalVitals:[],googleActivity:null,
    freshness:{state:'missing',age_seconds:null,stale_seconds:30}});
  useSensorPreview.setState({enabled:false,now:Date.now()});
  container=document.createElement('div');root=createRoot(container);
});
afterEach(()=>{act(()=>root.unmount());vi.unstubAllGlobals();});
it('shows a preview wellness score without writing it into the authenticated health store',()=>{
  useSensorPreview.getState().setEnabled(true);
  act(()=>root.render(<Probe/>));
  expect(container.textContent).toMatch(/^\d+$/);
  expect(container.firstElementChild?.getAttribute('data-preview')).toBe('true');
  expect(useHealthStore.getState().wellnessScore).toBeNull();
  expect(useHealthStore.getState().vitals).toBeNull();
});

it('shows recorded daily Google steps even when the ESP32 is disconnected',()=>{
  const now=Date.now(),date='2026-10-29';
  useHealthStore.setState({googleActivity:{provider:'GoogleHealth',configured:true,connected:true,account_email:'fixture@example.test',timezone:'Asia/Kolkata',
    today:date,last_synced_at:new Date(now-600000).toISOString(),last_attempt_at:null,error_code:null,days:[{date,steps:1234,distance_km:0.8}]},
    device:{id:'physical',device_name:'ESP32',active:true,connected:false,battery:null,last_seen:null,source:'ESP32_MAX30102_DS18B20_AD8232'}});
  act(()=>root.render(<Probe/>));
  expect(presentation.activity?.steps).toBe(1234);expect(presentation.activity?.distance_km).toBe(0.8);
  expect(presentation.vitals).toBeNull();expect(presentation.activity?.calories).toBeNull();
});

it('does not invent step counts when demo vitals are enabled',()=>{
  useSensorPreview.getState().setEnabled(true);act(()=>root.render(<Probe/>));
  expect(presentation.activity).toBeNull();expect(presentation.previewFields).not.toContain('steps');
});
it.each([{active_calories_kcal:150.75,active_minutes:17},{active_calories_kcal:0,active_minutes:0}])('shows provider-only activity metrics %j without steps or an ESP32',metrics=>{
  const date='2026-10-30';
  useHealthStore.setState({googleActivity:{provider:'GoogleHealth',configured:true,connected:true,account_email:'fixture@example.test',timezone:'Asia/Kolkata',
    today:date,last_synced_at:new Date().toISOString(),last_attempt_at:null,error_code:null,days:[{date,steps:null,distance_km:null,...metrics}]}});
  act(()=>root.render(<Probe/>));
  expect(presentation.activity).toMatchObject({steps:null,calories:metrics.active_calories_kcal,active_minutes:metrics.active_minutes,calories_type:'active'});
});
it.each([{steps:0,distance_km:0},{steps:null,distance_km:1.2}])('retains a connected cached activity day with %j even if provider setup becomes unavailable',day=>{
  const date='2026-10-30';
  useHealthStore.setState({googleActivity:{provider:'GoogleHealth',configured:false,connected:true,account_email:'fixture@example.test',timezone:'Asia/Kolkata',
    today:date,last_synced_at:new Date().toISOString(),last_attempt_at:null,error_code:null,days:[{date,...day}]}});
  act(()=>root.render(<Probe/>));
  expect(presentation.activity?.steps).toBe(day.steps);expect(presentation.activity?.distance_km).toBe(day.distance_km);
});
it('keeps an existing server score, including zero, ahead of the preview',()=>{
  const now=useSensorPreview.getState().now;
  useSensorPreview.getState().setEnabled(true);
  useHealthStore.setState({wellnessScore:0,vitals:{...sensorPreview(now).vitals,device_id:'physical',source:'ESP32_MAX30102_DS18B20_AD8232'},
    device:{id:'physical',device_name:'Physical test fixture',active:true,connected:true,battery:null,last_seen:new Date(now).toISOString(),source:'ESP32_MAX30102_DS18B20_AD8232'},
    freshness:{state:'fresh',age_seconds:0,stale_seconds:30}});
  act(()=>root.render(<Probe/>));
  expect(container.textContent).toBe('0');
  expect(container.firstElementChild?.getAttribute('data-preview')).toBe('false');
});
it('removes the generated score when switching to live-only mode',()=>{
  useSensorPreview.getState().setEnabled(true);
  act(()=>root.render(<Probe/>));
  act(()=>useSensorPreview.getState().setEnabled(false));
  expect(container.textContent).toBe('Unavailable');
  expect(container.firstElementChild?.getAttribute('data-preview')).toBe('false');
  expect(useHealthStore.getState().wellnessScore).toBeNull();
});

it('starts in live-only mode and never persists a demo opt-in',()=>{
  localStorage.setItem('vyaana.sensor-preview.v1','off');
  expect(useSensorPreview.getInitialState().enabled).toBe(false);
  useSensorPreview.getState().setEnabled(true);
  expect(localStorage.getItem('vyaana.sensor-preview.v1')).toBe('off');
  useSensorPreview.getState().setEnabled(false);
  act(()=>root.render(<Probe/>));
  expect(presentation.vitals).toBeNull();expect(presentation.activity).toBeNull();
  expect(presentation.historicalVitals).toEqual([]);
});

it('hides received simulator values, scores and activity in live mode without deleting stored history',()=>{
  const sample=sensorPreview(useSensorPreview.getState().now);
  const vitals={...sample.vitals,source:'Simulator',device_id:'virtual'};
  // An explicit historical fixture verifies that old generated records stay hidden.
  const activity={id:1,session_id:'legacy-activity',sequence:1,device_id:'virtual',source:'ESP32_MPU6050_Simulated',
    timestamp:sample.vitals.timestamp,observed_at:sample.vitals.timestamp,received_at:sample.vitals.timestamp,
    steps:100,distance_km:0.08,calories:4,active_minutes:1};
  useHealthStore.setState({vitals,activity,historicalVitals:[vitals],wellnessScore:100,
    device:{id:'virtual',device_name:'Fixture',active:true,connected:true,battery:100,last_seen:sample.vitals.timestamp,source:'Simulator'},
    freshness:{state:'fresh',age_seconds:0,stale_seconds:30}});
  act(()=>root.render(<Probe/>));
  expect(presentation.vitals).toBeNull();expect(presentation.activity).toBeNull();expect(presentation.wellnessScore).toBeNull();
  expect(presentation.historicalVitals).toEqual([]);
  expect(useHealthStore.getState().historicalVitals).toHaveLength(1);
});

it('keeps independent physical equipment available without filling missing optical values',()=>{
  const timestamp=new Date(useSensorPreview.getState().now).toISOString();
  useHealthStore.setState({device:{id:'physical',device_name:'Fixture',active:true,connected:true,battery:null,
    last_seen:timestamp,source:'ESP32_RealVitals_SimulatedSteps',equipment:{observed_at:timestamp,
      heart_rate:null,spo2:null,temperature_c:24.9375,ecg_status:'Leads Off',ecg_raw_adc:0,ecg_millivolts:142,ecg_samples:1000,ecg_clipped_samples:1000}}});
  act(()=>root.render(<Probe/>));
  expect(presentation.equipment?.temperature_c).toBe(24.9375);
  expect(presentation.equipment?.heart_rate).toBeNull();expect(presentation.vitals).toBeNull();
  expect(presentation.previewFields).toEqual([]);expect(presentation.wellnessScore).toBeNull();
});

it('preserves a zero-degree real probe in demo mode instead of replacing it',()=>{
  const timestamp=new Date(useSensorPreview.getState().now).toISOString();
  useSensorPreview.getState().setEnabled(true);
  useHealthStore.setState({device:{id:'physical',device_name:'Fixture',active:true,connected:true,battery:null,
    last_seen:timestamp,source:'ESP32_MAX30102_DS18B20_AD8232',equipment:{observed_at:timestamp,
      temperature_c:0,ecg_status:'Leads Off',ecg_raw_adc:0,ecg_millivolts:142,ecg_samples:1,ecg_clipped_samples:1}}});
  act(()=>root.render(<Probe/>));
  expect(presentation.vitals?.temperature).toBe(0);expect(presentation.previewFields).not.toContain('temperature');
});

it('hides stale physical current readings while retaining genuine recorded history',()=>{
  const now=useSensorPreview.getState().now;
  const vitals={...sensorPreview(now-60000).vitals,device_id:'physical',source:'ESP32_MAX30102_DS18B20_AD8232'};
  useHealthStore.setState({vitals,historicalVitals:[vitals],wellnessScore:100,
    device:{id:'physical',device_name:'Fixture',active:true,connected:true,battery:null,last_seen:new Date(now-60000).toISOString(),source:vitals.source},
    freshness:{state:'stale',age_seconds:60,stale_seconds:30}});
  act(()=>root.render(<Probe/>));
  expect(presentation.vitals).toBeNull();expect(presentation.wellnessScore).toBeNull();
  expect(presentation.historicalVitals).toEqual([vitals]);
});
