import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/** Segmented control. */
export function ToggleGroup({
  className,
  ...props
}: ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-control border border-line bg-surface-2 p-0.5',
        className,
      )}
      {...props}
    />
  );
}

export function ToggleGroupItem({
  className,
  ...props
}: ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        'inline-flex h-6 min-w-8 items-center justify-center rounded-control px-2 text-caption font-medium text-fg-muted transition-colors duration-150 hover:text-fg data-[state=on]:bg-surface-3 data-[state=on]:text-fg pointer-coarse:h-9 pointer-coarse:min-w-10',
        className,
      )}
      {...props}
    />
  );
}
