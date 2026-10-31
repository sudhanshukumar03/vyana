import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';

async function session(page:Page) {
  const data={email:`software-browser-${crypto.randomUUID()}@example.test`,password:'synthetic-browser-password'};
  let response=await page.request.post('/api/v1/auth/register',{data});
  // Large suites can legitimately exhaust the unchanged production auth limit.
  // Respect its advertised backoff when provisioning the next isolated fixture.
  if(response.status()===429) {
    test.setTimeout(90000);
    const retryAfter=Number(response.headers()['retry-after']);
    expect(Number.isFinite(retryAfter)&&retryAfter>=0&&retryAfter<=60).toBe(true);
    await new Promise(resolve=>setTimeout(resolve,retryAfter*1000+100));
    response=await page.request.post('/api/v1/auth/register',{data});
  }
  expect(response.status()).toBe(201);const auth=await response.json();
  await page.request.post('/api/v1/profile',{headers:{Authorization:`Bearer ${auth.token}`},data:{full_name:'Software fixture',dob:'1990-01-01',height_cm:170,weight_kg:70}});
  await page.route('**/api/v1/auth/refresh',route=>route.fulfill({json:auth}));return auth;
}
const file={name:'synthetic.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF- synthetic software fixture')};
test('report failure stays unreviewed, can retry, and has no default patient records',async({page})=>{
  await session(page);
  const saved={id:crypto.randomUUID(),filename:file.name,uploadedAt:'2026-10-29',size:'0.1 MB',mimeType:file.mimeType,
    status:'pending',summary:'AI unavailable. No findings extracted.',doctorQuestions:[],sections:[],documentStatus:'not_reviewed'};
  await page.route('**/api/v1/reports',route=>route.fulfill({json:route.request().method()==='POST'?saved:[]}));
  await page.route('**/api/v1/reports/*/review',route=>route.fulfill({json:{...saved,status:'reviewed',summary:'Synthetic successful review.'}}));
  await page.goto('/reports');await expect(page.getByText('No saved reports. Upload your first document above.')).toBeVisible();
  await expect(page.getByText('Cardiology_Lipid_Panel_Sept2026.pdf')).toHaveCount(0);
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('dialog').getByText('Not reviewed',{exact:true})).toBeVisible();
  await page.keyboard.press('Tab');
  expect(await page.getByRole('dialog').evaluate(element=>element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(/Successfully analyzed|clinical OCR telemetry/)).toHaveCount(0);
  await page.getByRole('button',{name:'Retry review',exact:true}).click();
  await expect(page.getByText('Synthetic successful review.')).toBeVisible();
});
test('failed chat does not invent a Gemini answer or report-specific findings',async({page})=>{
  await session(page);await page.route('**/api/v1/assistant/chat',route=>route.fulfill({status:503,json:{error:'Synthetic AI outage. Please retry.'}}));
  await page.goto('/assistant');await page.getByRole('textbox').fill('What should I eat?');await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect(page.getByText('Synthetic AI outage. Please retry.')).toBeVisible();
  await expect(page.getByText('Gemini Clinical AI',{exact:true})).toHaveCount(0);
  await expect(page.getByText(/LDL Elevation|soluble fiber|Suggested follow-ups/)).toHaveCount(0);
});
test('settings export labels its limited scope and keeps simulated display opt-in explicit',async({page},info)=>{
  await session(page);await page.goto('/settings');
  await expect(page.getByRole('heading',{name:'Reading display',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Enable simulated demo',exact:true})).toHaveAttribute('aria-pressed','false');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export loaded snapshot',exact:true}).click();
  const result=await download;expect(result.suggestedFilename()).toContain('loaded-snapshot');
  const path=info.outputPath('loaded-snapshot.json');await result.saveAs(path);
  expect(JSON.parse(await fs.readFile(path,'utf8')).scope).toContain('not a full account backup');
});
test('device controls create, select and revoke an isolated fixture without hardware',async({page})=>{
  await session(page);await page.goto('/settings');
  await page.getByLabel('Device name',{exact:true}).fill('Disposable browser fixture');
  await page.getByRole('button',{name:'Create device',exact:true}).click();
  await expect(page.getByText('Save this credential privately.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Hide credential',exact:true}).click();
  await page.getByLabel('Device name',{exact:true}).fill('Second disposable fixture');
  await page.getByRole('button',{name:'Create device',exact:true}).click();
  await expect(page.getByText('Save this credential privately.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Hide credential',exact:true}).click();
  await page.locator('button:enabled').filter({hasText:'Use device'}).click();
  const second=page.getByRole('listitem').filter({hasText:'Second disposable fixture'});
  await expect(second.getByRole('button',{name:'Use device',exact:true})).toBeDisabled();
  page.once('dialog',dialog=>dialog.accept());await second.getByRole('button',{name:'Revoke',exact:true}).click();
  await expect(second).toHaveCount(0);
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('listitem').filter({hasText:'Disposable browser fixture'}).getByRole('button',{name:'Revoke',exact:true}).click();
  await expect(page.getByText('Disposable browser fixture',{exact:true})).toHaveCount(0);
});
test('device creation waits for the initial list and preserves a newly created device',async({page})=>{
  await session(page);
  let release!:()=>void,started!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;}),began=new Promise<void>(resolve=>{started=resolve;});
  let initial=true;
  await page.route('**/api/v1/devices',async route=>{
    // StrictMode can start a replacement request after aborting its first mount.
    if(route.request().method()==='GET'&&initial){started();await gate;await route.fulfill({json:[]});}
    else await route.continue();
  });
  await page.goto('/settings');await began;
  await page.getByLabel('Device name',{exact:true}).fill('Delayed list fixture');
  const create=page.getByRole('button',{name:'Create device',exact:true});
  try {await expect(create).toBeDisabled();} finally {initial=false;release();}
  await expect(create).toBeEnabled();await create.click();
  const row=page.getByRole('listitem').filter({hasText:'Delayed list fixture'});
  await expect(row).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());await row.getByRole('button',{name:'Revoke',exact:true}).click();
  await expect(row).toHaveCount(0);
});
test('emergency directory starts without fabricated facilities or hotline placeholders',async({page})=>{
  const auth=await session(page);await page.goto('/emergency');
  await expect(page.getByText('Care Team Contacts',{exact:true})).toBeVisible();
  await expect(page.getByText(/1-800-555-0199|1-888-555-0144|City General Hospital & Level 1/)).toHaveCount(0);
  await page.getByRole('button',{name:'Add Doctor',exact:true}).click();
  await page.getByLabel('Doctor Name *',{exact:true}).fill('Synthetic Doctor');
  await page.getByLabel('Office / Clinic Desk Phone',{exact:true}).fill('+15550102020');
  await page.getByRole('button',{name:'Save Doctor Contact',exact:true}).click();
  await expect(page.getByText('Dr. Synthetic Doctor',{exact:true})).toBeVisible();
  const contacts=await(await page.request.get('/api/v1/profile/contacts',{headers:{Authorization:`Bearer ${auth.token}`}})).json();
  expect(contacts[0]).toMatchObject({phone:null,office_phone:'+15550102020'});
});
test('partial sensor records reach History and Trends without complete vital data',async({page})=>{
  const auth=await session(page),headers={Authorization:`Bearer ${auth.token}`};
  const device=await(await page.request.post('/api/v1/devices',{headers,data:{name:'Partial browser fixture'}})).json();
  for(const [offset,temperature] of [[10000,24.5],[0,25]] as const) {
    const result=await page.request.post('/api/v1/device/status',{headers:{'X-Device-Key':device.credential},data:{device_name:'Partial browser fixture',connected:true,battery:null,source:'ESP32_MAX30102_DS18B20_AD8232',
      equipment:{observed_at:new Date(Date.now()-offset).toISOString(),temperature_c:temperature,heart_rate:null,spo2:null,ecg_status:'Unknown',ecg_raw_adc:2030,ecg_millivolts:1400,ecg_samples:100,ecg_clipped_samples:0}}});
    expect(result.ok()).toBe(true);
  }
  await page.goto('/history');const table=page.getByRole('region',{name:'Individual sensor history table'});
  await expect(table.getByRole('cell',{name:'24.5',exact:true})).toBeVisible();
  await expect(table.getByRole('cell',{name:'25',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Trends',exact:true}).click();
  await expect(page.getByRole('img',{name:'Probe temperature (°C)',exact:true})).toBeVisible();
  await page.getByLabel('Sensor channel',{exact:true}).selectOption('heart_rate');
  await expect(page.getByText('No recorded values for this channel.',{exact:true})).toBeVisible();
});
test('raw ECG batches update without reload, export exact samples and clear on device switch',async({page},info)=>{
  const auth=await session(page),headers={Authorization:`Bearer ${auth.token}`};
  const device=await(await page.request.post('/api/v1/devices',{headers,data:{name:'Waveform fixture'}})).json();
  const source='ESP32_MAX30102_DS18B20_AD8232';
  expect((await page.request.post('/api/v1/device/status',{headers:{'X-Device-Key':device.credential},data:{device_name:'Waveform fixture',connected:true,battery:null,source}})).ok()).toBe(true);
  await page.goto('/vitals');
  const waveform=page.getByRole('region',{name:'ECG sensor input'});
  await expect(waveform.getByText('Waiting for fresh waveform samples',{exact:false})).toBeVisible();
  const boot=crypto.randomUUID();
  const send=async(sequence:number,raw:number)=>{
    expect((await page.request.post('/api/v1/ingest/ecg',{headers:{'X-Device-Key':device.credential},data:{session_id:boot,sequence,
      observed_at:new Date(Date.now()-200).toISOString(),source,samples:[[0,raw,0],[4,raw+1,0],[8,raw+2,0]]}})).ok()).toBe(true);
  };
  await send(1,2000);
  await expect(waveform.getByRole('img',{name:'Recorded raw ECG input, 0 to 4095 ADC counts over the last four seconds. Gaps show missing samples or lead-off.'})).toBeVisible();
  await send(10,2100);
  await expect(waveform.getByText('6 loaded samples',{exact:false})).toBeVisible();
  expect((await new AxeBuilder({page}).include('[aria-label="Recorded ECG waveform"]').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
  await waveform.getByRole('button',{name:'Pause waveform',exact:true}).focus();await page.keyboard.press('Space');
  await expect(waveform.getByRole('button',{name:'Resume waveform',exact:true})).toBeVisible();
  const download=page.waitForEvent('download');await waveform.getByRole('button',{name:'Export loaded ECG samples',exact:true}).click();
  const result=await download,path=info.outputPath('ecg-samples.csv');await result.saveAs(path);
  const csv=await fs.readFile(path,'utf8');expect(csv).toContain(',10,2100,0');expect(csv).not.toContain('mV');
  await page.setViewportSize({width:320,height:950});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('recorded-ecg-320.png')});
  await page.request.post('/api/v1/devices',{headers,data:{name:'New empty waveform source'}});
  await page.goto('/vitals');await expect(page.getByRole('region',{name:'ECG sensor input'}).getByRole('img')).toHaveCount(0);
});
test('facility lookup clears earlier locations on empty, failed or denied searches and respects care filters',async({page})=>{
  await session(page);
  await page.addInitScript(()=>Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:(_success:unknown,failure:(error:object)=>void)=>failure({code:1,message:'Synthetic permission denial'})}}));
  await page.route('https://www.openstreetmap.org/**',route=>route.fulfill({body:''}));
  let mode:'found'|'empty'|'failed'='found';
  let resolved=false;
  await page.route('**/api/v1/locations/geoapify/places?*',route=>route.fulfill(mode==='failed'?{status:503,json:{error:'Synthetic provider outage'}}:{json:{features:mode==='empty'?[]:[{type:'Feature',geometry:{type:'Point',coordinates:[-0.12,51.50]},properties:{name:'Synthetic Listed Facility',formatted:'Synthetic address',contact:{phone:'+15550103030'},place_id:'fixture',datasource:{raw:{healthcare:'clinic'}}}}]}}));
  await page.route('**/api/v1/locations/geoapify/geocode/search?*',route=>route.fulfill({json:{features:resolved?[{geometry:{coordinates:[-0.12,51.50]},properties:{formatted:'Synthetic resolved city'}}]:[]}}));
  await page.goto('/emergency');
  await expect(page.getByText('Active Location: Choose a location',{exact:true})).toBeVisible();
  const london=page.getByRole('button',{name:'London, UK',exact:true});
  const facility=page.getByRole('heading',{name:'Synthetic Listed Facility',exact:true});
  const map=page.locator('iframe[title^="Interactive map"]');
  await london.click();await expect(facility).toBeVisible();
  await expect(page.getByRole('link',{name:'Call Synthetic Listed Facility',exact:true})).toHaveAttribute('href','tel:+15550103030');
  await expect(page.getByText('ER Hotline:',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Clinics',exact:true}).click();await expect(facility).toBeVisible();
  await page.getByRole('button',{name:'Listed 24-hour facilities',exact:true}).click();
  await expect(facility).toHaveCount(0);await expect(map).not.toHaveAttribute('src');
  await page.getByRole('button',{name:'All Facilities (1)',exact:true}).click();await expect(facility).toBeVisible();
  await page.getByRole('textbox',{name:'Search hospitals worldwide',exact:true}).fill('Synthetic unresolved city');
  await page.getByRole('button',{name:'Geoapify Search',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Location lookup could not be completed');
  await expect(facility).toHaveCount(0);await expect(map).not.toHaveAttribute('src');
  resolved=true;
  await page.getByRole('textbox',{name:'Search hospitals worldwide',exact:true}).fill('Synthetic resolved city');
  await page.getByRole('button',{name:'Geoapify Search',exact:true}).click();
  await expect(facility).toBeVisible();
  await expect(page.getByText('Active Location: Synthetic resolved city',{exact:true})).toBeVisible();
  await london.click();await expect(facility).toBeVisible();
  mode='empty';await page.getByRole('button',{name:'Tokyo, JP',exact:true}).click();
  await expect(page.getByText('No medical facilities found matching your criteria in this area.',{exact:true})).toBeVisible();
  await expect(facility).toHaveCount(0);await expect(map).not.toHaveAttribute('src');
  mode='found';await london.click();await expect(facility).toBeVisible();
  mode='failed';await page.getByRole('button',{name:'Tokyo, JP',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Location lookup could not be completed');
  await expect(facility).toHaveCount(0);await expect(map).not.toHaveAttribute('src');
  mode='found';await london.click();await expect(facility).toBeVisible();
  await page.getByRole('button',{name:'Use current location to find nearest hospitals',exact:true}).click();
  await expect(page.getByText('Location permission was denied.',{exact:false})).toBeVisible();
  await expect(facility).toHaveCount(0);await expect(map).not.toHaveAttribute('src');
});
test('software pages retain usable layouts at desktop and phone widths',async({page},info)=>{
  const auth=await session(page);await page.route('**/api/v1/auth/refresh',route=>route.fulfill({json:auth}));
  for(const width of [320,1440]) {
    await page.setViewportSize({width,height:950});
    for(const path of ['reports','settings','history','emergency']) {
      await page.goto(`/${path}`);await expect(page.locator('main h1')).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.screenshot({path:info.outputPath(`${path}-${width}.png`)});
    }
  }
});
