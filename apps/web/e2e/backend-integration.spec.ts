import {expect,test} from '@playwright/test';

test('browser logout completes server revocation before a reload',async({page})=>{
  const signup=await page.request.post('/api/v1/auth/register',{data:{
    email:`backend-audit-${Date.now()}@example.test`,password:'backend-audit-password',
  }});
  expect(signup.status()).toBe(201);
  const {token}=await signup.json();
  const headers={Authorization:`Bearer ${token}`};
  expect((await page.request.patch('/api/v1/profile',{headers,data:{height_cm:175,weight_kg:72,dob:'1990-01-01'}})).status()).toBe(200);
  await page.goto('/settings');
  const logout=page.waitForResponse(response=>response.url().endsWith('/api/v1/auth/logout'));
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  expect((await logout).status()).toBe(200);
  await page.goto('/login');
  await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
  expect((await page.request.get('/api/v1/profile',{headers})).status()).toBe(401);
  await page.reload();
  await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
});
