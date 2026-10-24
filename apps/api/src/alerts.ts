export interface VitalAlert {
  severity: 'warning' | 'critical';
  title: string;
  detail: string;
  metric: 'heart_rate' | 'spo2' | 'temperature';
}

// Pure threshold evaluation — project rules in docs/FEATURES.md.
// No side effects, so it is unit-testable without a database.
export function vitalAlerts(heart_rate: number, spo2: number, temperature: number): VitalAlert[] {
  const out: VitalAlert[] = [];

  if (heart_rate > 150) out.push({ severity: 'critical', title: 'Critical Heart Rate', detail: `Heart rate is ${heart_rate} bpm`, metric: 'heart_rate' });
  else if (heart_rate > 120) out.push({ severity: 'warning', title: 'High Heart Rate', detail: `Heart rate is ${heart_rate} bpm`, metric: 'heart_rate' });
  else if (heart_rate < 40) out.push({ severity: 'critical', title: 'Critically Low Heart Rate', detail: `Heart rate is ${heart_rate} bpm`, metric: 'heart_rate' });
  else if (heart_rate < 45) out.push({ severity: 'warning', title: 'Low Heart Rate', detail: `Heart rate is ${heart_rate} bpm`, metric: 'heart_rate' });

  if (spo2 < 88) out.push({ severity: 'critical', title: 'Critically Low SpO₂', detail: `SpO₂ is ${spo2}%`, metric: 'spo2' });
  else if (spo2 < 92) out.push({ severity: 'warning', title: 'Low SpO₂', detail: `SpO₂ is ${spo2}%`, metric: 'spo2' });

  if (temperature > 39.5) out.push({ severity: 'critical', title: 'High Fever', detail: `Temperature is ${temperature}°C`, metric: 'temperature' });
  else if (temperature > 38.0) out.push({ severity: 'warning', title: 'Fever', detail: `Temperature is ${temperature}°C`, metric: 'temperature' });
  else if (temperature < 35.0) out.push({ severity: 'warning', title: 'Low Body Temperature', detail: `Temperature is ${temperature}°C`, metric: 'temperature' });

  return out;
}
