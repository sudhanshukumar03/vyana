import React from 'react';
import { motion } from 'framer-motion';
import { Network } from 'lucide-react';

export const AIAnalytics: React.FC = () => {
  return (
    <section id="analytics" className="py-24 relative z-10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        
        {/* Left: AI Image/Visualization */}
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="relative h-[500px] rounded-2xl overflow-hidden glass-panel group"
        >
          <div className="absolute inset-0 bg-brand-darker/60 z-10 group-hover:bg-brand-darker/40 transition-colors"></div>
          <img 
            src="/assets/ai_lab.png" 
            alt="AI Lab Analytics" 
            className="w-full h-full object-cover mix-blend-lighten"
          />
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="w-[300px] h-[300px] border border-brand-cyan/20 rounded-full flex items-center justify-center">
              <div className="w-[200px] h-[200px] border border-brand-purple/40 rounded-full animate-[spin_10s_linear_infinite] flex items-center justify-center border-t-brand-cyan">
                <div className="w-16 h-16 bg-brand-cyan/10 rounded-full shadow-[0_0_50px_rgba(0,240,255,0.8)] backdrop-blur-md flex items-center justify-center">
                  <Network className="w-8 h-8 text-white" />
                </div>
              </div>
            </div>
          </div>
          {/* Overlay scanning line */}
          <div className="absolute inset-0 z-30 opacity-20 pointer-events-none">
            <div className="w-full h-1 bg-white shadow-[0_0_20px_#fff] animate-scan"></div>
          </div>
        </motion.div>

        {/* Right: Content */}
        <div className="space-y-8">
          <div>
            <h2 className="text-sm font-mono text-brand-blue tracking-[0.2em] uppercase mb-2 flex items-center gap-2">
              <div className="w-8 h-[1px] bg-brand-blue"></div>
              AI_CORE
            </h2>
            <h3 className="text-4xl font-bold leading-tight">Predictive <br/><span className="text-glow-cyan text-brand-blue">Healthcare Analytics</span></h3>
          </div>
          
          <p className="text-slate-400 leading-relaxed">
            Our neural network processes millions of data points per second, cross-referencing live telemetry with global medical databases to predict anomalies before they manifest physically.
          </p>

          <div className="space-y-4">
            {[
              { label: 'Neural Accuracy', value: '99.8%', color: 'bg-brand-cyan' },
              { label: 'Data Processing', value: '4.2 TB/s', color: 'bg-brand-purple' },
              { label: 'Anomaly Prediction Horizon', value: '14 Days', color: 'bg-brand-emerald' }
            ].map((stat, idx) => (
              <div key={idx} className="relative">
                <div className="flex justify-between font-mono text-sm mb-1">
                  <span className="text-slate-300">{stat.label}</span>
                  <span className="text-white font-bold">{stat.value}</span>
                </div>
                <div className="h-1 w-full bg-brand-dark rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    whileInView={{ width: '100%' }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.5, delay: idx * 0.2 }}
                    className={`h-full ${stat.color} shadow-[0_0_10px_currentColor]`}
                  ></motion.div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};
