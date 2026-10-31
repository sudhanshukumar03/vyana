import {z} from 'zod';
import type {SosPreferences} from '../../../shared/types/sos';

const ids=z.array(z.number().int().positive()).max(10).refine(v=>new Set(v).size===v.length,'Choose each contact once');
export const sosPreferencesSchema=z.object({
  sharing_enabled:z.boolean(),auto_enabled:z.boolean(),daily_report_enabled:z.boolean(),fault_report_enabled:z.boolean(),
  email_enabled:z.boolean(),sms_enabled:z.boolean(),call_enabled:z.boolean(),attach_report:z.boolean(),
  emergency_contact_ids:ids,report_contact_ids:ids,
  critical_seconds:z.number().int().min(30).max(600),minimum_samples:z.number().int().min(3).max(120),
  cancel_seconds:z.number().int().min(15).max(120),cooldown_minutes:z.number().int().min(15).max(1440),
  daily_hour:z.number().int().min(0).max(23),
}).strict();
export const defaultSosPreferences: SosPreferences={sharing_enabled:false,auto_enabled:false,
  daily_report_enabled:false,fault_report_enabled:false,email_enabled:true,sms_enabled:false,call_enabled:false,
  attach_report:true,emergency_contact_ids:[],report_contact_ids:[],critical_seconds:30,minimum_samples:3,
  cancel_seconds:30,cooldown_minutes:60,daily_hour:20};
export const hardwareSources=new Set(['ESP32_MAX30102_DS18B20_AD8232','ESP32_RealVitals_SimulatedSteps']);
export interface SosObservation {
  observed_at:string;source:string;heart_rate:number|null;spo2:number|null;temperature:number|null;
  ecg_status:string;quality:string[];priority:number;
  ecg_raw_adc?:number;ecg_millivolts?:number;ecg_samples?:number;ecg_clipped_samples?:number;
}
export interface Signal {since:number;count:number}
export function criticalSignals(reading:SosObservation) {
  const flags:string[]=[];
  if(reading.heart_rate!=null && reading.heart_rate>0 && reading.heart_rate<40)flags.push('Low heart rate');
  if(reading.heart_rate!=null && reading.heart_rate>150 && reading.heart_rate<=300)flags.push('High heart rate');
  if(reading.spo2!=null && reading.spo2>0 && reading.spo2<88)flags.push('Low oxygen reading');
  return flags;
}
export function advanceSignals(previous:Record<string,Signal>,reading:SosObservation,continuous:boolean,
  settings:SosPreferences):{signals:Record<string,Signal>;trigger:string|null} {
  const at=Date.parse(reading.observed_at),signals:Record<string,Signal>={};let trigger:string|null=null;
  for(const flag of criticalSignals(reading)) {
    const old=continuous?previous[flag]:undefined;
    signals[flag]={since:old?.since??at,count:(old?.count??0)+1};
    if(at-signals[flag].since>=settings.critical_seconds*1000&&signals[flag].count>=settings.minimum_samples)trigger=flag;
  }
  return {signals,trigger};
}
export function internationalPhone(value:string|null|undefined) {
  const compact=(value||'').replace(/[\s().-]/g,'');
  return /^\+[1-9]\d{7,14}$/.test(compact)?compact:null;
}
