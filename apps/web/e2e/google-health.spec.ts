import {expect,test,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type {GoogleActivityHour,GoogleActivityTimeline,GoogleHealthOverview,GoogleTimelineMetric} from '../../../shared/types/google-health';

async function fixture(page:Page,connected=false,configured=false) {
  const signup=await page.request.post('/api/v1/auth/register',{data:{email:`google-browser-${crypto.randomUUID()}@example.test`,password:'synthetic-google-browser-password'}});
  expect(signup.status()).toBe(201);const auth=await signup.json();
  await page.request.post('/api/v1/profile',{headers:{Authorization:`Bearer ${auth.token}`},data:{full_name:'Activity fixture',height_cm:170,weight_kg:70,dob:'1990-01-01'}});
  await page.route('**/api/v1/auth/refresh',route=>route.fulfill({json:auth}));
  const today='2026-10-29';
  const overview:GoogleHealthOverview={provider:'GoogleHealth',configured,connected,account_email:connected?'activity@example.test':null,
    timezone:'Asia/Kolkata',today,last_synced_at:connected?new Date().toISOString():null,last_attempt_at:new Date().toISOString(),error_code:null,
    days:[{date:'2026-10-28',steps:null,distance_km:null},{date:today,steps:connected?1234:null,distance_km:connected?0.8:null,active_calories_kcal:connected?150.75:null,active_minutes:connected?17:null}]};
  await page.route('**/api/v1/integrations/google-health',async route=>{
    if(route.request().method()==='DELETE'){overview.connected=false;overview.account_email=null;overview.days=overview.days.map(d=>({...d,steps:null,distance_km:null,active_calories_kcal:null,active_minutes:null}));}
    await route.fulfill({json:overview});
  });
  await page.route('**/api/v1/integrations/google-health/timeline?**',async route=>{
    const date=new URL(route.request().url()).searchParams.get('date')!,day=overview.days.find(row=>row.date===date);
    const midnight=Date.parse(`${date}T00:00:00+05:30`);
    const hours:GoogleActivityHour[]=Array.from({length:24},(_,hour)=>({start_time:new Date(midnight+hour*3600000).toISOString(),end_time:new Date(midnight+(hour+1)*3600000).toISOString(),steps:null,distance_km:null,active_calories_kcal:null,active_minutes:null}));
    const intervals:GoogleActivityTimeline['intervals']=[];
    if(overview.connected&&day){
      const totals={steps:day.steps,distance_km:day.distance_km,active_calories_kcal:day.active_calories_kcal,active_minutes:day.active_minutes};
      for(const [key,value] of Object.entries(totals)){
        if(value==null)continue;
        const metric=key as GoogleTimelineMetric;
        const first=metric==='active_minutes'?Math.floor(value/3):metric==='steps'?Math.floor(value/4):value/4;
        hours[9][metric]=first;hours[17][metric]=value-first;
        for(const hour of [9,17])intervals.push({metric,start_time:new Date(midnight+hour*3600000+900000).toISOString(),end_time:new Date(midnight+hour*3600000+2700000).toISOString(),value:hours[hour][metric]!});
      }
    }
    await route.fulfill({json:{date,timezone:overview.timezone,last_synced_at:overview.last_synced_at,metric_warnings:overview.metric_warnings??[],hours,intervals,next_cursor:null,interval_count:intervals.length,unallocated_intervals:0} satisfies GoogleActivityTimeline});
  });
  return overview;
}
test('unconfigured activity honestly shows setup pending without generated steps',async({page})=>{
  await fixture(page);await page.goto('/activity');
  await expect(page.getByRole('heading',{name:'Activity',exact:true})).toBeVisible();
  await expect(page.getByText('Google Health connection setup is pending.',{exact:false})).toBeVisible();
  await expect(page.getByTestId('activity-steps')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Connect Google Health'})).toHaveCount(0);
});
test('configured account can begin a read-only Google connection',async({page})=>{
  await fixture(page,false,true);await page.goto('/activity');
  await expect(page.getByRole('button',{name:'Connect Google Health'})).toBeVisible();
  await expect(page.getByTestId('activity-steps')).toHaveCount(0);
});
test('recorded Google activity works without an ESP32 and disconnect clears it',async({page})=>{
  await fixture(page,true,true);await page.goto('/activity');
  await expect(page.getByTestId('activity-steps')).toHaveText('1,234');
  await expect(page.getByTestId('activity-calories')).toHaveText('150.75 kcal');
  await expect(page.getByTestId('activity-active-time')).toHaveText('17 min');
  await page.getByText('Connection',{exact:true}).click();
  await expect(page.getByText('activity@example.test',{exact:true})).toBeVisible();
  await page.getByText('Connection',{exact:true}).click();
  await page.getByText('View activity records',{exact:true}).click();
  await page.getByLabel('Record type',{exact:true}).selectOption('days');
  await expect(page.getByRole('cell',{name:'No data'}).first()).toBeVisible();
  await page.getByText('Connection',{exact:true}).click();
  await page.getByRole('button',{name:'Disconnect',exact:true}).click();
  await expect(page.getByTestId('activity-steps')).toHaveCount(0);
  await expect(page.getByTestId('activity-calories')).toHaveCount(0);
  await expect(page.getByTestId('activity-active-time')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Connect Google Health'})).toBeVisible();
});
test('calorie and active-time zeros stay available without steps and warnings identify retained data',async({page})=>{
  const overview=await fixture(page,true,true);
  overview.days=[{date:overview.today,steps:null,distance_km:null,active_calories_kcal:0,active_minutes:0}];
  overview.metric_warnings=['active_calories_kcal'];
  await page.goto('/activity');
  await expect(page.getByTestId('activity-steps')).toHaveText('—');
  await expect(page.getByTestId('activity-calories')).toHaveText('0 kcal');
  await expect(page.getByTestId('activity-active-time')).toHaveText('0 min');
  await expect(page.getByText('No activity recorded for today yet.',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Previous recorded values are retained where available.',{exact:false})).toBeVisible();
  await page.getByText('View activity records',{exact:true}).click();
  await page.getByLabel('Record type',{exact:true}).selectOption('days');
  await expect(page.getByRole('columnheader',{name:'Active calories (kcal)',exact:true})).toBeVisible();
});
test('a new day explains missing records, preserves yesterday and displays a subsequent sync',async({page})=>{
  const overview=await fixture(page,true,true);
  const previous=overview.today;
  overview.today='2026-10-30';
  overview.days.push({date:overview.today,steps:null,distance_km:null,active_calories_kcal:null,active_minutes:null});
  await page.route('**/api/v1/integrations/google-health/sync',async route=>{
    overview.last_attempt_at=new Date(Date.now()+1000).toISOString();overview.last_synced_at=overview.last_attempt_at;
    overview.days[overview.days.length-1]={date:overview.today,steps:25,distance_km:0.02,active_calories_kcal:1.5,active_minutes:1};
    await route.fulfill({json:overview});
  });
  await page.goto('/activity');
  await expect(page.getByTestId('activity-steps')).toHaveText('—');
  await expect(page.getByText('No activity recorded for today yet.',{exact:true})).toBeVisible();
  await page.getByLabel('Showing activity for').selectOption(previous);
  await expect(page.getByTestId('activity-steps')).toHaveText('1,234');
  await page.getByLabel('Showing activity for').selectOption(overview.today);
  await page.getByRole('button',{name:'Sync activity',exact:true}).click();
  await expect(page.getByTestId('activity-steps')).toHaveText('25');
  await expect(page.getByText('Activity checked.',{exact:true})).toBeVisible();
  await expect(page.getByText('No activity recorded for today yet.',{exact:true})).toHaveCount(0);
});

test('provider sync failure is visible and keeps recorded activity',async({page})=>{
  const overview=await fixture(page,true,true);
  await page.route('**/api/v1/integrations/google-health/sync',async route=>{
    overview.error_code='sync_failed';overview.last_attempt_at=new Date(Date.now()+1000).toISOString();
    await route.fulfill({json:overview});
  });
  await page.goto('/activity');
  await page.getByRole('button',{name:'Sync activity',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('The last sync could not finish');
  await expect(page.getByTestId('activity-steps')).toHaveText('1,234');
  await expect(page.getByText('Activity checked.',{exact:true})).toHaveCount(0);
});

test('intraday activity shows the busiest recorded period, exact timestamps and missing hours',async({page})=>{
  await fixture(page,true,true);await page.goto('/activity');
  await expect(page.getByText('Live readings only',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Waiting for device readings.',{exact:true})).toHaveCount(0);
  await expect(page.getByTestId('activity-peak')).toContainText('Most active recorded period');
  await expect(page.getByTestId('activity-peak')).toContainText('17:00');
  await expect(page.getByTestId('activity-peak')).toContainText('12 min');
  await page.getByLabel('Show hourly',{exact:true}).selectOption('steps');
  await expect(page.getByTestId('activity-peak')).toContainText('Most steps in a recorded period');
  await expect(page.getByTestId('activity-peak')).toContainText('926 steps');
  await page.getByText('View activity records',{exact:true}).click();
  await page.getByLabel('Record type',{exact:true}).selectOption('hours');
  await expect(page.getByRole('region',{name:'Hourly activity totals'}).getByRole('cell',{name:'No data',exact:true}).first()).toBeVisible();
  await page.getByLabel('Record type',{exact:true}).selectOption('timestamps');
  const records=page.getByRole('region',{name:'Timestamped activity records'});
  await expect(records.locator('time').first()).toHaveAttribute('datetime','2026-10-29T03:45:00.000Z');
  await expect(records.locator('time').first()).toContainText('09:15:00.000');
  const accessibility=await new AxeBuilder({page}).include('.activity-page').analyze();
  expect(accessibility.violations).toEqual([]);
  await page.getByText('Connection',{exact:true}).click();
  await page.getByRole('button',{name:'Disconnect',exact:true}).click();
  await expect(page.getByLabel('Show hourly',{exact:true})).toHaveCount(0);
});

test('activity page fits small and large screens with usable controls',async({page},info)=>{
  await fixture(page,true,true);await page.goto('/activity');
  for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:950});await expect(page.getByTestId('activity-steps')).toHaveText('1,234');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const offenders=await page.locator('button,a,input,select,textarea,summary').evaluateAll(buttons=>buttons.filter(button=>{
      const r=button.getBoundingClientRect(),style=getComputedStyle(button);
      return style.display!=='none'&&style.visibility!=='hidden'&&r.width>0&&r.height>0&&(r.width<44||r.height<44);
    }).map(button=>button.textContent));
    expect(offenders).toEqual([]);
    await page.getByRole('heading',{name:'Activity',exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({path:info.outputPath(`activity-${width}.png`)});
    const records=page.getByRole('region',{name:'Timestamped activity records'});
    const summary=page.getByText('View activity records',{exact:true});
    if(!await records.isVisible())await summary.click();
    await summary.scrollIntoViewIfNeeded();
    await expect(records.getByRole('table')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`activity-${width}-records.png`)});
    await page.getByRole('heading',{name:'Statistics',exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({path:info.outputPath(`activity-${width}-timeline.png`)});
  }
});
