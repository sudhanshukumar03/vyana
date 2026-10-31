import type {ECGBatch} from '../../../../shared/types/ecg';
export function mergeECG(previous:ECGBatch[],incoming:ECGBatch[]) {
  return [...new Map([...previous,...incoming].map(batch=>[batch.id,batch])).values()].sort((a,b)=>a.id-b.id).slice(-24);
}
export function ecgPoints(batches:ECGBatch[],now:number) {
  return batches.flatMap(batch=>batch.samples.map(([offset,raw,leads],i)=>({
    time:Date.parse(batch.observed_at)+offset,raw,leads,sequence:batch.sequence+i,session:batch.session_id,
  }))).filter(point=>point.time<=now&&point.time>=now-4000)
    .sort((a,b)=>a.time-b.time||a.sequence-b.sequence).slice(-1000);
}
export function ecgPath(points:ReturnType<typeof ecgPoints>,now:number) {
  let previous:typeof points[number]|undefined;
  return points.map(point=>{
    const connected=previous&&point.session===previous.session&&point.sequence===previous.sequence+1&&point.time>previous.time&&point.time-previous.time<=20;
    previous=point;
    if(point.leads){previous=undefined;return '';}
    return `${connected?'L':'M'}${((point.time-(now-4000))*720/4000).toFixed(2)},${(170-point.raw*160/4095).toFixed(2)}`;
  }).join(' ');
}
export function ecgCSV(points:ReturnType<typeof ecgPoints>) {
  return ['Observed UTC,Session,Sample sequence,Raw ADC,Lead flags',...points.map(point=>[
    new Date(point.time).toISOString(),point.session,point.sequence,point.raw,point.leads,
  ].join(','))].join('\n');
}
