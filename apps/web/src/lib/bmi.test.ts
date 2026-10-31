import { expect, it } from 'vitest';
import { ageFromBirthDate,computeBmi } from './bmi';
it('classifies before rounding at the category boundary',()=>{
  expect(computeBmi(200,99.9)).toEqual({value:25,category:'normal',label:'Normal'});
});
it('rejects missing or out-of-range body measurements',()=>{
  expect(computeBmi(null,72)).toBeNull();expect(computeBmi(-2,72)).toBeNull();
});
it('uses the profile-local birthday for exact adult eligibility',()=>{
  const now=new Date('2026-10-29T19:00:00Z');
  expect(ageFromBirthDate('2006-10-30','Asia/Kolkata',now)).toBe(20);
  expect(ageFromBirthDate('2006-10-30','America/New_York',now)).toBe(19);
  expect(ageFromBirthDate('2006-10-31','Asia/Kolkata',now)).toBe(19);
});
it('rejects invalid, future and unknown birthdays rather than inferring age',()=>{
  const now=new Date('2026-10-30T06:00:00Z');
  for(const dob of [null,'2026-02-30','2030-01-01','not-a-date','1800-01-01'])expect(ageFromBirthDate(dob,'Asia/Kolkata',now)).toBeNull();
  expect(ageFromBirthDate('2000-01-01','invalid-zone',now)).toBeNull();
});
