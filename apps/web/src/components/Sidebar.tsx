import { Sliders, LayoutDashboard, Activity, Target, Settings, TrendingUp, Brain, FileText, Clock, AlertTriangle, Bot, UserRound, LogOut } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';
import { useIsAdminOrDev } from '../store/useAdminAccess';
import { useHealthStore } from '../store/useHealthStore';

const sections = [
  { label: 'Your health', items: [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Vitals', path: '/vitals', icon: Activity },
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
  const showBackOffice = useIsAdminOrDev();
  const logout = useHealthStore(state => state.logout);
  const navigate = useNavigate();

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
        {showBackOffice && (
          <NavLink to="/admin" onClick={onNavigate} className="sidebar-link mb-1">
            <Sliders aria-hidden="true" /><span>Back-Office</span>
          </NavLink>
        )}
        <NavLink to="/emergency" onClick={onNavigate} className="sidebar-link is-emergency">
          <span className="relative inline-flex items-center justify-center shrink-0" aria-hidden="true">
            <AlertTriangle className="text-red-500" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
          </span>
          <span>Emergency</span>
        </NavLink>
        <button type="button" className="sidebar-link w-full text-left" onClick={() => {
          logout();
          onNavigate?.();
          navigate('/login');
        }}>
          <LogOut aria-hidden="true" /><span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
