import type { Theme } from '@/state/ui-store';

interface ReferencePalette {
  fault: string;
  districtLine: string;
  station: string;
  stationHalo: string;
  /** The station hue as RGB, for the deck.gl ring around the focused station. */
  selection: [number, number, number];
}

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
  },
  light: {
    fault: 'rgba(184, 64, 44, 0.9)',
    districtLine: 'rgba(30, 41, 59, 0.28)',
    station: 'rgb(37, 99, 200)',
    stationHalo: 'rgba(255, 255, 255, 0.9)',
    selection: [37, 99, 200],
  },
};
