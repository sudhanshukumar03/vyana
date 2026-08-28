import React from 'react';
import { GlassCard } from '../ui/GlassCard';
import { AlertTriangle, Mail, Smartphone, RadioReceiver } from 'lucide-react';

export const EmergencySystem: React.FC = () => {
  return (
    <section className="py-24 relative z-10 border-t border-white/5 bg-brand-darker/50">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-alert/10 text-brand-alert mb-6 shadow-[0_0_30px_rgba(255,0,60,0.2)]">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h3 className="text-4xl font-bold mb-4">Critical <span className="text-brand-alert text-glow-alert">Emergency System</span></h3>
          <p className="text-slate-400">
            Instantaneous response protocols automatically trigger multi-channel alerts when life-threatening vitals are detected.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Smartphone, title: 'SMS Alerts', desc: 'Direct push to designated contacts.', active: true },
            { icon: Mail, title: 'Email Notifications', desc: 'Detailed PDF medical reports.', active: true },
            { icon: RadioReceiver, title: 'Hospital Dispatch', desc: 'Direct API link to local EMTs.', active: false },
            { icon: AlertTriangle, title: 'Audio Alarms', desc: 'Local device critical sirens.', active: true },
          ].map((sys, idx) => (
            <GlassCard key={idx} glowColor={sys.active ? 'alert' : 'cyan'} delay={idx * 0.1}>
              <div className="flex justify-between items-start mb-4">
                <sys.icon className={`w-6 h-6 ${sys.active ? 'text-brand-alert' : 'text-slate-500'}`} />
                <div className={`text-[10px] font-mono tracking-widest uppercase px-2 py-1 rounded border ${sys.active ? 'text-brand-alert border-brand-alert/30 bg-brand-alert/10' : 'text-slate-500 border-white/10'}`}>
                  {sys.active ? 'Online' : 'Standby'}
                </div>
              </div>
              <h4 className="font-bold text-white mb-2">{sys.title}</h4>
              <p className="text-xs text-slate-400">{sys.desc}</p>
            </GlassCard>
          ))}
        </div>

      </div>
    </section>
  );
};
