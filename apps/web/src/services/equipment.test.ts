import {describe,it,expect} from 'vitest';
import type {DeviceStatus} from '../../../../shared/types/health';
import {liveEquipment,currentSensorReadings,readingSourceLabel} from './equipment';

describe('independent equipment freshness',()=>{
  const now=Date.parse('2026-10-27T12:00:00Z');
  const device:DeviceStatus={id:'device',device_name:'ESP32',active:true,connected:true,battery:null,
    source:'ESP32_RealVitals_SimulatedSteps',last_seen:new Date(now).toISOString(),equipment:{
      observed_at:new Date(now-1000).toISOString(),temperature_c:25.1875,ecg_status:'Leads Off',
      ecg_raw_adc:4095,ecg_millivolts:3160,ecg_samples:0,ecg_clipped_samples:0}};
  it('shows a current real probe independently of complete vitals',()=>{
    expect(liveEquipment(device,now)?.temperature_c).toBe(25.1875);
    expect(liveEquipment(device,now)?.ecg_status).toBe('Leads Off');
  });
  it('does not refresh an old observation with a new heartbeat',()=>{
    expect(liveEquipment({...device,equipment:{...device.equipment!,observed_at:new Date(now-31000).toISOString()}},now)).toBeNull();
  });
  it('hides disconnected, inactive and stale-heartbeat sources',()=>{
    expect(liveEquipment({...device,connected:false},now)).toBeNull();
    expect(liveEquipment({...device,active:false},now)).toBeNull();
    expect(liveEquipment({...device,last_seen:new Date(now-31000).toISOString()},now)).toBeNull();
    expect(liveEquipment({...device,source:'Simulator'},now)).toBeNull();
  });
  it('rejects invalid and future timestamps and preserves an unavailable probe',()=>{
    expect(liveEquipment({...device,equipment:{...device.equipment!,observed_at:'invalid'}},now)).toBeNull();
    expect(liveEquipment({...device,equipment:{...device.equipment!,observed_at:new Date(now+6000).toISOString()}},now)).toBeNull();
    expect(liveEquipment({...device,equipment:{...device.equipment!,temperature_c:null}},now)?.temperature_c).toBeNull();
  });
  it('shows independent optical channels even when temperature is unavailable',()=>{
    const current=currentSensorReadings({}, {...device.equipment!,heart_rate:72,spo2:98,temperature_c:null});
    expect(current).toMatchObject({heart_rate:72,spo2:98,temperature:null,fromEquipment:true});
  });
  it('clears old saved readings on explicit null but preserves omitted legacy optical fields',()=>{
    const saved={timestamp:new Date(now-2000).toISOString(),heart_rate:72,spo2:98,temperature:36.5,ecg_status:'Normal' as const};
    expect(currentSensorReadings(saved,{...device.equipment!,heart_rate:null,spo2:null,temperature_c:null}))
      .toMatchObject({heart_rate:null,spo2:null,temperature:null,ecg_status:'Leads Off'});
    expect(currentSensorReadings(saved,device.equipment)).toMatchObject({heart_rate:72,spo2:98,temperature:25.1875});
  });
  it('keeps newer saved readings when equipment arrives out of order',()=>{
    const saved={timestamp:new Date(now).toISOString(),heart_rate:80,spo2:99,temperature:36.7,ecg_status:'Unknown' as const};
    expect(currentSensorReadings(saved,{...device.equipment!,heart_rate:null,spo2:null}))
      .toMatchObject({heart_rate:80,spo2:99,temperature:36.7,ecg_status:'Unknown',fromEquipment:false});
  });
  it('uses product labels without changing source identifiers',()=>{
    expect(readingSourceLabel('ESP32_RealVitals_SimulatedSteps')).toBe('ESP32 sensor hub');
    expect(readingSourceLabel('ESP32_MAX30102_DS18B20_AD8232')).toBe('ESP32 health sensors');
    expect(readingSourceLabel('ESP32_MPU6050_Simulated')).toBe('Generated activity feed');
    expect(readingSourceLabel(null)).toBe('No active source');
  });
});
