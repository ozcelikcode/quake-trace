import { useEffect, useEffectEvent, useRef } from 'react';

import { usePlaybackStore } from '@/state/playback-store';

export interface CanvasFrame {
  ctx: CanvasRenderingContext2D;
  /** Canvas size in device pixels. */
  width: number;
  height: number;
  pixelRatio: number;
  timeS: number;
  /** Live computed style of the canvas, for theme tokens and fonts. */
  style: CSSStyleDeclaration;
}

/**
 * Keeps a canvas sized to its box at the device pixel ratio and repaints it when the playback
 * clock moves, the box resizes, the theme changes or the owning component renders. Clock-driven
 * repaints happen outside React. Canvases scrolled out of view skip painting until they return.
 */
export function useCanvasFrame(paint: (frame: CanvasFrame) => void) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const repaintRef = useRef<() => void>(() => undefined);
  const onPaint = useEffectEvent(paint);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const style = getComputedStyle(canvas);
    let visible = true;

    const repaint = () => {
      if (!visible) return;
      const pixelRatio = window.devicePixelRatio || 1;
      const width = Math.round(canvas.clientWidth * pixelRatio);
      const height = Math.round(canvas.clientHeight * pixelRatio);
      if (width === 0 || height === 0) return;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.clearRect(0, 0, width, height);
      onPaint({ ctx, width, height, pixelRatio, timeS: usePlaybackStore.getState().timeS, style });
    };
    repaintRef.current = repaint;

    const resize = new ResizeObserver(repaint);
    resize.observe(canvas);
    const intersection = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      repaint();
    });
    intersection.observe(canvas);
    // Theme tokens change with <html data-theme>, which is set after the store updates.
    const theme = new MutationObserver(repaint);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const unsubscribe = usePlaybackStore.subscribe((state, previous) => {
      if (state.timeS !== previous.timeS) repaint();
    });

    return () => {
      resize.disconnect();
      intersection.disconnect();
      theme.disconnect();
      unsubscribe();
      repaintRef.current = () => undefined;
    };
  }, []);

  // Props of the owning component may have changed what is drawn.
  useEffect(() => {
    repaintRef.current();
  });

  return canvasRef;
}
