import React from 'react';
import { Activity, Terminal, Globe, Share2 } from 'lucide-react';

export const FuturisticFooter: React.FC = () => {
  return (
    <footer className="relative border-t border-white/10 bg-brand-darker/80 backdrop-blur-md pt-16 pb-8 overflow-hidden z-10">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 relative z-10">
        
        <div className="col-span-1 md:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-brand-cyan" />
            <span className="font-mono font-bold text-xl tracking-tight text-white">
              MED<span className="text-brand-cyan">OS</span>.2040
            </span>
          </div>
          <p className="text-slate-400 text-sm max-w-sm">
            Next-generation intelligent healthcare operating system powered by advanced neural networks and real-time biometric telemetry.
          </p>
        </div>
        
        <div>
          <h4 className="font-mono text-white text-xs uppercase tracking-widest mb-4">Core Systems</h4>
          <ul className="space-y-2 text-sm text-slate-400 font-mono">
            <li><a href="#" className="hover:text-brand-cyan transition-colors">Telemetry</a></li>
            <li><a href="#" className="hover:text-brand-cyan transition-colors">Neural Analytics</a></li>
            <li><a href="#" className="hover:text-brand-cyan transition-colors">Emergency Protocol</a></li>
            <li><a href="#" className="hover:text-brand-cyan transition-colors">System Logs</a></li>
          </ul>
        </div>
        
        <div>
          <h4 className="font-mono text-white text-xs uppercase tracking-widest mb-4">Terminal Access</h4>
          <div className="flex gap-4">
            <a href="#" className="w-10 h-10 rounded glass-panel flex items-center justify-center hover:bg-brand-cyan/20 hover:text-brand-cyan transition-all">
              <Terminal className="w-5 h-5" />
            </a>
            <a href="#" className="w-10 h-10 rounded glass-panel flex items-center justify-center hover:bg-brand-cyan/20 hover:text-brand-cyan transition-all">
              <Share2 className="w-5 h-5" />
            </a>
            <a href="#" className="w-10 h-10 rounded glass-panel flex items-center justify-center hover:bg-brand-cyan/20 hover:text-brand-cyan transition-all">
              <Globe className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 relative z-10">
        <p className="text-xs text-slate-500 font-mono">
          &copy; 2040 MEDOS Corp. All telemetry data encrypted.
        </p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-brand-emerald rounded-full animate-pulse-slow"></div>
          <span className="text-xs text-brand-emerald font-mono uppercase tracking-widest">Network Secure</span>
        </div>
      </div>
    </footer>
  );
};
