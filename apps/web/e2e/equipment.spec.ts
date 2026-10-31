import {expect,test,type Page} from '@playwright/test';
import type {EquipmentSnapshot} from '../../../shared/types/health';

// Old saved demo opt-ins must not turn generated readings back on after a reload.
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('vyaana.sensor-preview.v1','on'));
});

async function fixture(page:Page) {
  const signup=await page.request.post('/api/v1/auth/register',{data:{
    email:`equipment-browser-${crypto.randomUUID()}@example.test`,password:'equipment-browser-password',
  }});
  expect(signup.status()).toBe(201);
  const auth=await signup.json(),headers={Authorization:`Bearer ${auth.token}`};
  expect((await page.request.post('/api/v1/profile',{headers,data:{full_name:'Equipment Test',height_cm:175,weight_kg:72,dob:'1990-01-01'}})).ok()).toBe(true);
  const device=await(await page.request.post('/api/v1/devices',{headers,data:{name:'Software equipment fixture'}})).json();
  await page.route('**/api/v1/auth/refresh',route=>route.fulfill({json:auth}));
  return {credential:device.credential as string,headers,auth};
}
const snapshot=():EquipmentSnapshot=>({observed_at:new Date().toISOString(),heart_rate:72,spo2:98,temperature_c:null,
  ecg_status:'Leads Off',ecg_raw_adc:4095,ecg_millivolts:3160,ecg_samples:0,ecg_clipped_samples:0});
async function status(page:Page,key:string,equipment:EquipmentSnapshot) {
  expect((await page.request.post('/api/v1/device/status',{headers:{'X-Device-Key':key},data:{
    device_name:'Software equipment fixture',connected:true,battery:null,source:'ESP32_RealVitals_SimulatedSteps',equipment,
  }})).ok()).toBe(true);
}

for (const transport of ['socket','polling'] as const) {
  test(`equipment updates automatically through ${transport} without reloading`,async({page})=>{
    const {credential}=await fixture(page);
    if(transport==='polling')await page.route('**/socket.io/**',route=>route.abort());
    await page.goto('/');
    const temperature=page.locator('.metric-card').filter({hasText:'Temperature'});
    await expect(temperature.locator('.metric-status')).toHaveText('No data');
    if(transport==='socket') {
      await expect(page.getByText('Backend unavailable or connecting.',{exact:true})).toHaveCount(0);
      await expect(page.getByText('Live connection interrupted; refreshing periodically.',{exact:true})).toHaveCount(0);
      // Prove socket delivery: later REST snapshots cannot supply the values.
      await page.route('**/api/v1/health/summary',route=>route.abort());
    }
    await status(page,credential,{...snapshot(),heart_rate:null,spo2:null,temperature_c:25.125});
    await expect(temperature.locator('.metric-value')).toHaveText('25.13',{timeout:12000});
    await status(page,credential,{...snapshot(),heart_rate:null,spo2:null,temperature_c:26.25});
    await expect(temperature.locator('.metric-value')).toHaveText('26.25',{timeout:12000});
    await expect(temperature.locator('.metric-status')).toHaveText('Live probe');
    await expect(page.getByRole('heading',{name:'Live readings only'})).toHaveCount(new URL(page.url()).pathname==='/vitals'?1:0);
  });
}

test('independent optical readings reach dashboard and vitals without a temperature record',async({page},testInfo)=>{
  const {credential}=await fixture(page);
  expect((await page.request.post('/api/v1/ingest/activity',{headers:{'X-Device-Key':credential},data:{
    session_id:crypto.randomUUID(),sequence:1,observed_at:new Date().toISOString(),steps:10,
    distance_km:0.00762,calories:0,active_minutes:0,source:'ESP32_MPU6050_Simulated',
  }})).ok()).toBe(true);
  await status(page,credential,snapshot());
  await page.goto('/');
  await expect(page.locator('.metric-card').filter({hasText:'Heart rate'}).locator('.metric-value')).toHaveText('72');
  await expect(page.locator('.metric-card').filter({hasText:'Blood oxygen'}).locator('.metric-value')).toHaveText('98');
  await expect(page.locator('.metric-card').filter({hasText:'Temperature'}).locator('.metric-status')).toHaveText('No data');
  await expect(page.locator('.metric-card').filter({hasText:'Steps'}).locator('.metric-value')).toHaveText('—');
  await expect(page.getByRole('region',{name:'Latest readings'}).getByText('ESP32 sensor hub',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Live readings only'})).toHaveCount(new URL(page.url()).pathname==='/vitals'?1:0);
  await expect(page.getByRole('img',{name:'Generated ECG waveform preview, not a measured signal'})).toHaveCount(0);
  await page.goto('/vitals');
  await expect(page.locator('.metric-card').filter({hasText:'Heart rate'}).locator('.metric-value')).toHaveText('72');
  const ecg=page.getByRole('region',{name:'ECG sensor input'});
  await expect(ecg).toContainText('4095');await expect(ecg).toContainText('Leads off');
  for(const width of [320,1440]) {
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`equipment-${width}.png`),fullPage:true});
    if(width===320) {
      await ecg.scrollIntoViewIfNeeded();
      await page.screenshot({path:testInfo.outputPath('equipment-320-ecg.png'),fullPage:true});
    }
  }
  await page.goto('/activity');
  await expect(page.locator('main h1')).toHaveText('Activity');
  await expect(page.getByText('Google Health connection setup is pending.',{exact:false})).toBeVisible();
});

test('no device data stays empty by default and demo mode resets on reload',async({page})=>{
  const {auth}=await fixture(page);
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Live readings only'})).toHaveCount(new URL(page.url()).pathname==='/vitals'?1:0);
  for(const name of ['Heart rate','Blood oxygen','Temperature','Steps'])
    await expect(page.locator('.metric-card').filter({hasText:name}).locator('.metric-value')).toHaveText('—');
  await expect(page.getByRole('img',{name:'Generated ECG waveform preview, not a measured signal'})).toHaveCount(0);
  await page.goto('/vitals');
  await page.getByRole('button',{name:'Enable simulated demo'}).click();
  await expect(page.getByRole('heading',{name:'Demo mode: simulated readings enabled'})).toBeVisible();
  await expect(page.locator('.metric-card').filter({hasText:'Heart rate'}).locator('.metric-status')).toHaveText('Simulated · not measured');
  await expect(page.getByRole('img',{name:'Generated ECG waveform preview, not a measured signal'})).toBeVisible();
  await page.route('**/api/v1/auth/refresh',route=>route.fulfill({json:auth}),{times:1});
  await page.reload();
  await expect(page.getByRole('heading',{name:'Live readings only'})).toHaveCount(new URL(page.url()).pathname==='/vitals'?1:0);
  await expect(page.getByRole('button',{name:'Enable simulated demo',exact:true})).toHaveAttribute('aria-pressed','false');
  await expect(page.getByRole('img',{name:'Generated ECG waveform preview, not a measured signal'})).toHaveCount(0);
  await page.goto('/');
  await expect(page.locator('.metric-card').filter({hasText:'Heart rate'}).locator('.metric-value')).toHaveText('—');
});

test('a temperature-only physical-source fixture is visible while optical readings stay unavailable',async({page})=>{
  const {credential}=await fixture(page);
  await status(page,credential,{...snapshot(),heart_rate:null,spo2:null,temperature_c:24.9375});
  for(const path of ['/','/vitals']) {
    await page.goto(path);
    await expect(page.locator('.metric-card').filter({hasText:'Temperature'}).locator('.metric-value')).toHaveText('24.94');
    await expect(page.locator('.metric-card').filter({hasText:'Temperature'}).locator('.metric-status')).toHaveText('Live probe');
    for(const name of ['Heart rate','Blood oxygen'])
      await expect(page.locator('.metric-card').filter({hasText:name}).locator('.metric-status')).toHaveText('No data');
  }
});

test('saved simulator data is hidden from live cards and explicitly identified in history',async({page})=>{
  const {credential}=await fixture(page);
  expect((await page.request.post('/api/v1/ingest/vitals',{headers:{'X-Device-Key':credential},data:{
    session_id:crypto.randomUUID(),sequence:1,observed_at:new Date().toISOString(),
    heart_rate:75,spo2:98,temperature:36.5,ecg_status:'Normal',source:'Simulator',
  }})).ok()).toBe(true);
  await page.goto('/');
  await expect(page.locator('.metric-card').filter({hasText:'Heart rate'}).locator('.metric-value')).toHaveText('—');
  await page.goto('/history');
  await expect(page.getByLabel('Vitals history table').getByRole('columnheader',{name:'Source',exact:true})).toBeVisible();
  await expect(page.getByRole('cell',{name:'Simulated · not measured',exact:true})).toBeVisible();
});

test('a newer unavailable optical result clears old critical cards and their live banner',async({page})=>{
  const {credential}=await fixture(page);
  expect((await page.request.post('/api/v1/ingest/vitals',{headers:{'X-Device-Key':credential},data:{
    session_id:crypto.randomUUID(),sequence:1,observed_at:new Date(Date.now()-1000).toISOString(),
    heart_rate:160,spo2:86,temperature:36.5,ecg_status:'Unknown',source:'ESP32_MAX30102_DS18B20_AD8232',
  }})).ok()).toBe(true);
  await status(page,credential,{...snapshot(),heart_rate:null,spo2:null});
  await page.goto('/');
  for(const name of ['Heart rate','Blood oxygen'])
    await expect(page.locator('.metric-card').filter({hasText:name}).locator('.metric-status')).toHaveText('No data');
  await expect(page.getByText('Critical readings detected',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Critical reading detected',{exact:true})).toHaveCount(0);
});

test('ECG panel reports clipped input and never supplies an invented rhythm',async({page})=>{
  const {credential}=await fixture(page);
  await status(page,credential,{...snapshot(),ecg_status:'Unknown',ecg_samples:1000,ecg_clipped_samples:837});
  await page.goto('/vitals');
  const ecg=page.getByRole('region',{name:'ECG sensor input'});
  await expect(ecg).toContainText('Input clipping detected');await expect(ecg).toContainText('837');
  await expect(ecg).toContainText('Rhythm is unclassified');
  await expect(ecg).not.toContainText('Normal');
});

test('a recent heartbeat cannot make old sensor observations live',async({page})=>{
  const {credential}=await fixture(page);
  await status(page,credential,{...snapshot(),observed_at:new Date(Date.now()-31000).toISOString()});
  await page.goto('/vitals');
  await expect(page.getByText('No vitals data available',{exact:true})).toBeVisible();
  const panel=page.getByRole('region',{name:'ECG sensor input'});
  await expect(panel.getByRole('img')).toHaveCount(0);
  await expect(panel.getByText('Raw ADC',{exact:true})).toHaveCount(0);
  await expect(panel.getByText('Waiting for fresh waveform samples',{exact:false})).toBeVisible();
});
