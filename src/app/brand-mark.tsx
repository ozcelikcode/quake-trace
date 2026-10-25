import { cn } from '@/lib/cn';

/** Seismogram trace glyph; the same path is used in public/favicon.svg. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-5', className)}
    >
      <path d="M2 12h4l1.5-3 2 7 2.5-12 2.5 15 2-9 1.5 2H22" />
    </svg>
  );
}
