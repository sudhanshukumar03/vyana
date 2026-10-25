import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function EmptyState({ title, description, icon: Icon, action }: {
  title: string; description: string; icon: LucideIcon; action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state-symbol"><Icon aria-hidden="true" /></span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
