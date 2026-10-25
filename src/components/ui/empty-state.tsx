import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

/** Structured placeholder: a faint graticule behind an icon tile, never a blank area. */
export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'graticule flex h-full min-h-48 flex-col items-center justify-center gap-3 px-6 py-10 text-center',
        className,
      )}
    >
      <div className="grid size-11 place-items-center rounded-panel border border-line bg-surface-2 text-fg-muted">
        <Icon aria-hidden className="size-5" strokeWidth={1.5} />
      </div>
      <div className="max-w-64 space-y-1">
        <p className="text-body font-medium text-fg">{title}</p>
        <p className="text-caption text-fg-muted">{description}</p>
      </div>
    </div>
  );
}
