import type { Theme } from '@/state/ui-store';

interface ReferencePalette {
  fault: string;
  districtLine: string;
  station: string;
  stationHalo: string;
  /** The station hue as RGB, for the deck.gl ring around the focused station. */
  selection: [number, number, number];
  /** Facility states, tuned against --state-ok, --state-warning and --state-critical. */
  facility: { operational: string; limited: string; outOfService: string; outline: string };
  /** Response routes: a line in the primary text hue over a casing in the surface hue. */
  corridor: { line: string; casing: string };
  /** Impaired roads, tuned against --state-warning and --state-critical. */
  debris: string;
  bridgeClosed: string;
}

/**
 * The load scale (--load-0 … --load-4 in src/styles/tokens.css), identical in both themes, as
 * RGB anchors for the network raster.
 */
/** The diverging sea-surface scale (--tsunami-neg, --tsunami-pos), identical in both themes. */
export const TSUNAMI_NEG: readonly [number, number, number] = [64, 148, 255];
export const TSUNAMI_POS: readonly [number, number, number] = [255, 92, 76];

export const LOAD_ANCHORS: readonly (readonly [number, number, number])[] = [
  [72, 52, 150],
  [136, 62, 176],
  [200, 74, 160],
  [242, 116, 110],
  [255, 196, 112],
];

/**
 * Map paint colors are concrete values tuned against the surface tokens in src/styles/tokens.css
 * (MapLibre paint properties cannot read CSS variables). Faults use a muted brick red so the
 * critical state color stays reserved for alerts; stations use the signal hue.
 */
export const REFERENCE_PALETTE: Record<Theme, ReferencePalette> = {
  dark: {
    fault: 'rgba(232, 116, 92, 0.9)',
    districtLine: 'rgba(226, 232, 240, 0.22)',
    station: 'rgb(138, 180, 248)',
    stationHalo: 'rgba(13, 17, 23, 0.85)',
    selection: [138, 180, 248],
    facility: {
      operational: 'rgb(98, 196, 128)',
      limited: 'rgb(232, 190, 90)',
      outOfService: 'rgb(235, 87, 70)',
      outline: 'rgba(13, 17, 23, 0.9)',
    },
    corridor: { line: 'rgb(240, 244, 250)', casing: 'rgba(13, 17, 23, 0.85)' },
    debris: 'rgb(232, 190, 90)',
    bridgeClosed: 'rgb(235, 87, 70)',
  },
  light: {
    fault: 'rgba(184, 64, 44, 0.9)',
    districtLine: 'rgba(30, 41, 59, 0.28)',
    station: 'rgb(37, 99, 200)',
    stationHalo: 'rgba(255, 255, 255, 0.9)',
    selection: [37, 99, 200],
    facility: {
      operational: 'rgb(30, 140, 70)',
      limited: 'rgb(190, 130, 20)',
      outOfService: 'rgb(200, 50, 40)',
      outline: 'rgba(255, 255, 255, 0.95)',
    },
    corridor: { line: 'rgb(22, 30, 46)', casing: 'rgba(255, 255, 255, 0.9)' },
    debris: 'rgb(190, 130, 20)',
    bridgeClosed: 'rgb(200, 50, 40)',
  },
};
