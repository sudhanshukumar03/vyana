import { LayoutDashboard, Activity, Target, Settings, TrendingUp, Brain, FileText, Clock, AlertTriangle, Bot } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';

const sections = [
  { label: 'Overview', items: [{ name: 'Dashboard', path: '/', icon: LayoutDashboard }] },
  { label: 'Monitoring', items: [
    { name: 'Health Vitals', path: '/vitals', icon: Activity },
    { name: 'Activity', path: '/activity', icon: Target },
    { name: 'Trends', path: '/trends', icon: TrendingUp },
    { name: 'History', path: '/history', icon: Clock },
  ] },
  { label: 'Insights', items: [
    { name: 'Mental Well-being', path: '/wellness', icon: Brain },
    { name: 'AI Assistant', path: '/assistant', icon: Bot },
    { name: 'Reports', path: '/reports', icon: FileText },
  ] },
  { label: 'Safety', items: [{ name: 'Emergency', path: '/emergency', icon: AlertTriangle }] },
  { label: 'Account', items: [{ name: 'Settings', path: '/settings', icon: Settings }] },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();

  return (
    <div className="w-[260px] bg-transparent flex flex-col h-screen shrink-0">
      <div className="px-5 pt-7 pb-6">
        <Link
          to="/"
          onClick={onNavigate}

          className="inline-flex min-h-14 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 focus-visible:ring-offset-canvas"
        >
          <BrandLogo />
        </Link>
      </div>

      <nav className="flex-1 px-4 py-2 overflow-y-auto space-y-5">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-4 mb-1.5 text-[11px] font-semibold text-slate">{section.label}</p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    onClick={onNavigate}
                    className={`flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      isActive
                        ? 'bg-ink/[0.06] text-ink'
                        : 'text-slate hover:text-ink hover:bg-ink/[0.04]'
                    }`}
                  >
                    <item.icon size={18} strokeWidth={isActive ? 2.4 : 1.6} className={isActive ? 'text-brand' : 'text-muted'} aria-hidden="true" />
                    {item.name}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
