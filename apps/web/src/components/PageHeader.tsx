import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function PageHeader({ title, description, icon: Icon, action }: {
  title: string; description: string; icon?: LucideIcon; action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div className="page-header-copy">
        {Icon && <span className="page-symbol"><Icon aria-hidden="true" /></span>}
        <div className="min-w-0">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </div>
  );
}
