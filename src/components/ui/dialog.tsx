import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

import { Button } from './button';

/** Modal dialog: centred on wide screens, full screen on phones. */
export function Dialog(props: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />;
}

interface DialogContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  closeLabel: string;
}

export function DialogContent({ className, children, closeLabel, ...props }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-surface-0/70 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'fixed inset-0 z-50 flex flex-col bg-surface-1 duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(44rem,calc(100dvh-4rem))] sm:w-[min(48rem,calc(100vw-4rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-panel sm:border sm:border-line sm:shadow-float',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={closeLabel}
            className="absolute top-2 right-2"
          >
            <X />
          </Button>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('text-title font-semibold text-fg', className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-caption text-fg-muted', className)}
      {...props}
    />
  );
}
