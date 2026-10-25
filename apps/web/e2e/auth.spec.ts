import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({page}) => {
  await page.route('**/api/v1/auth/refresh', route => route.fulfill({status:401,json:{error:'Authentication required'}}));
});

test('reference auth layout adapts without overflow and keeps controls accessible', async ({page}) => {
  for (const width of [320,390,768,1440,1672]) {
    await page.setViewportSize({width,height:941});
    await page.goto('/');
    for (const mode of ['login','register']) {
      if (mode === 'register') await page.getByRole('button',{name:'Create one',exact:true}).click();
      await expect(page.getByRole('heading',{name:mode === 'login' ? 'Sign in to Vyana' : 'Create your Vyana account',exact:true})).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await expect(page.locator('.auth-story')).toBeVisible({visible:width>=1024});
      const targets=await page.locator('input,button').evaluateAll(elements=>elements.map(element=>{
        const box=element.getBoundingClientRect();return {width:box.width,height:box.height};
      }).filter(box=>box.width&&box.height));
      expect(targets.every(box=>box.width>=44&&box.height>=44)).toBe(true);
      const alignment=await page.locator('.auth-intro').evaluate(element=>{
        const logo=element.querySelector('[role=img]')!.getBoundingClientRect();
        const form=document.querySelector('form')!.getBoundingClientRect();
        return Math.abs(logo.x+logo.width/2-form.x-form.width/2);
      });
      expect(alignment).toBeLessThan(1);
      if(width===390||width===1672) {
        const audit=await new AxeBuilder({page}).analyze();
        expect(audit.violations.filter(item=>['serious','critical'].includes(item.impact||'')).map(item=>item.id)).toEqual([]);
      }
    }
  }
});

test('auth supports password visibility, errors, pending state and duplicate prevention', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveText('Enter your email and password.');
  const email=page.getByLabel('Email',{exact:true}),password=page.getByLabel('Password',{exact:true});
  await email.fill('synthetic@example.test');await password.fill('synthetic-test-password');
  await password.focus();await page.keyboard.press('Tab');
  const show=page.getByRole('button',{name:'Show password',exact:true});await expect(show).toBeFocused();
  await page.keyboard.press('Space');
  await expect(password).toHaveAttribute('type','text');
  await expect(page.getByRole('button',{name:'Hide password',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(password).toHaveValue('synthetic-test-password');
  let calls=0,release:(()=>void)|undefined;
  await page.route('**/api/v1/auth/login',async route=>{
    calls++;
    if(calls===2) await new Promise<void>(resolve=>{release=resolve;});
    await route.fulfill({status:401,json:{error:'Email or password was not accepted.'}});
  });
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveText('Email or password was not accepted.');
  try {
    await password.focus();await password.press('Enter');
    await expect.poll(()=>Boolean(release)).toBe(true);
    await expect(page.getByRole('button',{name:'Signing in…',exact:true})).toBeDisabled();
    await expect(page.getByRole('button',{name:'Create one',exact:true})).toBeDisabled();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await password.press('Enter');expect(calls).toBe(2);
    release?.();
    await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeEnabled();
  }finally{release?.();}
  await page.getByRole('button',{name:'Create one',exact:true}).click();
  await expect(password).toHaveAttribute('type','password');
  await expect(password).toHaveAttribute('autocomplete','new-password');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await password.fill('short');await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveText('Choose a password with at least 8 characters.');
  expect(calls).toBe(2);
});
