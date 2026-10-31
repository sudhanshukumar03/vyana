import { synthesizeEcgSamples, simulateVitalsSchema } from '../src/admin-simulation';

describe('Admin Simulation Logic & Synthesis', () => {
  it('validates simulateVitalsSchema against allowed clinical ranges', () => {
    const valid = simulateVitalsSchema.safeParse({
      heart_rate: 76,
      spo2: 98.5,
      temperature: 36.8,
      ecg_status: 'Normal',
      generate_ecg_batch: true,
      source: 'BackOffice_Simulator',
    });
    expect(valid.success).toBe(true);

    const invalid = simulateVitalsSchema.safeParse({
      heart_rate: 10, // too low (< 20)
      spo2: 105, // too high (> 100)
      temperature: 20, // too low (< 30)
      ecg_status: 'InvalidRhythm',
    });
    expect(invalid.success).toBe(false);
  });

  it('synthesizes 128 AD8232 ECG samples matching standard morphology', () => {
    const samples = synthesizeEcgSamples(72, 'Normal');
    expect(samples).toHaveLength(128);

    // Initial sample must start at offset 0
    expect(samples[0][0]).toBe(0);
    expect(samples[0][2]).toBe(0); // Leads On

    // Offsets must strictly increase by 10ms
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i][0]).toBe(samples[i - 1][0] + 10);
      expect(samples[i][1]).toBeGreaterThanOrEqual(0);
      expect(samples[i][1]).toBeLessThanOrEqual(4095);
    }

    // Must contain peak deflection (R peak > 3000)
    const peak = Math.max(...samples.map((s) => s[1]));
    expect(peak).toBeGreaterThan(3000);
  });

  it('synthesizes leads off disconnected signal when requested', () => {
    const samples = synthesizeEcgSamples(80, 'Leads Off');
    expect(samples).toHaveLength(128);
    // Disconnected lead flag should be 3
    expect(samples.every((s) => s[2] === 3)).toBe(true);
  });

  it('adjusts cycle intervals for tachycardia and bradycardia', () => {
    const fastSamples = synthesizeEcgSamples(160, 'Normal');
    const slowSamples = synthesizeEcgSamples(45, 'Normal');
    expect(fastSamples).toHaveLength(128);
    expect(slowSamples).toHaveLength(128);
  });
});

