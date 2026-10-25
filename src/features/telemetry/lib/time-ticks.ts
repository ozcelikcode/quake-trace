const STEPS_S = [5, 10, 15, 20, 30, 60, 120];

/** Tick times for a 0…duration axis, at the smallest step that keeps labels `minGapPx` apart. */
export function timeTicks(durationS: number, widthPx: number, minGapPx: number): number[] {
  if (durationS <= 0 || widthPx <= 0) return [];
  const step =
    STEPS_S.find((candidate) => (candidate / durationS) * widthPx >= minGapPx) ??
    STEPS_S[STEPS_S.length - 1] ??
    60;
  const ticks: number[] = [];
  for (let t = 0; t <= durationS + 1e-9; t += step) ticks.push(t);
  return ticks;
}
