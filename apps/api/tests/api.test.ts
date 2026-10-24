import { vitalAlerts } from '../src/alerts';

describe('vitalAlerts thresholds', () => {
  it('flags a critically high heart rate', () => {
    const a = vitalAlerts(165, 98, 36.7);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ metric: 'heart_rate', severity: 'critical' });
  });

  it('flags low SpO₂ as warning and high temperature as critical', () => {
    const a = vitalAlerts(80, 90, 39.8);
    const flags = a.map((x) => `${x.metric}:${x.severity}`);
    expect(flags).toContain('spo2:warning');
    expect(flags).toContain('temperature:critical');
  });

  it('returns no alerts for normal vitals', () => {
    expect(vitalAlerts(72, 98, 36.7)).toHaveLength(0);
  });
});
