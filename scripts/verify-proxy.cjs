const assert=require('node:assert/strict');
const fs=require('node:fs');
const {randomUUID}=require('node:crypto');
const {chromium,expect}=require('../apps/web/node_modules/@playwright/test');
if(process.env.VERIFY_DISPOSABLE!=='1')throw new Error('Requires the synthetic verification stack');
const base='http://127.0.0.1:18080';
async function call(route,body,headers={},status=200){
  const response=await fetch(base+'/api/v1'+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,status,route);return {data:await response.json(),cookie:response.headers.get('set-cookie')};
}
async function main(){
  const signup=await call('/auth/register',{email:`proxy-${Date.now()}@example.test`,password:'synthetic-proxy-test-password'},{},201);
  const headers={Authorization:`Bearer ${signup.data.token}`};
  await call('/profile',{height_cm:175,weight_kg:72,dob:'1990-01-01',full_name:'Proxy fixture'},headers);
  const device=(await call('/devices',{name:'Proxy fixture'},headers,201)).data;
  const session_id=randomUUID();
  const reading=sequence=>({session_id,sequence,observed_at:new Date().toISOString(),source:'Proxy fixture',heart_rate:72+sequence,spo2:98,temperature:36.7,ecg_status:'Normal'});
  await call('/ingest/vitals',reading(1),{'X-Device-Key':device.credential});
  const browser=await chromium.launch({headless:true});
  try {
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    await context.addCookies([{name:'hg_refresh',value:signup.cookie.split(';')[0].slice('hg_refresh='.length),domain:'127.0.0.1',path:'/api/v1/auth',httpOnly:true,sameSite:'Strict'}]);
    const page=await context.newPage();let deliveries=0;
    const violations=[];
    page.on('console',message=>{if(message.type()==='error'&&/Content Security Policy|Refused to connect|violates.*directive/i.test(message.text()))violations.push(message.text());});
    page.on('websocket',socket=>socket.on('framereceived',frame=>{if(typeof frame.payload==='string'&&frame.payload.includes('health_update'))deliveries++;}));
    const response=await page.goto(base);
    assert.ok(response.headers()['content-security-policy'].includes("frame-ancestors 'none'"));
    await expect(page.getByRole('heading',{name:'Health Insights',exact:true})).toBeVisible();
    await expect(page.getByText('Rule-based guidance',{exact:true})).toBeVisible();
    for(let sequence=2;sequence<7&&!deliveries;sequence++){await new Promise(resolve=>setTimeout(resolve,500));await call('/ingest/vitals',reading(sequence),{'X-Device-Key':device.credential});}
    await expect.poll(()=>deliveries).toBeGreaterThan(0);
    for(const width of [320,390,768,1440]){
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
      if(width===390||width===1440)await page.screenshot({path:`artifacts/proxy-${width}.png`,fullPage:true});
    }
    assert.deepEqual(violations,[]);
    const file=Buffer.alloc(10*1024*1024,48);file.write('%PDF-');
    const accepted=await call('/assistant/report',{data_base64:file.toString('base64'),mime_type:'application/pdf',filename:'synthetic-byte-boundary.pdf'},headers);
    assert.equal(accepted.data.offline,true);
    await call('/assistant/report',{data_base64:Buffer.concat([file,Buffer.from('0')]).toString('base64'),mime_type:'application/pdf'},headers,413);
    await call('/assistant/report',{data_base64:Buffer.from('%PDF-synthetic').toString('base64'),mime_type:'image/png'},headers,400);
    const result={passed:true,origin:base,viewports:[320,390,768,1440],websocket_deliveries:deliveries,csp_violations:0,report_exact_10_mib:200,report_plus_one_byte:413,mime_mismatch:400};
    fs.writeFileSync('artifacts/proxy-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
