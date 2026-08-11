import React from 'react';

export const CyberBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-gradient-to-br from-[#e0f7fa] via-[#f0f8ff] to-[#e1f5fe]">
      {/* Base Light Neural Image Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-60 mix-blend-multiply"
        style={{ backgroundImage: 'url(/assets/light_neural_bg.png)' }}
      ></div>
      
      {/* Overlay Soft Gradients to ensure text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/80 via-white/40 to-transparent"></div>
    </div>
  );
};
