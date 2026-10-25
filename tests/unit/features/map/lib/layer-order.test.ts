import type { LayerSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';

import { overlayAnchorLayerId } from '@/features/map/lib/layer-order';

const fill = (id: string): LayerSpecification => ({ id, type: 'fill', source: 's' });
const line = (id: string): LayerSpecification => ({ id, type: 'line', source: 's' });
const symbol = (id: string): LayerSpecification => ({ id, type: 'symbol', source: 's' });

describe('overlay anchor', () => {
  it('skips early labels and anchors before the first label after the roads', () => {
    const layers = [
      fill('water'),
      symbol('water_name'),
      line('road'),
      line('boundary'),
      symbol('place_city'),
      symbol('poi'),
    ];
    expect(overlayAnchorLayerId(layers)).toBe('place_city');
  });

  it('ignores quakeTrace line layers when finding the basemap roads', () => {
    const layers = [line('road'), symbol('place'), line('quaketrace-fault-lines')];
    expect(overlayAnchorLayerId(layers)).toBe('place');
  });

  it('returns undefined for a style without labels', () => {
    expect(overlayAnchorLayerId([line('road')])).toBeUndefined();
  });
});
