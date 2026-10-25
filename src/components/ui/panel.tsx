import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

export function Panel({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      data-slot="panel"
      className={cn('flex min-h-0 flex-col bg-surface-1', className)}
      {...props}
    />
  );
}

export function PanelHeader({ className, ...props }: ComponentProps<'header'>) {
  return (
    <header
      data-slot="panel-header"
      className={cn(
        'flex h-10 shrink-0 items-center justify-between gap-2 border-b border-line px-3',
        className,
      )}
      {...props}
    />
  );
}

export function PanelTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('text-body font-semibold text-fg', className)} {...props} />;
}

export function PanelBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto', className)} {...props} />;
}
