import type { ReactNode, ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';

export function PageHeader({ title, description, icon: Icon, action, tone = 'brand' }: {
  title: string; description: string; icon?: LucideIcon | ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>; action?: ReactNode;
  tone?: 'brand' | 'critical';
}) {
  return (
    <div className="page-header">
      <div className="page-header-copy">
        {Icon && (
          <div className={`page-symbol shrink-0 flex items-center justify-center w-12 h-12 rounded-2xl shadow-xs ${
            tone === 'critical'
              ? 'bg-gradient-to-br from-rose-500/15 to-rose-500/5 border border-rose-500/20 text-rose-600'
              : 'bg-gradient-to-br from-brand/15 to-brand/5 border border-brand/20 text-brand'
          }`}>
            <Icon className="w-6 h-6" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </div>
  );
}
