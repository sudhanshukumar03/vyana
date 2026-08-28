import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

// Specialized Light HUD Element for the Hero Section
const LightHUD: React.FC<{ label: string, value: string, badge: string, badgeColor: 'green' | 'cyan' | 'blue' }> = ({ label, value, badge, badgeColor }) => {
  const badgeClasses = {
    green: 'bg-[#bbf7d0] text-emerald-800',
    cyan: 'bg-[#a5f3fc] text-cyan-800',
    blue: 'bg-[#bfdbfe] text-blue-800',
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_10px_30px_rgba(0,0,0,0.05)] rounded-xl p-3 min-w-[140px]"
    >
      <div className="text-[9px] uppercase font-bold text-slate-500 mb-1">{label}</div>
      <div className="text-sm font-medium text-slate-800 mb-2">{value}</div>
      <div className={`text-[10px] uppercase font-bold px-3 py-1 rounded-full inline-block ${badgeClasses[badgeColor]}`}>
        {badge}
      </div>
    </motion.div>
  );
};

export const HeroSection: React.FC = () => {
  return (
    <section id="hero" className="relative min-h-screen flex items-center pt-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
        
        {/* Left Side: Typography & CTA */}
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-200 bg-white/50 text-slate-700 text-xs font-bold uppercase tracking-widest shadow-sm">
            <Zap className="w-4 h-4 text-brand-cyan" />
            AI-POWERED INTELLIGENCE
          </div>
          
          <h1 className="text-6xl md:text-7xl font-extrabold leading-tight tracking-tighter text-slate-900 uppercase">
            Vitality & <br/>
            Longevity Platform
          </h1>
          
          <p className="text-lg text-slate-700 max-w-lg leading-relaxed font-medium">
            AI-Guided Strategies for Proactive Aging Management, Bio-Marker Analysis, and personalized cellular health optimization. Power your longevity journey.
          </p>
          
          <div className="flex flex-wrap items-center gap-4 pt-4">
            <button className="px-8 py-4 bg-white border border-brand-cyan/20 text-brand-cyan font-bold tracking-widest text-sm uppercase rounded-xl hover:shadow-[0_10px_30px_rgba(0,188,212,0.2)] hover:-translate-y-1 transition-all">
              Live Demo
            </button>
            <button className="px-8 py-4 bg-white/50 border border-white/60 text-slate-700 font-bold tracking-widest text-sm uppercase rounded-xl hover:bg-white transition-all shadow-sm">
              View Dashboard
            </button>
          </div>
        </motion.div>

        {/* Right Side: Realistic Heart & HUD */}
        <div className="relative h-[700px] w-full flex justify-center items-center">
          
          {/* Circular tech accents */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] border border-cyan-500/10 rounded-full animate-spin-slow"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-dashed border-teal-500/10 rounded-full animate-[spin_20s_linear_infinite_reverse]"></div>
          
          {/* Main Heart Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute inset-0 flex justify-center items-center z-10"
          >
            <img 
              src="/assets/light_heart.png" 
              alt="Realistic Human Heart" 
              className="w-[90%] h-auto max-w-none animate-float drop-shadow-2xl"
            />
          </motion.div>

          {/* Orbiting HUD Elements */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="absolute inset-0 z-20 pointer-events-none"
          >
            {/* Top Left */}
            <div className="absolute top-[15%] left-[5%]">
              <LightHUD label="CELLULAR HEALTH" value="NAD+ Level: 145 µM" badge="OPTIMAL" badgeColor="green" />
            </div>
            
            {/* Top Right */}
            <div className="absolute top-[25%] right-[-5%]">
              <LightHUD label="DNA REPAIR INDEX" value="SCORE: 8.2 / 10" badge="VERY HIGH" badgeColor="cyan" />
            </div>
            
            {/* Bottom Left */}
            <div className="absolute bottom-[20%] left-[10%]">
              <LightHUD label="METABOLIC STATUS" value="Insulin Sens: 0.9" badge="EXCELLENT" badgeColor="green" />
            </div>
            
            {/* Bottom Right */}
            <div className="absolute bottom-[10%] right-[0%]">
              <LightHUD label="TELOMERE LENGTH" value="EST. AGE: 38 yrs" badge="YOUNGER" badgeColor="blue" />
            </div>
          </motion.div>
        </div>
      </div>
      
      {/* Light ECG Wave across the bottom */}
      <div className="absolute bottom-0 left-0 w-full h-32 overflow-hidden opacity-20 pointer-events-none z-0">
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 100">
          <path 
            d="M0,50 L200,50 L220,10 L240,90 L260,20 L280,70 L300,50 L500,50 L520,10 L540,90 L560,20 L580,70 L600,50 L1000,50" 
            fill="none" 
            stroke="#00bcd4" 
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </section>
  );
};
