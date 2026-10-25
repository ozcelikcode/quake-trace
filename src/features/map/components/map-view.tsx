import 'maplibre-gl/dist/maplibre-gl.css';
import './map-view.css';

import { MapLibreOverlay } from '@deck.gl/maplibre';
import { Map as MapLibreMap, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useUiStore } from '@/state/ui-store';

import { useReferenceData } from '../hooks/use-reference-data';
import {
  basemapStyleUrl,
  COMPACT_ATTRIBUTION_MAX_WIDTH,
  DATA_ATTRIBUTION,
  INITIAL_BEARING,
  INITIAL_PITCH,
  INITIAL_VIEW_BOUNDS,
  INITIAL_VIEW_CENTER,
  MAX_BOUNDS,
  MAX_PITCH,
} from '../lib/map-config';
import { applyReferenceLayers } from '../lib/reference-layers';
import { applyTerrain } from '../lib/terrain';

setWorkerUrl(maplibreWorkerUrl);

export function MapView() {
  const { t } = useTranslation();
  const theme = useUiStore((state) => state.theme);
  const reference = useReferenceData();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const styleUrlRef = useRef<string | null>(null);
  const referenceRef = useRef(reference);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const styleUrl = basemapStyleUrl(useUiStore.getState().theme);
    const map = new MapLibreMap({
      container,
      style: styleUrl,
      center: INITIAL_VIEW_CENTER,
      maxBounds: MAX_BOUNDS,
      maxPitch: MAX_PITCH,
      attributionControl: { compact: true, customAttribution: DATA_ATTRIBUTION },
    });
    styleUrlRef.current = styleUrl;
    mapRef.current = map;

    // Fitting bounds with pitch shifts the center towards the horizon, so the zoom is taken
    // from a flat fit and the pitch is applied around the region's center.
    const flatCamera = map.cameraForBounds(INITIAL_VIEW_BOUNDS, { padding: 24 });
    map.jumpTo({
      center: INITIAL_VIEW_CENTER,
      pitch: INITIAL_PITCH,
      bearing: INITIAL_BEARING,
      ...(flatCamera?.zoom === undefined ? {} : { zoom: flatCamera.zoom }),
    });

    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    // Every style swap (theme change) drops custom sources and layers, so they are re-applied.
    map.on('style.load', () => {
      const currentTheme = useUiStore.getState().theme;
      applyTerrain(map, currentTheme);
      applyReferenceLayers(map, referenceRef.current, currentTheme);
    });
    void map.once('load').then(() => {
      map.addControl(new MapLibreOverlay({ interleaved: true, layers: [] }));
      // MapLibre has no API to start compact attribution collapsed; the (i) button still opens it.
      if (container.clientWidth < COMPACT_ATTRIBUTION_MAX_WIDTH) {
        container
          .querySelector('.maplibregl-ctrl-attrib')
          ?.classList.remove('maplibregl-compact-show');
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      styleUrlRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const styleUrl = basemapStyleUrl(theme);
    if (!map || styleUrlRef.current === styleUrl) return;
    styleUrlRef.current = styleUrl;
    map.setStyle(styleUrl);
  }, [theme]);

  // Data that arrives after the style has loaded is applied here; earlier data on style load.
  useEffect(() => {
    referenceRef.current = reference;
    const map = mapRef.current;
    if (map?.isStyleLoaded()) applyReferenceLayers(map, reference, useUiStore.getState().theme);
  }, [reference]);

  // MapLibre styles its container as `position: relative`, so positioning lives on a wrapper.
  return (
    <div role="region" aria-label={t('map.label')} data-testid="map" className="absolute inset-0">
      <div ref={containerRef} className="size-full" />
    </div>
  );
}
