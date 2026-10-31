import {expect,test,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type {HealthReview} from '../../../shared/types/health-review';
let auth:{token:string;user:{id:number;email:string}};
test.beforeEach(async({page})=>{page.on('pageerror',error=>console.error('Review browser error:',error.message));});
const profile={full_name:'Health review fixture',dob:'1996-10-30',sex:'male',height_cm:175,weight_kg:70,energy_activity:'inactive',nutrition_review:'standard',weight_goal_type:'maintain'};
test.beforeAll(async({request})=>{
  let response=await request.post('/api/v1/auth/register',{data:{email:`review-ui-${crypto.randomUUID()}@example.test`,password:'synthetic-review-browser-password'}});
  if(response.status()===429){test.setTimeout(90000);await new Promise(resolve=>setTimeout(resolve,Number(response.headers()['retry-after'])*1000+100));response=await request.post('/api/v1/auth/register',{data:{email:`review-ui-${crypto.randomUUID()}@example.test`,password:'synthetic-review-browser-password'}});}
  expect(response.status()).toBe(201);auth=await response.json();
});
async function session(page:Page){
  await page.request.patch('/api/v1/profile',{headers:{Authorization:`Bearer ${auth.token}`},data:profile});
  await page.route('**/api/v1/auth/refresh',route=>route.fulfill({json:auth}));
}
test('weight and energy setup persists, recalculates and keeps younger profiles out of adult targets',async({page})=>{
  await session(page);await page.goto('/wellness');
  await expect(page.getByRole('heading',{name:'Wellness',exact:true})).toBeVisible();
  await expect(page.locator('.review-energy-number')).toContainText('2,550');
  await page.getByRole('button',{name:'Add weight',exact:true}).click();
  const weightDialog=page.getByRole('dialog',{name:'Add a weight update'});
  await weightDialog.getByLabel('Weight (kg)',{exact:true}).fill('71');
  await weightDialog.getByRole('button',{name:'Save weight',exact:true}).click();
  await expect(weightDialog).toHaveCount(0);await expect(page.locator('.review-weight-current>strong')).toContainText('71');
  await page.getByRole('button',{name:'Edit energy profile',exact:true}).click();
  const setup=page.getByRole('dialog',{name:'Your weight & energy profile'});
  await expect(setup.getByLabel('Date of birth',{exact:true})).toHaveValue('1996-10-30');
  await setup.getByRole('combobox',{name:'Usual activity category',exact:true}).selectOption('active');
  await setup.getByRole('button',{name:'Save profile',exact:true}).click();
  await expect(setup).toHaveCount(0);await expect(page.locator('.review-energy-number')).toContainText('2,950');
  expect((await page.request.patch('/api/v1/profile',{headers:{Authorization:`Bearer ${auth.token}`},data:{dob:'2010-01-01'}})).status()).toBe(200);
  await page.reload();await expect(page.getByText('Adult estimates unavailable',{exact:true})).toBeVisible();
  await expect(page.locator('.review-energy-number')).toHaveCount(0);
});
function fixture():HealthReview{
  return {generated_at:new Date().toISOString(),timezone:'Asia/Kolkata',today:'2026-10-30',body:{age_years:30,bmi:22.9,bmi_category:'Healthy range',reference_kg:[56.7,76.3],maintenance_kcal:2550,energy_status:'ready',reasons:[],model:'DRI-EER-2023',energy_activity:'inactive',goal_type:'maintain',goal_weight_kg:null,current_weight_kg:70},weights:[{id:'1',weight_kg:71,observed_at:'2026-10-20T05:30:00Z',source:'manual'},{id:'2',weight_kg:70,observed_at:'2026-10-29T05:30:00Z',source:'manual'}],
    activity:{connected:true,last_synced_at:new Date().toISOString(),warnings:[],feeds:[],period:{start:'2026-10-23',end:'2026-10-29'},previous_period:{start:'2026-10-16',end:'2026-10-22'},movement_days:5,recorded_days:7,steps:8400,distance_km:6.5,active_minutes:180,active_calories_kcal:700,comparison:{status:'ready',step_delta:1400,step_percent:20,previous_steps:7000},recurring:[{hour:18,days:4,recorded_days:7,active_minutes:90}],intensity:{light:90,moderate:70,vigorous:20},exercises:[{start_time:'2026-10-29T12:30:00Z',end_time:'2026-10-29T13:00:00Z',type:'RUNNING',source:'Google Health'}],matches:[{observed_at:'2026-10-29T12:40:00Z',heart_rate:88,activity_start:'2026-10-29T12:39:00Z',activity_end:'2026-10-29T12:41:00Z',source:'ESP32_MAX30102_DS18B20_AD8232'}]},facts:[{id:'consistency',title:'Recorded movement',detail:'Movement was recorded on 5 days with 7 days of records.'}]};
}
test('review presents sourced activity context with usable responsive layouts and truthful failure states',async({page},info)=>{
  await session(page);const review=fixture();
  await page.route('**/api/v1/health/review',route=>route.fulfill({json:review}));
  await page.goto('/wellness');await expect(page.locator('.review-comparison')).toContainText('20% more recorded steps');
  await expect(page.getByText('Running',{exact:true})).toBeVisible();
  await expect(page.locator('.review-sensor-context')).toContainText('88');
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:1000});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('.wellness-review-heading').scrollIntoViewIfNeeded();
    await page.screenshot({path:info.outputPath(`wellness-${width}.png`)});
    if(width>=1000)await page.locator('.review-body-grid').screenshot({path:info.outputPath(`weight-energy-${width}.png`)});
    else{await page.locator('.review-weight-card').screenshot({path:info.outputPath(`weight-${width}.png`)});await page.locator('.review-energy-card').screenshot({path:info.outputPath(`energy-${width}.png`)});}
  }
  const accessibility=await new AxeBuilder({page}).include('.wellness-review-page').analyze();expect(accessibility.violations).toEqual([]);
  await page.setViewportSize({width:390,height:950});await page.getByRole('button',{name:'Edit energy profile',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Your weight & energy profile'});await expect(dialog).toBeVisible();
  await page.screenshot({path:info.outputPath('energy-profile-mobile.png')});
  const formAccess=await new AxeBuilder({page}).include('.review-profile-form').analyze();expect(formAccess.violations).toEqual([]);
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
  review.activity.warnings=['steps'];review.activity.comparison={status:'refresh_failed',step_delta:null,step_percent:null,previous_steps:7000};
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.review-comparison')).toContainText('A fresh import is needed');
  await expect(page.locator('.review-comparison')).not.toContainText('20%');
});
