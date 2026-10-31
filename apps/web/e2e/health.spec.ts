import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function account(page:Page) {
  // A new context has no session. Stub only this empty-cookie bootstrap so repeated
  // fixture creation does not consume the real 20/min authentication limit.
  // Reload/refresh/logout behavior below still exercises the real API.
  await page.route('**/api/v1/auth/refresh',route=>route.fulfill({status:401,json:{error:'Authentication required'}}),{times:1});
  await page.goto('/');
  await page.getByRole('button',{name:'Create one'}).click();
  await page.getByLabel('Email',{exact:true}).fill(`browser-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`);
  await page.getByLabel('Password',{exact:true}).fill('browser-test-password');
  await page.getByLabel('Confirm Password',{exact:true}).fill('browser-test-password');
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Health profile'})).toBeVisible();
}
async function onboard(page:Page) {
  await page.getByLabel('Full name').fill('Test User');
  await page.getByLabel('Date of birth').fill('1990-01-01');
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.getByLabel('Height (cm)').fill('175');await page.getByLabel('Weight (kg)').fill('72');
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.getByLabel('Medications (optional)',{exact:true}).fill('Preserve medication note');
  await page.getByLabel('Allergies (optional)',{exact:true}).fill('Preserve allergy note');
  await page.getByRole('button',{name:'Finish',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
for(const width of [320,390,768,1440]) test(`onboarding is usable at ${width}px and contains keyboard focus`,async({page})=>{
  await page.setViewportSize({width,height:700});await account(page);
  const dialog=page.getByRole('dialog');
  for(let index=0;index<12;index++) {await page.keyboard.press('Tab');expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);}
  await onboard(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await expect(page.getByRole('heading',{name:'Live readings only',exact:true})).toHaveCount(0);
  await expect(page.locator('.metric-card').filter({hasText:'Heart rate'}).locator('.metric-value')).toHaveText('—');
});
test('profile edits preserve private fields, SOS resolves and logout clears the screen',async({page})=>{
  await account(page);await onboard(page);
  await page.goto('/profile');await page.getByRole('button',{name:'Edit',exact:true}).click();
  await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.getByLabel('Medications (optional)',{exact:true})).toHaveValue('Preserve medication note');
  await page.getByRole('button',{name:'Finish',exact:true}).click();
  await page.goto('/emergency');await page.getByRole('button',{name:'Trigger Emergency SOS',exact:true}).click();
  await page.getByRole('button',{name:'Confirm SOS request',exact:true}).click();await expect(page.getByRole('heading',{name:'SOS recorded',exact:true})).toBeVisible();
  await page.getByRole('button',{name:/Notifications,/}).click();await page.getByRole('button',{name:'Resolve',exact:true}).click();
  await page.setViewportSize({width:390,height:900});
  await page.getByRole('button',{name:'Open navigation',exact:true}).click();
  await page.getByRole('dialog',{name:'Main navigation',exact:true}).getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
  await page.reload();await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
});
test('reduced motion and important screens pass automated accessibility checks',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await account(page);
  const onboarding=await new AxeBuilder({page}).include('dialog').analyze();
  expect(onboarding.violations.filter(item=>['serious','critical'].includes(item.impact||'')).map(item=>({id:item.id,nodes:item.nodes.map(node=>node.html)}))).toEqual([]);
  await onboard(page);
  const dashboard=await new AxeBuilder({page}).analyze();
  expect(dashboard.violations.filter(item=>['serious','critical'].includes(item.impact||'')).map(item=>({id:item.id,nodes:item.nodes.map(node=>node.html)}))).toEqual([]);
});

test('history browses beyond the live window without losing equal-time records',async({page})=>{
  const signup=await page.request.post('/api/v1/auth/register',{data:{email:`history-${Date.now()}@example.test`,password:'browser-test-password'}});
  expect(signup.status()).toBe(201);
  const {token}=await signup.json();const headers={Authorization:`Bearer ${token}`};
  await page.request.post('/api/v1/profile',{headers,data:{height_cm:175,weight_kg:72,dob:'1990-01-01'}});
  const device=await (await page.request.post('/api/v1/devices',{headers,data:{name:'History browser fixture'}})).json();
  const session_id=crypto.randomUUID(),observed_at=new Date().toISOString();
  for(let sequence=1;sequence<=105;sequence++) {
    const result=await page.request.post('/api/v1/ingest/vitals',{headers:{'X-Device-Key':device.credential},
      data:{session_id,sequence,observed_at,heart_rate:72,spo2:98,temperature:36.7,ecg_status:'Normal',source:'Browser fixture'}});
    expect(result.status()).toBe(200);
  }
  await page.goto('/history');
  await expect(page.getByRole('status').filter({hasText:'Page 1'})).toHaveText('Page 1 · 100 readings');
  await expect(page.getByLabel('Vitals history table',{exact:true}).locator('tbody tr')).toHaveCount(100);
  await page.getByRole('button',{name:'Older readings'}).click();
  await expect(page.getByRole('status').filter({hasText:'Page 2'})).toHaveText('Page 2 · 5 readings');
  await expect(page.getByLabel('Vitals history table',{exact:true}).locator('tbody tr')).toHaveCount(5);
  await page.getByRole('button',{name:'Newer readings'}).click();
  await expect(page.getByRole('status').filter({hasText:'Page 1'})).toHaveText('Page 1 · 100 readings');
  const replacement=await (await page.request.post('/api/v1/devices',{headers,data:{name:'Replacement source'}})).json();
  await page.request.post(`/api/v1/devices/${replacement.id}/activate`,{headers,data:{}});
  const switched=await page.request.post('/api/v1/ingest/vitals',{headers:{'X-Device-Key':replacement.credential},
    data:{session_id:crypto.randomUUID(),sequence:1,observed_at:new Date(Date.parse(observed_at)-1000).toISOString(),
      heart_rate:80,spo2:98,temperature:36.7,ecg_status:'Normal',source:'Replacement fixture'}});
  expect(switched.status()).toBe(200);
  await expect(page.getByRole('status').filter({hasText:'Page 1'})).toHaveText('Page 1 · 1 readings');
  await expect(page.getByLabel('Vitals history table',{exact:true}).locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr td').nth(1)).toHaveText('80');
});

const aiMetadata={source:'gemini',reason:null,retry_after_seconds:null,offline:false,disclaimer:'Wellness guidance only'};
test('assistant displays structured answers safely and fits supported viewports',async({page})=>{
  await account(page);await onboard(page);await page.goto('/assistant');
  await page.route('**/api/v1/assistant/chat',route=>route.fulfill({json:{...aiMetadata,
    reply:'Your device records activity; it cannot establish your overall health.',
    sections:[{title:'Next steps',items:['Review the source and observation time.','<img src=x onerror=alert(1)>','Long observation. '.repeat(35)]} ]}}));
  await page.getByRole('button',{name:'What do my latest readings show?',exact:true}).click();
  await expect(page.getByText('Gemini',{exact:true})).toBeVisible();
  await expect(page.getByRole('status').filter({hasText:'Response ready.'})).toHaveAttribute('aria-atomic','true');
  await expect(page.getByRole('log')).toHaveAttribute('aria-relevant','additions');
  await expect(page.getByRole('log')).toHaveAttribute('aria-atomic','false');
  await expect(page.getByRole('heading',{name:'Next steps',exact:true})).toBeVisible();
  await expect(page.getByText('<img src=x onerror=alert(1)>',{exact:true})).toBeVisible();
  expect(await page.getByRole('log').locator('img').count()).toBe(0);
  for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:800});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const form=page.getByLabel('Message the assistant');
    const size=await form.boundingBox();expect(size?.width).toBeGreaterThan(80);
    for(const name of ['Send message','Upload a health report (PDF or image)']) {
      const rect=await page.getByRole('button',{name,exact:true}).boundingBox();
      expect(rect!.width).toBeGreaterThanOrEqual(44);expect(rect!.height).toBeGreaterThanOrEqual(44);
    }
    if(width===320) {
      const log=page.getByRole('log');await log.focus();await log.evaluate(element=>{element.scrollTop=0;});
      await page.keyboard.press('PageDown');
      await expect.poll(()=>log.evaluate(element=>element.scrollTop)).toBeGreaterThan(0);
    }
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  const audit=await new AxeBuilder({page}).include('main').analyze();
  expect(audit.violations.filter(item=>['serious','critical'].includes(item.impact||'')).map(item=>item.id)).toEqual([]);
});

test('assistant stops pending work, prevents duplicate sends and labels fallbacks',async({page})=>{
  await account(page);await onboard(page);await page.goto('/assistant');
  let calls=0;
  let releaseCompletion:(()=>void)|undefined;
  await page.route('**/api/v1/assistant/chat',async route=>{
    calls++;
    if(calls===1){await new Promise(resolve=>setTimeout(resolve,1000));await route.fulfill({json:{...aiMetadata,reply:'Late response must be discarded',sections:[]}}).catch(()=>{});}
    else if(calls===2) await route.fulfill({json:{...aiMetadata,source:'fallback',offline:true,reason:'authentication',retry_after_seconds:60,
      reply:'AI analysis is unavailable. Fresh readings are needed for a summary.',sections:[]}});
    else {
      await new Promise<void>(resolve=>{releaseCompletion=resolve;});
      await route.fulfill({json:{...aiMetadata,reply:'The response is ready.',sections:[]}});
    }
  });
  const input=page.getByLabel('Message the assistant');await input.fill('Explain my readings');
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect(page.getByRole('button',{name:'Stop response',exact:true})).toBeVisible();
  await input.press('Enter');
  await page.getByRole('button',{name:'Stop response',exact:true}).click();
  await expect(page.getByRole('log').getByText('Request stopped.',{exact:false})).toBeVisible();
  await expect(page.getByRole('status').filter({hasText:'Request stopped.'})).toBeVisible();
  await expect(input).toBeFocused();
  await input.fill('Try again');await input.press('Enter');
  await expect(page.getByText('AI unavailable',{exact:true})).toBeVisible();
  await expect(page.getByText('Wait at least 60 seconds before trying again.',{exact:true})).toBeVisible();
  await expect(page.getByText('Late response must be discarded',{exact:true})).toHaveCount(0);
  expect(calls).toBe(2);
  try {
    await input.fill('Complete this request');await page.getByRole('button',{name:'Send message',exact:true}).click();
    await expect.poll(()=>Boolean(releaseCompletion)).toBe(true);
    await page.getByRole('button',{name:'Stop response',exact:true}).focus();
    releaseCompletion?.();
    await expect(page.getByRole('status').filter({hasText:'Response ready.'})).toBeVisible();
    await expect(input).toBeFocused();
  }finally{releaseCompletion?.();}
});

test('assistant handles upload boundaries and excludes report content from later chat',async({page})=>{
  await account(page);await onboard(page);await page.goto('/assistant');
  const upload=page.locator('input[type=file]');
  await upload.setInputFiles({name:'empty.pdf',mimeType:'application/pdf',buffer:Buffer.alloc(0)});
  await expect(page.getByText('Choose a nonempty report no larger than 10 MiB.',{exact:true})).toBeVisible();
  await expect(page.getByRole('status').filter({hasText:'Upload not sent.'})).toBeVisible();
  await page.route('**/api/v1/assistant/report',route=>route.fulfill({json:{...aiMetadata,summary:'Synthetic report summary.',
    sections:[{title:'Review limits',items:['Report dates and device times may differ.']}],
    discussion_points:['What follow-up is appropriate?'],document_status:'readable'}}));
  await upload.setInputFiles({name:'synthetic-report.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-synthetic')});
  await expect(page.getByText('Synthetic report summary.',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Questions for your clinician',exact:true})).toBeVisible();
  await page.unroute('**/api/v1/assistant/report');
  await page.route('**/api/v1/assistant/report',route=>route.fulfill({json:{...aiMetadata,source:'rules',summary:'The file has no readable content.',
    sections:[],discussion_points:[],document_status:'unreadable'}}));
  await upload.setInputFiles({name:'blank.png',mimeType:'image/png',buffer:Buffer.from('synthetic browser fixture')});
  await expect(page.getByRole('status').filter({hasText:'Report not reviewed. Check the file message.'})).toBeVisible();
  let history:unknown;
  await page.route('**/api/v1/assistant/chat',route=>{
    history=route.request().postDataJSON().history;
    return route.fulfill({json:{...aiMetadata,reply:'A fresh question starts without the uploaded document.',sections:[]}});
  });
  await page.getByLabel('Message the assistant').fill('Explain step count');
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect(page.getByText('A fresh question starts without the uploaded document.',{exact:true})).toBeVisible();
  expect(history).toEqual([]);
});
