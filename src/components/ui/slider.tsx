import { Slider as SliderPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/** Single-thumb slider on a hairline track. The accessible name goes on the thumb (role="slider"). */
export function Slider({
  className,
  'aria-label': label,
  ...props
}: ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(
        'relative flex h-6 w-full touch-none items-center select-none data-[disabled]:opacity-40',
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1 grow overflow-hidden rounded-full bg-surface-3">
        <SliderPrimitive.Range className="absolute h-full bg-signal" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={label}
        className="block size-3.5 rounded-full border-2 border-signal bg-surface-1 shadow-float transition-transform duration-150 hover:scale-110 pointer-coarse:size-5"
      />
    </SliderPrimitive.Root>
  );
}
