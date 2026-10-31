import {create} from 'zustand';
import {useHealthStore} from './useHealthStore';
import {currentSensorReadings,isGeneratedSource,liveEquipment} from '../services/equipment';
import {previewHistory,previewWellnessScore,sensorPreview} from '../services/sensorPreview';
import {activityFromGoogle} from '../services/googleActivity';

export const useSensorPreview=create<{enabled:boolean;now:number;setEnabled:(enabled:boolean)=>void;tick:()=>void}>(set=>({
  // Demo mode must be explicitly enabled on every page load. Ignore old saved opt-ins.
  enabled:false,now:Date.now(),
  setEnabled:enabled=>set({enabled}),
  tick:()=>set({now:Date.now()}),
}));

/** Blend presentation only; the authenticated health store stays entirely untouched. */
export function useSensorPresentation(){
  const state=useHealthStore();
  const {enabled,now}=useSensorPreview();
  const equipment=liveEquipment(state.device,now);
  const deviceLive=Boolean(state.device?.active&&state.device.connected&&state.device.last_seen&&
    now-Date.parse(state.device.last_seen)>=-5000&&now-Date.parse(state.device.last_seen)<=30000);
  const vitals=state.freshness.state==='fresh'&&deviceLive&&state.vitals&&
    state.vitals.device_id===state.device?.id&&!isGeneratedSource(state.vitals.source)?state.vitals:null;
  const historicalVitals=state.historicalVitals.filter(row=>!isGeneratedSource(row.source));
  // Cloud activity is account-owned and independent of the active ESP32.
  const google=state.googleActivity;
  const realActivity=activityFromGoogle(google);
  const liveState={...state,vitals,activity:realActivity,historicalVitals,
    wellnessScore:vitals?state.wellnessScore:null,
    insights:state.vitals&&isGeneratedSource(state.vitals.source)&&!vitals?[]:state.insights};
  const current=currentSensorReadings(vitals??{},equipment);
  const previewFields:string[]=[];
  if(!enabled)return {...liveState,previewEnabled:false,previewFields,equipment,wellnessPreview:false};
  const sample=sensorPreview(now);
  const values={...sample.vitals};
  for(const field of ['heart_rate','spo2','temperature'] as const){
    const value=current[field];
    if(value!=null&&Number.isFinite(value)){
      values[field]=value;
    }
    else previewFields.push(field);
  }
  // ECG preview never invents a diagnostic classification.
  values.ecg_status=current.ecg_status??'Unknown';
  if(!equipment&&!vitals)previewFields.push('ecg_status');
  const activity=realActivity;
  const history=previewHistory(now);
  return {...liveState,vitals:values,activity,equipment,previewEnabled:true,previewFields,
    wellnessScore:liveState.wellnessScore??previewWellnessScore(values),wellnessPreview:liveState.wellnessScore==null,
    historicalVitals:historicalVitals.length?historicalVitals:history.map(row=>row.vitals)};
}
