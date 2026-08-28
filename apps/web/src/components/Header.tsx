import { Bell, ShieldPlus } from 'lucide-react';
import { useHealthStore } from '../store/useHealthStore';
import { format } from 'date-fns';

export function Header() {
  const { alerts } = useHealthStore();
  const unreadCount = alerts.filter(a => a.status === 'active').length;

  return (
    <header className="bg-transparent h-[120px] px-8 flex items-end pb-6 justify-between shrink-0">
      <div className="flex flex-col">
        <h1 className="text-4xl font-bold text-gray-900 leading-tight tracking-tight">Good morning, Aman.</h1>
        <p className="text-[16px] text-gray-600 font-medium mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      <div className="flex items-center gap-5">
        <button className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors">
          <Bell className="w-6 h-6" strokeWidth={1.5} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-2 w-2 h-2 bg-emerald-500 rounded-full border-2 border-[#F9FAFB]"></span>
          )}
        </button>
        
        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 border border-gray-200">
          <img src="https://ui-avatars.com/api/?name=Aman+Singh&background=random" alt="User" className="w-full h-full object-cover" />
        </div>
        
        <div className="flex items-center gap-2 bg-[#F3F4F6] px-3 py-1.5 rounded-[12px] border border-gray-200/50">
          <ShieldPlus className="w-4 h-4 text-[#A89873] fill-[#EAE5D9]" />
          <div className="flex flex-col">
            <span className="text-[12px] font-bold text-gray-800 leading-none">HealthGuard</span>
            <span className="text-[10px] font-semibold text-gray-500 leading-none mt-1">Premium</span>
          </div>
        </div>
      </div>
    </header>
  );
}
