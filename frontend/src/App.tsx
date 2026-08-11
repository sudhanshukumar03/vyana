import { CyberBackground } from './components/layout/CyberBackground';
import { Navbar } from './components/layout/Navbar';
import { HeroSection } from './components/health/HeroSection';
import { FeaturesSection } from './components/health/FeaturesSection';
import { LiveDashboard } from './components/health/LiveDashboard';
import { AIAnalytics } from './components/health/AIAnalytics';
import { EmergencySystem } from './components/health/EmergencySystem';
import { FuturisticFooter } from './components/layout/FuturisticFooter';

function App() {
  return (
    <div className="relative min-h-screen text-slate-200 selection:bg-brand-cyan/30 selection:text-white">
      <CyberBackground />
      <Navbar />
      
      <main>
        <HeroSection />
        <FeaturesSection />
        <LiveDashboard />
        <AIAnalytics />
        <EmergencySystem />
      </main>

      <FuturisticFooter />
    </div>
  );
}

export default App;
