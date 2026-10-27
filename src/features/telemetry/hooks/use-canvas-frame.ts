import { useEffect, useEffectEvent, useRef } from 'react';

import { usePlaybackStore } from '@/state/playback-store';

const CLOCK_REPAINT_MS = 50;
/** Traces are 1–2 px lines; more than two device pixels per CSS pixel adds nothing visible. */
const MAX_PIXEL_RATIO = 2;

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
 * repaints happen outside React, at most 20 times a second (a trailing repaint draws the final
 * time). Canvases scrolled out of view skip painting until they return.
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
    // The box size comes from the resize observer: reading clientWidth on every repaint would
    // force a layout per canvas per frame.
    let boxWidth = canvas.clientWidth;
    let boxHeight = canvas.clientHeight;
    let paintedAtMs = Number.NEGATIVE_INFINITY;
    let trailing: ReturnType<typeof setTimeout> | undefined;

    const repaint = () => {
      clearTimeout(trailing);
      if (!visible) return;
      paintedAtMs = performance.now();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      const width = Math.round(boxWidth * pixelRatio);
      const height = Math.round(boxHeight * pixelRatio);
      if (width === 0 || height === 0) return;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.clearRect(0, 0, width, height);
      onPaint({ ctx, width, height, pixelRatio, timeS: usePlaybackStore.getState().timeS, style });
    };
    repaintRef.current = repaint;

    const resize = new ResizeObserver(([entry]) => {
      if (entry) {
        boxWidth = entry.contentRect.width;
        boxHeight = entry.contentRect.height;
      }
      repaint();
    });
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
      if (state.timeS === previous.timeS || !visible) return;
      const waitMs = paintedAtMs + CLOCK_REPAINT_MS - performance.now();
      clearTimeout(trailing);
      if (waitMs <= 0) repaint();
      else trailing = setTimeout(repaint, waitMs);
    });

    return () => {
      clearTimeout(trailing);
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
