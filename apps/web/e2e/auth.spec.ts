import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({page}) => {
  await page.route('**/api/v1/auth/refresh', route => route.fulfill({status:401,json:{error:'Authentication required'}}));
});

test('auth layout adapts without overflow and keeps controls accessible', async ({page}) => {
  for (const [width,height] of [[320,700],[390,844],[768,941],[844,390],[1024,768],[1440,900],[1672,941]]) {
    await page.setViewportSize({width,height});
    await page.goto('/');
    for (const mode of ['login','register']) {
      if (mode === 'register') await page.getByRole('button',{name:'Create one',exact:true}).click();
      await expect(page.getByRole('heading',{name:mode === 'login' ? 'Welcome back.' : 'Create your account.',exact:true})).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await expect(page.locator('.auth-story')).toBeVisible();
      await expect(page.getByRole('img',{name:'Vyana — Your vitals. In sync.',exact:true})).toHaveCount(1);
      const targets=await page.locator('input,button').evaluateAll(elements=>elements.map(element=>{
        const box=element.getBoundingClientRect();return {width:box.width,height:box.height,left:box.left,right:box.right};
      }).filter(box=>box.width&&box.height));
      expect(targets.every(box=>box.width>=44&&box.height>=44)).toBe(true);
      expect(targets.every(box=>box.left>=0&&box.right<=width)).toBe(true);
      const alignment=await page.locator('.auth-intro').evaluate(element=>{
        const heading=element.querySelector('h1')!.getBoundingClientRect();
        const form=document.querySelector('form')!.getBoundingClientRect();
        return Math.abs(heading.x-form.x);
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
  await page.setViewportSize({width:320,height:700});
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
  await expect(page.getByRole('heading',{name:'Create your account.',exact:true})).toBeFocused();
  await page.keyboard.press('Tab');await expect(email).toBeFocused();
  await expect(password).toHaveAttribute('type','password');
  await expect(password).toHaveAttribute('autocomplete','new-password');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await password.fill('short');await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveText('Choose a password with at least 8 characters.');
  expect(calls).toBe(2);
  let releaseRegistration:(()=>void)|undefined;
  await page.route('**/api/v1/auth/register',async route=>{
    await new Promise<void>(resolve=>{releaseRegistration=resolve;});
    await route.fulfill({status:503,json:{error:'Registration is temporarily unavailable.'}});
  });
  await password.fill('synthetic-test-password');
  const registerButton=page.getByRole('button',{name:'Create account',exact:true});
  const buttonHeight=(await registerButton.boundingBox())!.height;
  try {
    await registerButton.click();
    await expect.poll(()=>Boolean(releaseRegistration)).toBe(true);
    const pending=page.getByRole('button',{name:'Creating account…',exact:true});
    await expect(pending).toBeDisabled();
    expect((await pending.boundingBox())!.height).toBe(buttonHeight);
    await expect(page.getByRole('alert')).toHaveCount(0);
    releaseRegistration?.();
    await expect(registerButton).toBeEnabled();
    await expect(page.getByRole('alert')).toHaveText('Registration is temporarily unavailable.');
  }finally{releaseRegistration?.();}
});
