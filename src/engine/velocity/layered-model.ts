export type Wave = 'P' | 'S';

/** A flat layer from `topKm` down to the next layer's top; the last layer is a half-space. */
export interface VelocityLayer {
  topKm: number;
  vpKmS: number;
  vsKmS: number;
}

/**
 * Crust and uppermost mantle of the IASP91 reference model (Kennett and Engdahl, 1991,
 * Geophys. J. Int. 105:429-465): upper crust 0–20 km, lower crust 20–35 km, mantle below.
 * A regional Marmara model can replace it without changing the travel-time code.
 */
export const IASP91_CRUST: readonly VelocityLayer[] = [
  { topKm: 0, vpKmS: 5.8, vsKmS: 3.36 },
  { topKm: 20, vpKmS: 6.5, vsKmS: 3.75 },
  { topKm: 35, vpKmS: 8.04, vsKmS: 4.47 },
];

export function velocity(layer: VelocityLayer, wave: Wave): number {
  return wave === 'P' ? layer.vpKmS : layer.vsKmS;
}

/** Index of the layer containing `depthKm` (a depth on an interface belongs to the layer below). */
export function layerIndexAt(model: readonly VelocityLayer[], depthKm: number): number {
  let index = 0;
  for (let i = 1; i < model.length; i++) {
    if ((model[i]?.topKm ?? Number.POSITIVE_INFINITY) <= depthKm) index = i;
  }
  return index;
}
