import {describe,it,expect} from 'vitest';
import {shareableVitals} from './shareableVitals';
import type {DeviceStatus,Freshness,VitalReading} from '../../../../shared/types/health';

const freshness:Freshness={state:'missing',age_seconds:null,stale_seconds:30};
const timestamp=new Date().toISOString();
const device:DeviceStatus={id:'fixture-device',device_name:'Fixture',active:true,connected:true,battery:null,last_seen:timestamp,source:'ESP32_MAX30102_DS18B20_AD8232',
  equipment:{observed_at:timestamp,temperature_c:24.5,heart_rate:null,spo2:null,ecg_status:'Unknown',ecg_raw_adc:2000,ecg_millivolts:1400,ecg_samples:10,ecg_clipped_samples:0}};
describe('Measured values used in a user-reviewed clinician email',()=>{
  it('shares fresh probe data independently and identifies its measurement type',()=>{
    const result=shareableVitals(null,device,freshness);
    expect(result).toContain('Probe: 24.5°C');expect(result).not.toContain('Body Temp');expect(result).not.toContain('Heart rate:');
  });
  it('withholds disconnected, stale and generated measurements',()=>{
    expect(shareableVitals(null,{...device,connected:false},freshness)).toContain('No fresh');
    expect(shareableVitals(null,{...device,last_seen:'2020-01-01T00:00:00Z'},freshness)).toContain('No fresh');
    expect(shareableVitals(null,{...device,source:'DisplayPreview'},freshness)).toContain('No fresh');
  });
  it('withholds complete readings from another device or an explicit preview',()=>{
    const vitals={device_id:'other',source:'DisplayPreview',timestamp,heart_rate:72,spo2:98,temperature:36.5} as VitalReading;
    expect(shareableVitals(vitals,{...device,equipment:null},{...freshness,state:'fresh'})).toContain('No fresh');
    expect(shareableVitals({...vitals,device_id:device.id,source:'ESP32_MAX30102_DS18B20_AD8232',timestamp:'2020-01-01T00:00:00Z'},{...device,equipment:null},{...freshness,state:'fresh'})).toContain('No fresh');
  });
});
