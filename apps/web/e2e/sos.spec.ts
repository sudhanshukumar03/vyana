import {expect,test,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {defaultSosPreferences} from '../../../apps/api/src/sos-policy';

async function fixture(page:Page) {
  const signup=await page.request.post('/api/v1/auth/register',{data:{email:`sos-browser-${crypto.randomUUID()}@example.test`,password:'sos-browser-password'}});
  expect(signup.status()).toBe(201);const auth=await signup.json(),headers={Authorization:`Bearer ${auth.token}`};
  expect((await page.request.post('/api/v1/profile',{headers,data:{full_name:'SOS Browser Fixture',height_cm:175,weight_kg:72,dob:'1990-01-01'}})).ok()).toBe(true);
  const doctor=await(await page.request.post('/api/v1/profile/contacts',{headers,data:{name:'Doctor Fixture',email:'doctor@example.test',is_doctor:true}})).json();
  const family=await(await page.request.post('/api/v1/profile/contacts',{headers,data:{name:'Family Fixture',email:'family@example.test',phone:'+919876543210'}})).json();
  const device=await(await page.request.post('/api/v1/devices',{headers,data:{name:'SOS Browser Hardware Fixture'}})).json();
  await page.route('**/api/v1/auth/refresh',route=>route.fulfill({json:auth}),{times:1});
  return {headers,doctor:doctor.id as number,family:family.id as number,key:device.credential as string};
}

test('manual SOS records without pretending to notify contacts when sharing is off',async({page})=>{
  const {headers}=await fixture(page);await page.setViewportSize({width:320,height:900});await page.goto('/emergency');
  const panel=page.getByRole('region',{name:'Emergency SOS',exact:true});
  await expect(panel).toContainText('Contact notifications are off');
  await panel.getByRole('button',{name:'Trigger Emergency SOS',exact:true}).click();
  await expect(panel).toContainText('Notification setup is incomplete');
  await panel.getByRole('button',{name:'Confirm SOS request',exact:true}).click();
  await expect(panel.getByRole('heading',{name:'SOS recorded',exact:true})).toBeVisible();
  await expect(panel).toContainText('No external notifications were queued');
  const overview=await(await page.request.get('/api/v1/sos',{headers})).json();
  expect(overview.incidents[0].status).toBe('recorded');expect(overview.incidents[0].notifications).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const audit=await new AxeBuilder({page}).include('section[aria-labelledby="manual-sos-title"]').analyze();
  expect(audit.violations.filter(v=>['serious','critical'].includes(v.impact||'')).map(v=>v.id)).toEqual([]);
});

test('lost-response retry reuses one manual incident and displays its notification status',async({page})=>{
  const {headers,family}=await fixture(page);
  expect((await page.request.put('/api/v1/sos/preferences',{headers,data:{...defaultSosPreferences,
    sharing_enabled:true,emergency_contact_ids:[family]}})).ok()).toBe(true);
  const requestIds:string[]=[];
  await page.route('**/api/v1/sos',async route=>{
    if(route.request().method()!=='POST'){await route.continue();return;}
    requestIds.push(route.request().postDataJSON().request_id);
    if(requestIds.length===1){expect((await route.fetch()).status()).toBe(201);await route.abort('connectionfailed');}
    else await route.continue();
  });
  await page.goto('/emergency');
  const panel=page.getByRole('region',{name:'Emergency SOS',exact:true});
  await panel.getByRole('button',{name:'Trigger Emergency SOS',exact:true}).click();
  await panel.getByRole('button',{name:'Confirm SOS request',exact:true}).click();
  await expect(panel.getByRole('alert')).toBeVisible();
  await panel.getByRole('button',{name:'Trigger Emergency SOS',exact:true}).click();
  await panel.getByRole('button',{name:'Confirm SOS request',exact:true}).click();
  await expect(panel.getByRole('heading',{name:'SOS recorded',exact:true})).toBeVisible();
  await expect(panel).toContainText('Contact notifications were queued');
  await expect(panel).toContainText('Family Fixture · EMAIL · Queued',{timeout:10000});
  expect(requestIds).toHaveLength(2);expect(requestIds[0]).toBeTruthy();expect(requestIds[0]).toBe(requestIds[1]);
  const overview=await(await page.request.get('/api/v1/sos',{headers})).json();
  expect(overview.incidents).toHaveLength(1);expect(overview.incidents[0].notifications).toHaveLength(1);
});

test('settings refresh delivery status without overwriting unsaved preferences',async({page})=>{
  const {headers,family}=await fixture(page);
  expect((await page.request.put('/api/v1/sos/preferences',{headers,data:{...defaultSosPreferences,
    sharing_enabled:true,emergency_contact_ids:[family]}})).ok()).toBe(true);
  expect((await page.request.post('/api/v1/sos',{headers,data:{request_id:crypto.randomUUID()}})).status()).toBe(201);
  let submitted=false;
  await page.route('**/api/v1/sos',async route=>{
    const response=await route.fetch(),value=await response.json();
    if(submitted)for(const incident of value.incidents)for(const job of incident.notifications)job.status='submitted';
    await route.fulfill({response,json:value});
  });
  await page.goto('/settings');
  const section=page.getByRole('region',{name:'SOS and report sharing'});
  await expect(section.getByLabel('SOS notification history')).toContainText('Queued');
  const attach=section.getByRole('checkbox',{name:/Attach the 24-hour readings/});await attach.uncheck();
  submitted=true;
  await expect(section.getByLabel('SOS notification history')).toContainText('Provider accepted',{timeout:10000});
  await expect(attach).not.toBeChecked();
});
test('saved SOS preferences, reports and recipient consent work on mobile and desktop',async({page},info)=>{
  await fixture(page);await page.goto('/settings');
  const section=page.getByRole('region',{name:'SOS and report sharing'});
  await expect(section).toBeVisible();
  await section.getByRole('checkbox',{name:'Emergency alerts for Family Fixture',exact:true}).check();
  await section.getByRole('checkbox',{name:'Reports for Doctor Fixture',exact:true}).check();
  await section.getByRole('checkbox',{name:/Enable automatic SOS/}).check();
  await section.getByRole('checkbox',{name:/Email a daily monitoring report/}).check();
  await section.getByRole('checkbox',{name:/Share my monitoring reports/}).check();
  await section.getByRole('button',{name:'Save SOS preferences',exact:true}).click();
  await expect(section.getByRole('status')).toHaveText('SOS preferences saved.');
  await page.reload();await expect(section.getByRole('checkbox',{name:/Enable automatic SOS/})).toBeChecked();
  await expect(section.getByRole('checkbox',{name:'Reports for Doctor Fixture',exact:true})).toBeChecked();
  await section.getByRole('button',{name:'Email report now',exact:true}).click();
  await expect(section.getByRole('status')).toContainText('Report queued');
  await expect(section.getByLabel('SOS notification history')).toContainText('Doctor Fixture');
  await expect(section.getByLabel('SOS notification history')).toContainText('Queued');
  for(const width of [320,1440]) {
    await page.setViewportSize({width,height:900});
    await section.scrollIntoViewIfNeeded();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`sos-settings-${width}.png`),fullPage:true});
  }
  const audit=await new AxeBuilder({page}).include('#sos-settings').analyze();
  expect(audit.violations.filter(v=>['serious','critical'].includes(v.impact||'')).map(v=>v.id)).toEqual([]);
});
test('a server-side automatic SOS is visible across pages and can be cancelled',async({page},info)=>{
  const {headers,family,doctor,key}=await fixture(page);
  expect((await page.request.put('/api/v1/sos/preferences',{headers,data:{...defaultSosPreferences,
    sharing_enabled:true,auto_enabled:true,cancel_seconds:120,emergency_contact_ids:[family],report_contact_ids:[doctor]}})).ok()).toBe(true);
  const now=Date.now();
  for(const offset of [-31000,-16000,-1000])expect((await page.request.post('/api/v1/device/status',{headers:{'X-Device-Key':key},data:{
    device_name:'SOS Browser Hardware Fixture',connected:true,battery:null,source:'ESP32_RealVitals_SimulatedSteps',equipment:{
      observed_at:new Date(now+offset).toISOString(),heart_rate:160,spo2:98,temperature_c:null,ecg_status:'Unknown',
      ecg_raw_adc:2048,ecg_millivolts:1650,ecg_samples:1250,ecg_clipped_samples:0}}})).ok()).toBe(true);
  await page.goto('/');await page.setViewportSize({width:320,height:900});
  const cancel=page.getByRole('button',{name:'Cancel automatic SOS',exact:true});await expect(cancel).toBeVisible();
  await expect(page.getByRole('timer')).toContainText('seconds');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('automatic-sos-320.png'),fullPage:true});
  await cancel.click();await expect(cancel).toHaveCount(0);
  const status=await(await page.request.get('/api/v1/sos',{headers})).json();
  expect(status.incidents[0].status).toBe('cancelled');expect(status.incidents[0].notifications).toEqual([]);
});
