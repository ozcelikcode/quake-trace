import 'maplibre-gl/dist/maplibre-gl.css';
import './map-view.css';

import { MapLibreOverlay } from '@deck.gl/maplibre';
import { Map as MapLibreMap, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { faultSource } from '@/data/fault-source';
import { useGridDataset, useRoadGraph } from '@/data/use-dataset';
import { nearestOnPath } from '@/lib/math/polyline';
import { useEditorStore } from '@/state/editor-store';
import { usePlaybackStore } from '@/state/playback-store';
import { useScenarioStore } from '@/state/scenario-store';
import { resolveFocusedStation, useTelemetryStore } from '@/state/telemetry-store';
import { useLiveStore } from '@/state/live-store';
import { useTsunamiStore } from '@/state/tsunami-store';
import { useUiStore } from '@/state/ui-store';

import { useReferenceData } from '../hooks/use-reference-data';
import {
  basemapStyleUrl,
  COMPACT_ATTRIBUTION_MAX_WIDTH,
  COMPACT_VIEW,
  DATA_ATTRIBUTION,
  INITIAL_BEARING,
  INITIAL_PITCH,
  INITIAL_VIEW_BOUNDS,
  INITIAL_VIEW_CENTER,
  MAX_BOUNDS,
  MAX_PITCH,
} from '../lib/map-config';
import { applyEditorLayers, FAULT_HIT_LAYER } from '../lib/editor-layers';
import { applyLiveLayer, LIVE_LAYER } from '../lib/live-layers';
import { applyReferenceLayers, STATION_LAYER, type ReferenceData } from '../lib/reference-layers';
import { SimulationRenderer } from '../lib/simulation-renderer';
import { applyTerrain } from '../lib/terrain';
import { MapLegend } from './map-legend';
import { SimulationWatermark } from './simulation-watermark';

setWorkerUrl(maplibreWorkerUrl);

const currentTime = () => usePlaybackStore.getState().timeS;

function applyLiveState(map: MapLibreMap): void {
  const { events, selectedId } = useLiveStore.getState();
  const { theme, scenarioTab } = useUiStore.getState();
  applyLiveLayer(map, events, selectedId, theme, scenarioTab === 'live');
}

function applyEditorState(map: MapLibreMap, reference: ReferenceData): void {
  const { theme, scenarioTab } = useUiStore.getState();
  const { draft } = useEditorStore.getState();
  applyEditorLayers(map, draft, reference.faults, theme, scenarioTab === 'editor');
}

function focusedStationIndex(): number {
  const records = useScenarioStore.getState().result?.records;
  if (!records) return -1;
  return resolveFocusedStation(records, useTelemetryStore.getState().focusedStationId);
}

/** Whether a station has a record in the current scenario, so it can open in telemetry. */
function hasRecord(id: unknown): id is string {
  const records = useScenarioStore.getState().result?.records;
  return typeof id === 'string' && Boolean(records?.stations.some((station) => station.id === id));
}

export function MapView() {
  const { t } = useTranslation();
  const theme = useUiStore((state) => state.theme);
  const reference = useReferenceData();
  // The renderer needs the terrain heights and the road graph only once a scenario has run.
  const hasResult = useScenarioStore((state) => state.result !== null);
  const elevation = useGridDataset('elevation', hasResult).data;
  const roads = useRoadGraph(hasResult).data;
  const mapRaster = useUiStore((state) => state.mapRaster);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const styleUrlRef = useRef<string | null>(null);
  /**
   * Whether the current style has loaded and accepts sources. `isStyleLoaded()` also waits for
   * every tile, which with 3D terrain is false most of the time.
   */
  const styleReadyRef = useRef(false);
  const referenceRef = useRef(reference);
  const rendererRef = useRef<SimulationRenderer | null>(null);
  const [renderer, setRenderer] = useState<SimulationRenderer | null>(null);

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
    const compact = container.clientWidth < COMPACT_VIEW.maxWidth;
    const flatCamera = compact
      ? map.cameraForBounds(COMPACT_VIEW.bounds, { padding: 16 })
      : map.cameraForBounds(INITIAL_VIEW_BOUNDS, { padding: 24 });
    map.jumpTo({
      center: compact ? (flatCamera?.center ?? INITIAL_VIEW_CENTER) : INITIAL_VIEW_CENTER,
      pitch: compact ? COMPACT_VIEW.pitch : INITIAL_PITCH,
      bearing: INITIAL_BEARING,
      ...(flatCamera?.zoom === undefined ? {} : { zoom: flatCamera.zoom }),
    });

    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    // Every style swap (theme change) drops custom sources and layers, so they are re-applied.
    map.on('style.load', () => {
      styleReadyRef.current = true;
      const currentTheme = useUiStore.getState().theme;
      applyTerrain(map, currentTheme);
      applyReferenceLayers(map, referenceRef.current, currentTheme);
      applyLiveState(map);
      applyEditorState(map, referenceRef.current);
      rendererRef.current?.attach();
      rendererRef.current?.render(currentTime());
    });
    map.on('click', LIVE_LAYER, (event) => {
      const id: unknown = event.features?.[0]?.properties.id;
      if (typeof id === 'string') useLiveStore.getState().select(id);
    });
    map.on('mousemove', LIVE_LAYER, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', LIVE_LAYER, () => {
      map.getCanvas().style.cursor = '';
    });
    // While the editor is open, a click near a fault moves the hypocentre there.
    map.on('click', FAULT_HIT_LAYER, (event) => {
      const id: unknown = event.features?.[0]?.properties.id;
      const faults = referenceRef.current.faults;
      if (typeof id !== 'string' || !faults) return;
      const { trace } = faultSource(faults, id);
      const { lng, lat } = event.lngLat;
      useEditorStore.getState().pick(id, Math.round(nearestOnPath(trace, lng, lat).km));
    });
    map.on('mousemove', FAULT_HIT_LAYER, () => {
      map.getCanvas().style.cursor = 'crosshair';
    });
    map.on('mouseleave', FAULT_HIT_LAYER, () => {
      map.getCanvas().style.cursor = '';
    });
    map.on('click', STATION_LAYER, (event) => {
      const id: unknown = event.features?.[0]?.properties.id;
      if (!hasRecord(id)) return;
      useTelemetryStore.getState().focusStation(id);
      useUiStore.getState().setRightPanel('telemetry');
      useUiStore.getState().setPhonePanel('telemetry');
    });
    map.on('mousemove', STATION_LAYER, (event) => {
      const id: unknown = event.features?.[0]?.properties.id;
      map.getCanvas().style.cursor = hasRecord(id) ? 'pointer' : '';
    });
    map.on('mouseleave', STATION_LAYER, () => {
      map.getCanvas().style.cursor = '';
    });
    void map.once('load').then(() => {
      const overlay = new MapLibreOverlay({ interleaved: true, layers: [] });
      map.addControl(overlay);
      const simulationRenderer = new SimulationRenderer(map, overlay);
      rendererRef.current = simulationRenderer;
      setRenderer(simulationRenderer);
      // MapLibre has no API to start compact attribution collapsed; the (i) button still opens it.
      if (container.clientWidth < COMPACT_ATTRIBUTION_MAX_WIDTH) {
        container
          .querySelector('.maplibregl-ctrl-attrib')
          ?.classList.remove('maplibregl-compact-show');
      }
    });

    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
      map.remove();
      mapRef.current = null;
      styleUrlRef.current = null;
      styleReadyRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const styleUrl = basemapStyleUrl(theme);
    if (!map || styleUrlRef.current === styleUrl) return;
    styleUrlRef.current = styleUrl;
    styleReadyRef.current = false;
    map.setStyle(styleUrl);
  }, [theme]);

  // Data that arrives after the style has loaded is applied here; earlier data on style load.
  useEffect(() => {
    referenceRef.current = reference;
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    applyReferenceLayers(map, reference, useUiStore.getState().theme);
    applyEditorState(map, reference);
    rendererRef.current?.resetFacilityStates();
    rendererRef.current?.render(currentTime());
  }, [reference]);

  useEffect(() => {
    if (!renderer) return;
    renderer.setElevation(elevation?.values);
    renderer.render(currentTime());
  }, [renderer, elevation]);

  useEffect(() => {
    if (!renderer) return;
    renderer.setTheme(theme);
    renderer.render(currentTime());
  }, [renderer, theme]);

  // Live catalog events and the editor preview follow their stores and show while their tab is
  // open.
  useEffect(() => {
    const refresh = () => {
      const map = mapRef.current;
      if (map && styleReadyRef.current) applyLiveState(map);
    };
    const refreshEditor = () => {
      const map = mapRef.current;
      if (map && styleReadyRef.current) applyEditorState(map, referenceRef.current);
    };
    const unsubscribeLive = useLiveStore.subscribe(refresh);
    const unsubscribeEditor = useEditorStore.subscribe(refreshEditor);
    const unsubscribeUi = useUiStore.subscribe((state, previous) => {
      if (state.scenarioTab === previous.scenarioTab) return;
      refresh();
      refreshEditor();
    });
    return () => {
      unsubscribeLive();
      unsubscribeEditor();
      unsubscribeUi();
    };
  }, []);

  useEffect(() => {
    if (!renderer) return;
    renderer.setRoads(roads);
    renderer.render(currentTime());
  }, [renderer, roads]);

  useEffect(() => {
    if (!renderer) return;
    renderer.setRaster(mapRaster);
    renderer.render(currentTime());
  }, [renderer, mapRaster]);

  // The tsunami scale shows the sea surface; leaving it returns to the intensity.
  useEffect(
    () =>
      usePlaybackStore.subscribe((state, previous) => {
        if (state.scale === previous.scale) return;
        const ui = useUiStore.getState();
        if (state.scale === 'tsunami') ui.setMapRaster('tsunami');
        else if (ui.mapRaster === 'tsunami') ui.setMapRaster('intensity');
      }),
    [],
  );

  // Frames are drawn outside React: the clock changes up to 60 times a second.
  useEffect(() => {
    if (!renderer) return;
    renderer.setResult(useScenarioStore.getState().result);
    renderer.setFocusedStation(focusedStationIndex());
    renderer.render(currentTime());
    const unsubscribeResult = useScenarioStore.subscribe((state, previous) => {
      if (state.result === previous.result) return;
      renderer.setResult(state.result);
      renderer.setFocusedStation(focusedStationIndex());
      renderer.render(currentTime());
    });
    renderer.setTsunami(useTsunamiStore.getState().result);
    const unsubscribeTsunami = useTsunamiStore.subscribe((state, previous) => {
      if (state.result === previous.result) return;
      renderer.setTsunami(state.result);
      renderer.render(currentTime());
    });
    const unsubscribeFocus = useTelemetryStore.subscribe((state, previous) => {
      if (state.focusedStationId === previous.focusedStationId) return;
      renderer.setFocusedStation(focusedStationIndex());
      renderer.render(currentTime());
    });
    const unsubscribeClock = usePlaybackStore.subscribe((state, previous) => {
      if (state.timeS !== previous.timeS) renderer.render(state.timeS);
    });
    return () => {
      unsubscribeResult();
      unsubscribeTsunami();
      unsubscribeFocus();
      unsubscribeClock();
    };
  }, [renderer]);

  // MapLibre styles its container as `position: relative`, so positioning lives on a wrapper.
  return (
    <div role="region" aria-label={t('map.label')} data-testid="map" className="absolute inset-0">
      <div ref={containerRef} className="size-full" />
      <SimulationWatermark />
      <MapLegend />
    </div>
  );
}
