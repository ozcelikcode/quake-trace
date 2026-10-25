import { binAt, type Envelope } from './envelope';

/**
 * Canvas painters for waveform traces on a 0…duration time axis. Coordinates are device pixels;
 * each device column is one vertical stroke over the envelope bins it covers.
 */

export interface TraceView {
  width: number;
  height: number;
  durationS: number;
  timeS: number;
  /** Amplitude that reaches the top and bottom edges. */
  scale: number;
}

export function timeToX(view: TraceView, timeS: number): number {
  return (timeS / view.durationS) * view.width;
}

/** The record from t = 0 up to the playback time; nothing after it is drawn. */
export function paintEnvelope(
  ctx: CanvasRenderingContext2D,
  envelope: Envelope,
  view: TraceView,
  color: string,
): void {
  const endS = Math.min(view.timeS, view.durationS);
  const last = binAt(envelope, endS);
  if (last < 0 || view.scale <= 0) return;
  const middle = view.height / 2;
  const gain = (view.height / 2 - 1) / view.scale;
  const binsPerColumn = view.durationS / view.width / envelope.binS;
  const columns = Math.min(view.width, Math.ceil(timeToX(view, endS)));

  ctx.beginPath();
  let previousMiddle = middle;
  for (let column = 0; column < columns; column++) {
    const first = Math.floor(column * binsPerColumn);
    if (first > last) break;
    const end = Math.min(last, Math.max(first, Math.ceil((column + 1) * binsPerColumn) - 1));
    let low = Number.POSITIVE_INFINITY;
    let high = Number.NEGATIVE_INFINITY;
    for (let bin = first; bin <= end; bin++) {
      low = Math.min(low, envelope.min[bin] ?? 0);
      high = Math.max(high, envelope.max[bin] ?? 0);
    }
    // Bridge to the previous column so steep segments stay connected.
    const top = Math.min(middle - high * gain, previousMiddle);
    const bottom = Math.max(middle - low * gain, previousMiddle);
    ctx.moveTo(column + 0.5, top);
    ctx.lineTo(column + 0.5, Math.max(bottom, top + 1));
    previousMiddle = middle - ((high + low) / 2) * gain;
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = color;
  ctx.stroke();
}

/** A full-height tick at `markerS`, once the playback time has reached it. */
export function paintMarker(
  ctx: CanvasRenderingContext2D,
  view: TraceView,
  markerS: number | null,
  color: string,
  lineWidth: number,
): void {
  if (markerS === null || markerS > view.timeS) return;
  const x = Math.round(timeToX(view, markerS)) + 0.5;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, view.height);
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = color;
  ctx.stroke();
}

export function paintBaseline(
  ctx: CanvasRenderingContext2D,
  view: TraceView,
  color: string,
  lineWidth: number,
): void {
  const y = Math.round(view.height / 2) + 0.5;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(view.width, y);
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = color;
  ctx.stroke();
}
