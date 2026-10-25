import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const destinations = [
  ['Dashboard','Your health, in focus.'],['Health Vitals','Vitals Overview'],['Activity','Activity Overview'],
  ['Trends','Health Trends'],['History','Vitals History'],['AI Assistant','AI Assistant'],
  ['Wellness','AI Wellness Assistant'],['Reports','Health Reports'],['Profile','Your Profile'],
  ['Settings','Settings'],['Emergency','Emergency'],
];
let auth:{token:string;user:{id:number;email:string}};

test.beforeAll(async({request})=>{
  const signup=await request.post('/api/v1/auth/register',{data:{email:`layout-${Date.now()}@example.test`,password:'browser-test-password'}});
  expect(signup.status()).toBe(201);auth=await signup.json();
  const headers={Authorization:`Bearer ${auth.token}`};
  expect((await request.post('/api/v1/profile',{headers,data:{full_name:'Layout Test',height_cm:175,weight_kg:72,dob:'1990-01-01'}})).ok()).toBe(true);
  const device=await(await request.post('/api/v1/devices',{headers,data:{name:'Synthetic layout source'}})).json();
  const session_id=crypto.randomUUID();
  for(let sequence=1;sequence<=3;sequence++) {
    const result=await request.post('/api/v1/ingest/vitals',{headers:{'X-Device-Key':device.credential},data:{
      session_id,sequence,observed_at:new Date(Date.now()-4000+sequence*1000).toISOString(),
      heart_rate:72+sequence,spo2:98,temperature:36.7,ecg_status:'Normal',source:'Synthetic layout fixture',
    }});expect(result.ok()).toBe(true);
  }
});

for (const width of [320,390,768,1440]) test(`all pages share a usable layout and navigation at ${width}px`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width,height:900});
  // Reuse the real fixture session for layout checks. Session rotation is covered
  // in health.spec.ts; extra bootstraps here would exhaust its shared auth limit.
  await page.route('**/api/v1/auth/refresh',route=>route.fulfill({json:auth}),{times:1});
  await page.goto('/');
  for(const [linkName,heading] of destinations) {
    if(width<1024) {
      await page.getByRole('button',{name:'Open navigation',exact:true}).click();
      const drawer=page.getByRole('dialog',{name:'Main navigation',exact:true});
      await expect(drawer).toBeVisible();
      await page.keyboard.press('Tab');expect(await drawer.evaluate(element=>element.contains(document.activeElement))).toBe(true);
      await drawer.getByRole('link',{name:linkName,exact:true}).click();
      await expect(drawer).toHaveCount(0);
    } else {
      await page.locator('.desktop-navigation').getByRole('link',{name:linkName,exact:true}).click();
      await expect(page.locator('.desktop-navigation [aria-current=page]')).toHaveCount(1);
    }
    await expect(page.locator('main h1')).toHaveText(heading);
    await expect(page.locator('main h1')).toHaveCount(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const controls=await page.locator('button,a[href],input:not([type=file]),select,textarea,[tabindex="0"]').evaluateAll(elements=>elements.map(element=>{
      const r=element.getBoundingClientRect();return {name:element.getAttribute('aria-label')||element.textContent?.trim(),width:r.width,height:r.height,left:r.left,right:r.right};
    }).filter(item=>item.width>0&&item.height>0&&item.left>=0));
    expect(controls.filter(item=>item.width<44||item.height<44||item.right>width)).toEqual([]);
    if(width===1440||width===320) {
      const audit=await new AxeBuilder({page}).include('#main-content').analyze();
      expect(audit.violations.filter(item=>['serious','critical'].includes(item.impact||'')).map(item=>({id:item.id,nodes:item.nodes.map(node=>node.html)}))).toEqual([]);
    }
  }
  expect(errors).toEqual([]);
});
