export type BmiCategory = 'under' | 'normal' | 'over' | 'obese';

/** Age changes on a calendar birthday in the profile timezone, not after 365.25 days. */
export function ageFromBirthDate(dob?:string|null,timezone='Asia/Kolkata',now=new Date()):number|null {
  const birth=dob?.slice(0,10);
  if(!birth||!/^\d{4}-\d{2}-\d{2}$/.test(birth)||!Number.isFinite(Date.parse(birth))||new Date(birth).toISOString().slice(0,10)!==birth)return null;
  let today:string;
  try{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const part=(type:string)=>parts.find(value=>value.type===type)?.value;today=`${part('year')}-${part('month')}-${part('day')}`;}catch{return null;}
  if(birth>today)return null;
  const age=Number(today.slice(0,4))-Number(birth.slice(0,4))-(today.slice(5)<birth.slice(5)?1:0);
  return age>=0&&age<=120?age:null;
}

export interface BmiResult {
  value: number;
  category: BmiCategory;
  label: string;
}

// BMI = weight(kg) / height(m)^2. Boundaries inclusive of the lower bound.
export function computeBmi(heightCm?: number | null, weightKg?: number | null): BmiResult | null {
  if (!heightCm || !weightKg || heightCm < 50 || heightCm > 250 || weightKg < 20 || weightKg > 300) return null;
  const m = heightCm / 100;
  const raw = weightKg / (m * m);
  const value = Math.round(raw * 10) / 10;
  const category: BmiCategory =
    raw < 18.5 ? 'under' : raw < 25 ? 'normal' : raw < 30 ? 'over' : 'obese';
  const label = { under: 'Underweight', normal: 'Normal', over: 'Overweight', obese: 'Obese' }[category];
  return { value, category, label };
}

// Healthy weight range (kg) for a height, using the normal BMI band 18.5–24.9.
export function healthyWeightRange(heightCm?: number | null): [number, number] | null {
  if (!heightCm) return null;
  const m = heightCm / 100;
  return [Math.round(18.5 * m * m), Math.round(24.9 * m * m)];
}
