import React from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: 'cyan' | 'emerald' | 'alert' | 'purple' | 'blue';
  delay?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className = '', 
  glowColor = 'cyan',
  delay = 0 
}) => {
  const glowClasses = {
    cyan: 'hover:border-brand-cyan/40 hover:shadow-[0_0_30px_rgba(0,240,255,0.2)]',
    emerald: 'hover:border-brand-emerald/40 hover:shadow-[0_0_30px_rgba(0,255,136,0.2)]',
    alert: 'hover:border-brand-alert/40 hover:shadow-[0_0_30px_rgba(255,0,60,0.2)]',
    purple: 'hover:border-brand-purple/40 hover:shadow-[0_0_30px_rgba(157,0,255,0.2)]',
    blue: 'hover:border-brand-blue/40 hover:shadow-[0_0_30px_rgba(0,136,255,0.2)]',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      className={`glass-panel rounded-xl p-6 transition-all duration-300 ${glowClasses[glowColor]} ${className}`}
    >
      {children}
    </motion.div>
  );
};
