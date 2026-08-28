import React from 'react';
import { motion } from 'framer-motion';

interface HUDElementProps {
  label: string;
  value: string;
  unit?: string;
  status?: 'normal' | 'warning' | 'critical';
  className?: string;
}

export const HUDElement: React.FC<HUDElementProps> = ({ 
  label, 
  value, 
  unit, 
  status = 'normal',
  className = '' 
}) => {
  const statusColors = {
    normal: 'text-brand-emerald text-glow-emerald',
    warning: 'text-yellow-400',
    critical: 'text-brand-alert text-glow-alert'
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className={`relative glass-panel px-4 py-3 rounded-lg overflow-hidden border-glow ${className}`}
    >
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
      
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1 font-mono">
        {label}
      </div>
      
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold font-mono tracking-tight ${statusColors[status]}`}>
          {value}
        </span>
        {unit && (
          <span className="text-xs text-slate-500 font-mono">{unit}</span>
        )}
      </div>
      
      {/* Decorative corner brackets */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/20"></div>
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/20"></div>
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/20"></div>
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/20"></div>
    </motion.div>
  );
};
