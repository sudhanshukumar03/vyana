import {describe,it,expect} from 'vitest';
import type {ECGBatch} from '../../../../shared/types/ecg';
import {ecgCSV,ecgPath,ecgPoints,mergeECG} from './ecg';
const now=Date.now();
const batch=(id:number,sequence=1):ECGBatch=>({id,device_id:'fixture',session_id:'boot-a',sequence,observed_at:new Date(now-1000).toISOString(),source:'ESP32_MAX30102_DS18B20_AD8232',samples:[[0,2000,0],[4,4095,0],[8,1800,0]]});
describe('raw waveform presentation',()=>{
  it('bounds memory, deduplicates retries and rejects stale data from the displayed window',()=>{
    expect(mergeECG([batch(1)],[batch(1),batch(2)])).toHaveLength(2);
    expect(mergeECG([],Array.from({length:50},(_,i)=>batch(i)))).toHaveLength(24);
    expect(ecgPoints([{...batch(1),observed_at:new Date(now-60000).toISOString()}],now)).toEqual([]);
    expect(ecgPoints([{...batch(1),observed_at:new Date(now+1000).toISOString()}],now)).toEqual([]);
    expect(ecgPath([],now)).toBe('');
  });
  it('breaks the path for loss, long sampling gaps, reboot and detached leads',()=>{
    const points=ecgPoints([batch(1)],now);expect(ecgPath(points,now).match(/L/g)).toHaveLength(2);
    for(const change of [{sequence:99},{time:points[0].time+100},{session:'boot-b'},{leads:1}]) {
      const path=ecgPath([points[0],{...points[1],...change}],now);expect(path).not.toContain('L');
    }
    expect(ecgPath([points[0],{...points[1],leads:1},points[2]],now).match(/M/g)).toHaveLength(2);
  });
  it('exports exact ADC counts and lead flags rather than interpolated or calibrated values',()=>{
    const csv=ecgCSV(ecgPoints([batch(1)],now));expect(csv).toContain(',2,4095,0');expect(csv).not.toContain('mV');
  });
});
