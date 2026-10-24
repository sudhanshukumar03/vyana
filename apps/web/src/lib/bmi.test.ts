import { expect, it } from 'vitest';
import { computeBmi } from './bmi';
it('classifies before rounding at the category boundary',()=>{
  expect(computeBmi(200,99.9)).toEqual({value:25,category:'normal',label:'Normal'});
});
it('rejects missing or out-of-range body measurements',()=>{
  expect(computeBmi(null,72)).toBeNull();expect(computeBmi(-2,72)).toBeNull();
});
