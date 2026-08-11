import React from 'react';
import { HeartPulse, Activity, BrainCircuit, ShieldAlert, Cloud, Dna } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';

export const FeaturesSection: React.FC = () => {
  const features = [
    { icon: Activity, title: 'ECG Monitoring', desc: 'Real-time continuous electrocardiogram streaming with sub-millisecond latency.', color: 'cyan' },
    { icon: HeartPulse, title: 'Heartbeat Analysis', desc: 'Deep learning pattern recognition for immediate arrhythmia detection.', color: 'purple' },
    { icon: Dna, title: 'SpO2 Detection', desc: 'Non-invasive optical blood oxygen saturation tracking.', color: 'blue' },
    { icon: BrainCircuit, title: 'AI Predictions', desc: 'Predictive health modeling forecasting potential critical conditions.', color: 'cyan' },
    { icon: ShieldAlert, title: 'Emergency Alerts', desc: 'Automated dispatch protocols triggering on predefined vital thresholds.', color: 'alert' },
    { icon: Cloud, title: 'Cloud Dashboard', desc: 'Secure, encrypted global access to patient telemetry history.', color: 'emerald' },
  ];

  return (
    <section id="features" className="py-24 relative z-10">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="mb-16">
          <h2 className="text-sm font-mono text-brand-cyan tracking-[0.2em] uppercase mb-2 flex items-center gap-2">
            <div className="w-8 h-[1px] bg-brand-cyan"></div>
            Diagnostics
          </h2>
          <h3 className="text-4xl font-bold">Advanced <span className="text-glow-cyan text-brand-cyan">Core Systems</span></h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, idx) => (
            <GlassCard key={idx} delay={idx * 0.1} glowColor={feat.color as any} className="group">
              <div className={`w-12 h-12 rounded bg-brand-dark flex items-center justify-center mb-6 border border-white/5 group-hover:scale-110 transition-transform duration-300`}>
                <feat.icon className={`w-6 h-6 text-brand-${feat.color} text-glow-${feat.color}`} />
              </div>
              <h4 className="text-xl font-bold mb-3 font-mono tracking-tight text-white group-hover:text-glow-cyan transition-colors">
                {feat.title}
              </h4>
              <p className="text-slate-400 text-sm leading-relaxed">
                {feat.desc}
              </p>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
};
