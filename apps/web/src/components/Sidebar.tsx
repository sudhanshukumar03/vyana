import { LayoutDashboard, Activity, Target, Settings, TrendingUp, Brain, FileText, Clock, AlertTriangle, Bot, UserRound } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';

const sections = [
  { label: 'Your health', items: [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Health Vitals', path: '/vitals', icon: Activity },
    { name: 'Activity', path: '/activity', icon: Target },
    { name: 'Trends', path: '/trends', icon: TrendingUp },
    { name: 'History', path: '/history', icon: Clock },
  ] },
  { label: 'Guidance', items: [
    { name: 'AI Assistant', path: '/assistant', icon: Bot },
    { name: 'Wellness', path: '/wellness', icon: Brain },
    { name: 'Reports', path: '/reports', icon: FileText },
  ] },
  { label: 'Your account', items: [
    { name: 'Profile', path: '/profile', icon: UserRound },
    { name: 'Settings', path: '/settings', icon: Settings },
  ] },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="sidebar" aria-label="Vyana navigation">
      <Link to="/" onClick={onNavigate} className="sidebar-brand"><BrandLogo inverse /></Link>
      <nav aria-label="Main navigation">
        {sections.map(section => (
          <div key={section.label}>
            <p className="sidebar-section-label">{section.label}</p>
            {section.items.map(item => (
              <NavLink key={item.path} to={item.path} end={item.path === '/'} onClick={onNavigate} className="sidebar-link">
                <item.icon aria-hidden="true" /><span>{item.name}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <NavLink to="/emergency" onClick={onNavigate} className="sidebar-link"><AlertTriangle aria-hidden="true" />Emergency</NavLink>
      </div>
    </aside>
  );
}
