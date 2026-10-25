import type { LayerSpecification } from 'maplibre-gl';

const OWN_LAYER_PREFIX = 'quaketrace-';

/**
 * The layer that quakeTrace overlays (intensity, districts, faults) are inserted before: the first
 * label after the basemap's last line layer. Data then sits above roads and boundaries but below
 * place names. Some styles put early water labels before the roads, so "first symbol" is too low.
 */
export function overlayAnchorLayerId(layers: readonly LayerSpecification[]): string | undefined {
  let lastLine = -1;
  layers.forEach((layer, index) => {
    if (layer.type === 'line' && !layer.id.startsWith(OWN_LAYER_PREFIX)) lastLine = index;
  });
  return layers.find((layer, index) => index > lastLine && layer.type === 'symbol')?.id;
}
