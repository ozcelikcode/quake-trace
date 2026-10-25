import { useCanvasFrame } from '../hooks/use-canvas-frame';
import { timeTicks } from '../lib/time-ticks';

const MIN_LABEL_GAP_PX = 36;
const TICK_PX = 3;

/** Seconds after origin under the focused traces, on the same 0…duration scale. */
export function TimeAxis({ durationS }: { durationS: number }) {
  const canvasRef = useCanvasFrame(({ ctx, width, height, pixelRatio, style }) => {
    const ticks = timeTicks(durationS, width / pixelRatio, MIN_LABEL_GAP_PX);
    ctx.fillStyle = style.getPropertyValue('--text-muted').trim();
    ctx.font = `${String(parseFloat(style.fontSize) * pixelRatio)}px ${style.fontFamily}`;
    ctx.textBaseline = 'bottom';
    ticks.forEach((timeS, index) => {
      const x = Math.round((timeS / durationS) * width);
      ctx.fillRect(Math.min(x, width - pixelRatio), 0, pixelRatio, TICK_PX * pixelRatio);
      const label = index === ticks.length - 1 ? `${String(timeS)} s` : String(timeS);
      ctx.textAlign = index === 0 ? 'left' : x > width - 24 * pixelRatio ? 'right' : 'center';
      ctx.fillText(label, x, height);
    });
  });

  return <canvas ref={canvasRef} aria-hidden className="h-4 w-full font-mono text-micro" />;
}
