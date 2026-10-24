import { randomUUID } from 'crypto';
import { bmi, vitalsSchema, activitySchema, validateReport } from '../src/schemas';
import { loadConfig } from '../src/config';

test('BMI categories use unrounded values and require supported age',()=>{
  expect(bmi({height_cm:200,weight_kg:99.9,dob:'1990-01-01'})?.category).toBe('Normal');
  expect(bmi({height_cm:200,weight_kg:99.9})?.category).toBe('Not classified');
});
test('signing secrets are mandatory',()=>{
  expect(()=>loadConfig({DATABASE_URL:'postgresql://localhost/test'})).toThrow('JWT_SECRET');
});
test('storage types, strings and acquisition metadata are enforced',()=>{
  const envelope={session_id:randomUUID(),sequence:1,observed_at:new Date().toISOString(),source:'test'};
  expect(vitalsSchema.safeParse({...envelope,heart_rate:72.5,spo2:98,temperature:36.7,ecg_status:'Normal'}).success).toBe(false);
  expect(activitySchema.safeParse({...envelope,steps:2**40,distance_km:1,calories:1,active_minutes:1}).success).toBe(false);
});
test('reports enforce byte size and file signatures',()=>{
  expect(()=>validateReport({data_base64:Buffer.from('not a png').toString('base64'),mime_type:'image/png',filename:''})).toThrow();
});
