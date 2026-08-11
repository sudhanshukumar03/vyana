import React from 'react';
import { Activity } from 'lucide-react';
import { motion } from 'framer-motion';

export const Navbar: React.FC = () => {
  return (
    <motion.nav 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="fixed top-6 left-1/2 -translate-x-1/2 w-[95%] max-w-7xl z-50 px-8 py-3 bg-white/80 backdrop-blur-xl border border-white rounded-full shadow-[0_8px_32px_rgba(0,188,212,0.1)] flex items-center justify-between"
    >
      <div className="flex items-center gap-3 cursor-pointer group">
        <Activity className="w-6 h-6 text-brand-dark" />
        <span className="font-mono font-bold text-lg tracking-tight text-brand-dark">
          MED<span className="text-brand-cyan">OS</span>.2040
        </span>
      </div>
      
      <div className="hidden md:flex items-center gap-8 font-mono text-sm tracking-widest text-slate-600 font-bold uppercase">
        <a href="#hero" className="hover:text-brand-cyan transition-colors">SYSTEM</a>
        <a href="#features" className="hover:text-brand-cyan transition-colors">DIAGNOSTICS</a>
        <a href="#dashboard" className="hover:text-brand-cyan transition-colors">TELEMETRY</a>
        <a href="#analytics" className="hover:text-brand-cyan transition-colors">AI_CORE</a>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-brand-teal shadow-[0_0_10px_#009688]"></div>
        <span className="font-mono text-xs tracking-widest text-brand-teal font-bold">SYSTEM ONLINE</span>
      </div>
    </motion.nav>
  );
};
