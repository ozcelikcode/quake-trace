import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

/** A snap height in `px` or `dvh`, e.g. `112px` or `50dvh`. */
export type SheetHeight = `${number}px` | `${number}dvh`;

interface BottomSheetProps {
  label: string;
  handleLabel: string;
  snapPoints: readonly [SheetHeight, ...SheetHeight[]];
  snap: number;
  onSnapChange: (snap: number) => void;
  children: ReactNode;
  className?: string;
}

/** Pointer travel below which a press on the handle counts as a click, not a drag. */
const CLICK_TOLERANCE_PX = 4;

function toPixels(height: SheetHeight): number {
  const value = Number.parseFloat(height);
  return height.endsWith('dvh') ? (window.innerHeight * value) / 100 : value;
}

function nearestSnap(snapPoints: readonly SheetHeight[], heightPx: number): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  snapPoints.forEach((point, index) => {
    const distance = Math.abs(toPixels(point) - heightPx);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

/**
 * Persistent, non-modal bottom panel for phones. It is part of the page (a labelled region),
 * not a dialog, so the map above it stays interactive and readable by assistive technology.
 * The handle cycles through snap heights on click and keyboard, and follows the finger on drag.
 */
export function BottomSheet({
  label,
  handleLabel,
  snapPoints,
  snap,
  onSnapChange,
  children,
  className,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const lastSnap = snapPoints.length - 1;

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startY: event.clientY,
      startHeight: sheet.getBoundingClientRect().height,
      moved: false,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = drag.startY - event.clientY;
    if (!drag.moved && Math.abs(delta) < CLICK_TOLERANCE_PX) return;
    drag.moved = true;
    const min = toPixels(snapPoints[0]);
    const max = toPixels(snapPoints[lastSnap] ?? snapPoints[0]);
    setDragHeight(Math.min(max, Math.max(min, drag.startHeight + delta)));
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag?.moved || dragHeight === null) return;
    // The click that follows a drag must not also cycle the snap point.
    suppressClickRef.current = true;
    onSnapChange(nearestSnap(snapPoints, dragHeight));
    setDragHeight(null);
  };

  // Mouse, touch and keyboard (Enter/Space) presses all arrive here.
  const onClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onSnapChange(snap >= lastSnap ? 0 : snap + 1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      onSnapChange(Math.min(lastSnap, snap + 1));
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      onSnapChange(Math.max(0, snap - 1));
    }
  };

  return (
    <section
      ref={sheetRef}
      aria-label={label}
      data-snap={snap}
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-panel border-t border-line bg-surface-1 shadow-float',
        dragHeight === null && 'transition-[height] duration-200 ease-out',
        className,
      )}
      style={{ height: dragHeight ?? snapPoints[snap] ?? snapPoints[0] }}
    >
      <button
        type="button"
        aria-label={handleLabel}
        aria-expanded={snap > 0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
        onKeyDown={onKeyDown}
        className="flex h-5 w-full shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
      >
        <span aria-hidden className="h-1 w-10 rounded-full bg-line-strong" />
      </button>
      {children}
    </section>
  );
}
