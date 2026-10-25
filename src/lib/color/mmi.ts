/**
 * USGS ShakeMap intensity color scale, anchored at integer MMI and interpolated linearly in
 * between. Kept close to the standard so intensity maps are recognizable (designSystem.md).
 */
export type Rgb = readonly [number, number, number];

export const MMI_ANCHORS: readonly Rgb[] = [
  [255, 255, 255], // I
  [191, 204, 255], // II
  [160, 230, 255], // III
  [128, 255, 255], // IV
  [122, 255, 147], // V
  [255, 255, 0], // VI
  [255, 200, 0], // VII
  [255, 145, 0], // VIII
  [255, 0, 0], // IX
  [200, 0, 0], // X
];

export function mmiColor(mmi: number): Rgb {
  const position = Math.min(9, Math.max(0, mmi - 1));
  const lower = Math.floor(position);
  const upper = Math.min(9, lower + 1);
  const t = position - lower;
  const a = MMI_ANCHORS[lower] ?? [255, 255, 255];
  const b = MMI_ANCHORS[upper] ?? a;
  return [
    Math.round(a[0] + t * (b[0] - a[0])),
    Math.round(a[1] + t * (b[1] - a[1])),
    Math.round(a[2] + t * (b[2] - a[2])),
  ];
}

export function mmiCss(mmi: number): string {
  const [r, g, b] = mmiColor(mmi);
  return `rgb(${String(r)} ${String(g)} ${String(b)})`;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** Intensity as the conventional Roman numeral, rounded to the nearest level. */
export function mmiRoman(mmi: number): string {
  return ROMAN[Math.min(9, Math.max(0, Math.round(mmi) - 1))] ?? 'I';
}
