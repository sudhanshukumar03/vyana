import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function account(page:Page) {
  await page.goto('/');
  await page.getByRole('button',{name:'Create one'}).click();
  await page.getByLabel('Email',{exact:true}).fill(`browser-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`);
  await page.getByLabel('Password',{exact:true}).fill('browser-test-password');
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
  const missing=page.getByText('Waiting for device readings.');await expect(missing).toBeVisible();
});
test('profile edits preserve private fields, SOS resolves and logout clears the screen',async({page})=>{
  await account(page);await onboard(page);
  await page.goto('/profile');await page.getByRole('button',{name:'Edit',exact:true}).click();
  await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.getByLabel('Medications (optional)',{exact:true})).toHaveValue('Preserve medication note');
  await page.getByRole('button',{name:'Finish',exact:true}).click();
  await page.goto('/emergency');await page.getByRole('button',{name:'SOS',exact:true}).click();
  await page.getByRole('button',{name:'Confirm',exact:true}).click();await expect(page.getByText('Emergency alert logged')).toBeVisible();
  await page.getByRole('button',{name:/Notifications,/}).click();await page.getByRole('button',{name:'Resolve',exact:true}).click();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
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
  await expect(page.locator('tbody tr')).toHaveCount(100);
  await page.getByRole('button',{name:'Older readings'}).click();
  await expect(page.getByRole('status').filter({hasText:'Page 2'})).toHaveText('Page 2 · 5 readings');
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await page.getByRole('button',{name:'Newer readings'}).click();
  await expect(page.getByRole('status').filter({hasText:'Page 1'})).toHaveText('Page 1 · 100 readings');
  const replacement=await (await page.request.post('/api/v1/devices',{headers,data:{name:'Replacement source'}})).json();
  await page.request.post(`/api/v1/devices/${replacement.id}/activate`,{headers,data:{}});
  const switched=await page.request.post('/api/v1/ingest/vitals',{headers:{'X-Device-Key':replacement.credential},
    data:{session_id:crypto.randomUUID(),sequence:1,observed_at:new Date(Date.parse(observed_at)-1000).toISOString(),
      heart_rate:80,spo2:98,temperature:36.7,ecg_status:'Normal',source:'Replacement fixture'}});
  expect(switched.status()).toBe(200);
  await expect(page.getByRole('status').filter({hasText:'Page 1'})).toHaveText('Page 1 · 1 readings');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr td').nth(1)).toHaveText('80');
});
