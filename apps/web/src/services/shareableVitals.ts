import type {DeviceStatus,VitalReading,Freshness} from '../../../../shared/types/health';
import {currentSensorReadings,isGeneratedSource,liveEquipment} from './equipment';

export function shareableVitals(vitals:VitalReading|null,device:DeviceStatus|null,freshness:Freshness) {
  const now=Date.now(),age=vitals?now-Date.parse(vitals.timestamp):NaN;
  const equipment=liveEquipment(device,now,freshness.stale_seconds);
  const recorded=vitals&&freshness.state==='fresh'&&device?.active&&device.connected&&
    vitals.device_id===device.id&&Number.isFinite(age)&&age>=-5000&&age<=freshness.stale_seconds*1000&&!isGeneratedSource(vitals.source)?vitals:null;
  if(!equipment&&!recorded)return 'No fresh measured readings available.';
  const current=currentSensorReadings(recorded??{},equipment);
  const parts=[current.heart_rate!=null?`Heart rate: ${current.heart_rate} bpm`:null,
    current.spo2!=null?`SpO2: ${current.spo2}%`:null,
    current.temperature!=null?`${current.fromEquipment?'Probe':'Temperature'}: ${current.temperature}°C`:null].filter(Boolean);
  return parts.length?`Recorded at ${equipment?.observed_at??recorded?.timestamp}: ${parts.join(', ')}. Sensor measurements; not a clinical assessment.`:'No fresh measured readings available.';
}
