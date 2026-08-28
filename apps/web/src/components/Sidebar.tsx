import { LayoutDashboard, Activity, Target, Settings, TrendingUp, Brain, FileText, ShieldPlus } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

export function Sidebar() {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Health Vitals', path: '/vitals', icon: Activity },
    { name: 'Activity', path: '/activity', icon: Target },
    { name: 'Trends', path: '/trends', icon: TrendingUp },
    { name: 'Mental Well-being', path: '/wellness', icon: Brain },
    { name: 'Reports', path: '/reports', icon: FileText },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="w-[260px] bg-transparent flex flex-col h-screen shrink-0">
      <div className="px-6 py-8 flex items-center gap-3">
        <div className="bg-emerald-500 p-1.5 rounded-lg flex items-center justify-center">
           <Activity className="text-white w-5 h-5" strokeWidth={3} />
        </div>
        <span className="text-[20px] font-bold text-gray-900 tracking-tight">HealthGuard</span>
      </div>
      
      <nav className="flex-1 px-4 py-2 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={`flex items-center gap-3.5 px-4 py-3 rounded-[14px] text-[15px] font-medium transition-all ${
                isActive
                  ? 'bg-gray-200/60 text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              <item.icon size={18} strokeWidth={isActive ? 2.5 : 1.5} className={isActive ? "text-gray-900" : "text-gray-500"} />
              {item.name}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
