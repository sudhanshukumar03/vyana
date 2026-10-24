export type BmiCategory = 'under' | 'normal' | 'over' | 'obese';

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
