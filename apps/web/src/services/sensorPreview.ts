import type {VitalReading} from '../../../../shared/types/health';

/** Display-only examples. Never send these objects to ingestion or reporting APIs. */
export function sensorPreview(now: number) {
  const slot=Math.floor(now/5000), t=slot*5000;
  const timestamp=new Date(t).toISOString();
  const reading={id:-slot,device_id:'display-preview',session_id:'display-preview',sequence:slot,
    timestamp,observed_at:timestamp,received_at:timestamp,source:'DisplayPreview'};
  const heart_rate=Math.round(76+4*Math.sin(slot*.13)+2*Math.sin(slot*.37));
  const spo2=Math.round(98+.6*Math.sin(slot*.08));
  const temperature=Number((36.6+.15*Math.sin(slot*.04)).toFixed(1));
  const vitals:VitalReading={...reading,heart_rate,spo2,temperature,ecg_status:'Unknown'};
  return {vitals};
}

export function previewHistory(now:number) {
  return Array.from({length:20},(_,i)=>sensorPreview(now-(19-i)*60000));
}

/** Illustrative display heuristic; excludes ECG and never becomes a saved health score. */
export function previewWellnessScore(values:Pick<VitalReading,'heart_rate'|'spo2'|'temperature'>){
  const {heart_rate:hr,spo2,temperature:temp}=values;
  let score=100-(hr>90||hr<60?10:0)-(spo2<95?15:0)-(temp>38||temp<35?20:0);
  if(hr>150||hr<40||spo2<88||temp>39.5)score=Math.min(score,60);
  else if(hr>120||hr<45||spo2<92||temp>38||temp<35)score=Math.min(score,80);
  return Math.max(0,score);
}
