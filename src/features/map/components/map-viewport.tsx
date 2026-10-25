import { lazy, Suspense } from 'react';

// MapLibre and deck.gl are the largest dependencies; loading them lazily lets the shell paint first.
const MapView = lazy(() => import('./map-view').then((module) => ({ default: module.MapView })));

export function MapViewport() {
  return (
    <Suspense fallback={<div aria-hidden className="graticule absolute inset-0 bg-surface-0" />}>
      <MapView />
    </Suspense>
  );
}
