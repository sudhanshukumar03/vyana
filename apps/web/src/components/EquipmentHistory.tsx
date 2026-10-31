import {useEffect,useState} from 'react';
import {apiJson} from '../services/api';
import {useHealthStore} from '../store/useHealthStore';
import {readingSourceLabel} from '../services/equipment';
import type {EquipmentSnapshot} from '../../../../shared/types/health';
import {LineChart,Line,XAxis,YAxis,Tooltip,ResponsiveContainer} from 'recharts';

type Row={id:number;observed_at:string;source:string;equipment:EquipmentSnapshot};
export function EquipmentHistory({showTrend=false}:{showTrend?:boolean}) {
  const owner=useHealthStore(state=>state.user?.id),device=useHealthStore(state=>state.device?.id);
  return <OwnedEquipmentHistory key={`${owner}:${device}`} showTrend={showTrend}/>;
}
function OwnedEquipmentHistory({showTrend}:{showTrend:boolean}) {
  const observed=useHealthStore(state=>state.device?.equipment?.observed_at);
  const [rows,setRows]=useState<Row[]>([]),[pages,setPages]=useState<number[]>([]),[error,setError]=useState('');
  const cursor=pages.at(-1);
  const [metric,setMetric]=useState<'temperature_c'|'heart_rate'|'spo2'>('temperature_c');
  const labels={temperature_c:'Probe temperature (°C)',heart_rate:'Heart rate (bpm)',spo2:'SpO2 (%)'};
  const chartRows=[...rows].sort((a,b)=>Date.parse(a.observed_at)-Date.parse(b.observed_at)).map(row=>({observed_at:row.observed_at,value:row.equipment[metric]}));
  useEffect(()=>{
    const controller=new AbortController();
    void apiJson<Row[]>(`/equipment/history?limit=50${cursor?`&before=${cursor}`:''}`,{signal:controller.signal})
      .then(value=>{setRows(value);setError('');}).catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Could not load sensor history.');});
    return ()=>controller.abort();
  },[observed,cursor]);
  const value=(n:number|null|undefined)=>n==null?'—':n.toLocaleString();
  return <section className="surface" aria-labelledby="equipment-history-title">
    <h2 id="equipment-history-title" className="surface-title">Individual sensor history</h2>
    <p className="surface-description">Recorded snapshots from the selected device, retained for 30 days. Missing channels stay unavailable. ADC values are input summaries, not an ECG waveform.</p>
    {error&&<p role="alert" className="text-critical mt-3">{error}</p>}
    {showTrend&&<div className="mt-4"><label className="field-label" htmlFor="partial-trend-channel">Sensor channel</label><select id="partial-trend-channel" className="ui-input" value={metric} onChange={event=>setMetric(event.target.value as typeof metric)}><option value="temperature_c">{labels.temperature_c}</option><option value="heart_rate">{labels.heart_rate}</option><option value="spo2">{labels.spo2}</option></select><p className="surface-description mt-2">Plot of the loaded snapshots only. Missing measurements remain gaps.</p>
      {chartRows.some(row=>row.value!=null)?<div className="h-64 mt-3" role="img" aria-label={labels[metric]}><ResponsiveContainer width="100%" height="100%"><LineChart data={chartRows}><XAxis dataKey="observed_at" tickFormatter={time=>new Date(time).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})} minTickGap={25}/><YAxis width={45} domain={['auto','auto']}/><Tooltip labelFormatter={time=>new Date(time).toLocaleString()}/><Line dataKey="value" name={labels[metric]} stroke="var(--color-brand)" dot={false} connectNulls={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>:<p className="text-sm text-muted my-4">No recorded values for this channel.</p>}
    </div>}
    <div className="table-scroll mt-4" tabIndex={0} role="region" aria-label="Individual sensor history table">
      <table><thead><tr><th>Recorded</th><th>Heart rate (bpm)</th><th>SpO2 (%)</th><th>Probe (°C)</th><th>ECG input</th><th>ADC</th><th>Source</th></tr></thead>
        <tbody>{rows.length?rows.map(row=><tr key={row.id}><td>{new Date(row.observed_at).toLocaleString()}</td><td>{value(row.equipment.heart_rate)}</td><td>{value(row.equipment.spo2)}</td><td>{value(row.equipment.temperature_c)}</td><td>{row.equipment.ecg_status}</td><td>{value(row.equipment.ecg_raw_adc)}</td><td>{readingSourceLabel(row.source)}</td></tr>):<tr><td colSpan={7}>No sensor snapshots recorded yet.</td></tr>}</tbody>
      </table>
    </div>
    <div className="flex flex-wrap gap-3 mt-4"><button type="button" className="ui-button secondary" disabled={!pages.length} onClick={()=>setPages(previous=>previous.slice(0,-1))}>Newer snapshots</button><button type="button" className="ui-button secondary" disabled={rows.length<50} onClick={()=>setPages(previous=>[...previous,rows.at(-1)!.id])}>Older snapshots</button></div>
  </section>;
}
