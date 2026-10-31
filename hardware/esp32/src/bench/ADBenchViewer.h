#pragma once
#include <pgmspace.h>
const char AD_BENCH_VIEWER[] PROGMEM = R"ECGHTML(<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vyaana · AD8232 live input</title><style>
:root{color-scheme:light;--ink:#163e38;--muted:#536c66;--line:#ccdcd6;--accent:#087f72;--paper:#f4f8f5;--warn:#89500b}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 system-ui,sans-serif}
main{max-width:1120px;margin:auto;padding:32px 24px}header{display:flex;justify-content:space-between;gap:20px;align-items:center;border-bottom:1px solid var(--line);padding-bottom:20px}
.brand{font-size:24px;font-weight:750;letter-spacing:-1px}h1{font-size:clamp(26px,4vw,38px);line-height:1.15;letter-spacing:-1px;margin:32px 0 8px}p{margin:8px 0;color:var(--muted)}
.badge{padding:8px 14px;border:1px solid var(--line);border-radius:30px;font-weight:600;font-size:14px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:24px 0}
.stat,.trace{background:white;border:1px solid var(--line);border-radius:12px;padding:20px}.label{font-size:14px;color:var(--muted)}.value{font-size:30px;font-weight:650;letter-spacing:-1px;margin-top:6px;font-variant-numeric:tabular-nums}
.tools{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}.tools h2{font-size:19px;margin:0}button{font:inherit;min-height:44px;padding:8px 16px;border:1px solid var(--accent);border-radius:8px;background:white;color:var(--accent);cursor:pointer}button:focus-visible{outline:3px solid #123a32;outline-offset:3px}
canvas{width:100%;height:340px;display:block;margin-top:20px}.detail{display:flex;gap:24px;flex-wrap:wrap;font-size:14px;margin-top:12px}.note{border-left:3px solid var(--accent);padding-left:16px;margin-top:24px}.warning{color:var(--warn)}
@media(max-width:640px){main{padding:20px 14px}.stats{grid-template-columns:repeat(2,1fr);gap:10px}.stat,.trace{padding:14px}.value{font-size:24px}canvas{height:280px}.brand{font-size:22px}}
</style></head><body><main>
<header><span class="brand">Vyaana</span><span class="badge" id="connection" role="status">Waiting for samples</span></header>
<h1>AD8232 live input</h1><p>Raw signal acquisition · ESP32 GPIO34 · five-second trace</p>
<section class="stats" aria-label="Current acquisition values">
<div class="stat"><div class="label">Latest ADC · 0–4095</div><div class="value" id="adc">—</div></div>
<div class="stat"><div class="label">Electrode contact</div><div class="value" id="leads">Waiting</div></div>
<div class="stat"><div class="label">Clipping · recent second</div><div class="value" id="clipping">—</div></div>
<div class="stat"><div class="label">Observed sample rate</div><div class="value" id="rate">—</div></div>
</section>
<section class="trace"><div class="tools"><h2>Raw ADC trace</h2><button id="pause" type="button" aria-pressed="false">Freeze trace</button></div>
<canvas id="trace" role="img" aria-label="Raw ADC input over the most recent five seconds. Numeric values and signal status are provided above."></canvas>
<div class="detail"><span id="pins">LO+ — · LO− —</span><span id="gaps">Maximum sample gap —</span><span id="loss">Missed samples 0</span></div>
<p id="interpretation" class="warning">No signal received yet.</p></section>
<p class="note">This viewer shows the measured ADC input. It does not classify rhythm or calculate heart rate. A changing trace alone does not establish a usable ECG.</p>
<p>Body-connected operation: standalone battery power and wireless monitoring. Keep computer USB disconnected.</p>
</main><script>
const $=id=>document.getElementById(id),canvas=$('trace'),ctx=canvas.getContext('2d');
let samples=[],cursor=0,boot=null,missed=0,frozen=false,lastReceived=0;
$('pause').onclick=()=>{frozen=!frozen;$('pause').textContent=frozen?'Resume trace':'Freeze trace';$('pause').setAttribute('aria-pressed',String(frozen));if(!frozen)draw()};
function draw(){
 const bounds=canvas.getBoundingClientRect(),ratio=devicePixelRatio||1;
 canvas.width=Math.round(bounds.width*ratio);canvas.height=Math.round(bounds.height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);
 const w=bounds.width,h=bounds.height,left=48,right=12,top=12,bottom=28,pw=w-left-right,ph=h-top-bottom;
 ctx.clearRect(0,0,w,h);ctx.font='12px system-ui';ctx.textAlign='right';ctx.fillStyle='#536c66';ctx.lineWidth=1;
 for(const value of [0,1024,2048,3072,4095]){const y=top+ph*(1-value/4095);ctx.strokeStyle='#e5eee9';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();ctx.fillText(String(value),left-8,y+4)}
 ctx.textAlign='center';for(let i=0;i<=5;i++){const x=left+pw*i/5;ctx.strokeStyle='#e5eee9';ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,h-bottom);ctx.stroke();ctx.fillText(i===5?'now':`${i-5} s`,x,h-7)}
 if(!samples.length){ctx.fillStyle='#536c66';ctx.fillText('Waiting for measured samples',left+pw/2,top+ph/2);return}
 const end=samples.at(-1)[1],visible=samples.filter(s=>s[1]>=end-5000);let previous=null;
 ctx.strokeStyle='#087f72';ctx.lineWidth=1.4;ctx.beginPath();
 for(const s of visible){const x=left+pw*(s[1]-(end-5000))/5000,y=top+ph*(1-s[2]/4095);if(!previous||s[0]!==previous[0]+1||s[1]-previous[1]>20)ctx.moveTo(x,y);else ctx.lineTo(x,y);previous=s}ctx.stroke();
}
function update(){
 if(!samples.length)return;const latest=samples.at(-1),recent=samples.filter(s=>s[1]>=latest[1]-1000),clipped=recent.filter(s=>s[2]<=5||s[2]>=4090).length;
 const gaps=recent.slice(1).map((s,i)=>s[1]-recent[i][1]),duration=latest[1]-recent[0][1];
 $('adc').textContent=latest[2];$('leads').textContent=latest[3]||latest[4]?'Leads off':'Unclassified';
 $('clipping').textContent=(100*clipped/recent.length).toFixed(1)+'%';$('rate').textContent=duration>0?(1000*(recent.length-1)/duration).toFixed(1)+' Hz':'—';
 $('pins').textContent=`LO+ ${latest[3]?'HIGH':'LOW'} · LO− ${latest[4]?'HIGH':'LOW'}`;
 $('gaps').textContent=`Maximum sample gap ${gaps.length?Math.max(...gaps):0} ms`; $('loss').textContent=`Missed samples ${missed}`;
 $('interpretation').textContent=latest[3]||latest[4]?'Lead-off indicated. This input is not an interpretable ECG.':clipped/recent.length>.05?'Input clipping detected. Check contact and signal quality; this is not a verified ECG.':'Input is not heavily clipped. ECG waveform quality and rhythm remain unverified.';
 if(!frozen)draw();
}
async function poll(){
 try{const response=await fetch('/samples?after='+cursor,{cache:'no-store',signal:AbortSignal.timeout(2000)});if(!response.ok)throw new Error('HTTP '+response.status);const data=await response.json();
 if(boot!==data.boot_id||data.reset){samples=[];cursor=0;missed=0;boot=data.boot_id}
 if(data.missed_samples){missed+=data.missed_samples;samples=[]}
 for(const row of data.samples)if(row[0]>cursor)samples.push(row);cursor=data.cursor;
 if(data.samples.length){lastReceived=performance.now();const end=samples.at(-1)[1];samples=samples.filter(s=>s[1]>=end-8000);update()}
 $('connection').textContent=performance.now()-lastReceived<2000&&lastReceived?'Receiving live samples':'Waiting for acquisition';
 }catch(error){$('connection').textContent='Disconnected · trace is stale';$('interpretation').textContent='No fresh samples. Check battery power and Wi-Fi; the displayed trace is historical.'}
 setTimeout(poll,100);
}
async function initialize(){
 try{const response=await fetch('/status',{cache:'no-store',signal:AbortSignal.timeout(2000)});if(!response.ok)throw new Error('Unavailable');const status=await response.json();boot=status.boot_id;cursor=status.latest_seq;poll()}
 catch(error){$('connection').textContent='Waiting for ESP32';setTimeout(initialize,500)}
}
window.addEventListener('resize',()=>{if(!frozen)draw()});draw();initialize();
</script></body></html>)ECGHTML";
