# Roadmap (v2, phases 12–17)

The working plan after the first public deploy (2026-10-26). Phases 0–11 are complete (see `progress.md`). This file is the task list any agent picks up from: take the first unchecked task of the lowest open phase, follow `AGENTS.md`, and tick the box in the same commit that finishes the task.

Each task lists **Goal**, **Files** (where the change lands, not exhaustive) and **Done when** (acceptance criteria that must be verified, not assumed).

## Why v2

Feedback from the user after the deploy (2026-10-27):

1. The shaking footprint is clipped into a rectangle as Mw grows.
2. The map covers only the Marmara region; Türkiye and the world must be included, with faults visible at every zoom.
3. The site takes 1–2 minutes to open, phones heat up and the interface stutters.
4. Intensity and tsunami displays must be checked for correctness.
5. The design looks generic; it must be professional and minimal (Vercel/Geist level of precision), with a warm cream light theme and a well-crafted dark theme.
6. Any other problem found must be fixed.

## Decisions (user, 2026-10-27)

- **Layered coverage.**
  - World: live earthquakes, active faults and ground-shaking simulation (wavefronts, PGA, MMI) anywhere.
  - Türkiye: additionally, population exposure per MMI class.
  - Marmara: every module (damage, cell network, routing, tsunami, aftershocks, telemetry with real stations).
  - Outside a module's data coverage the module shows an explicit "no data for this region" state. It never invents numbers.
- **Theme:** follows `prefers-color-scheme` by default (cream light or dark); the user can switch.

## Root causes found (2026-10-27)

**Rectangle clipping**
- The engine computes on the fixed `marmara-1km` grid: 26–31° E, 39.8–41.8° N, 500 × 200 cells. The grid spec comes from `vs30.spec` in `src/features/scenario/hooks/use-run-scenario.ts`, and `src/engine/sim/simulate.ts` loops over that grid.
- `MAX_BOUNDS` in `src/features/map/lib/map-config.ts` locks the map.
- `LIVE_REGION` in `src/data/feeds/client.ts` filters the live feeds.
- `REGION` in `pipeline/src/quaketrace_pipeline/config.py` crops the faults.

**Slow start**
- `SharedScenario` is always mounted, and its `useRunScenario` fetches 11 datasets (about 10 MB, `roads.bin` 5.9 MB) on page load.
- The preset buttons stay disabled until all of them arrive.
- There is no `public/_headers`, so assets are revalidated on every visit, and binary files are probably served uncompressed.

**Heat and jank**
- 3D terrain:
  - It is on for phones too.
  - The same DEM tiles are read through two sources.
  - `maxzoom` is 15.
  - The tiles come from S3 us-east.
- There is no `pixelRatio` cap.
- Every animation frame:
  - repaints 100k cells on the main thread and calls `updateImage`, which also invalidates the terrain drape;
  - rebuilds two isolines over the full grid;
  - recreates every deck.gl layer;
  - re-renders the clock, the timeline and the telemetry canvases at 60 Hz.
- The tsunami solver runs after every scenario (about 1,800 steps).
- The road graph is structured-cloned to the worker on every run.

**Display correctness**
- The intensity legend shows MMI II–III, but the raster is transparent below MMI 2 and only fully opaque from 4.5.
- The tsunami legend saturates at ±0.5 m, but the layer saturates at ±0.25 m.
- Legend titles do not name the model.
- The tsunami "highest wave" includes the static coseismic uplift.
- There is no Kajiura filter on the initial sea surface.

**Design**
- There is no cream theme; every neutral is cool slate (hue 250).
- There are 47 border uses.
- The stock Positron/Dark basemaps are used untinted.
- The legend uses glass (`backdrop-blur`), which `designSystem.md` forbids.
- Spacing is off the 4 px grid.

## Phase 12 — Roadmap and agent-neutral docs

- [x] **12.1 Roadmap.** This file.
- [x] **12.2 Agent-neutral rules.**
  - Goal: any coding agent can read `AGENTS.md` and work without knowing tool names it does not have.
  - Files: `AGENTS.md`, `CLAUDE.md`, `memory-bank/techContext.md`, `memory-bank/testingStrategy.md`.
  - Done when: assistant-specific tools (MCP servers, skills, shell wrappers) are named only in the assistant's own file (`CLAUDE.md`), and `AGENTS.md` has a task pick-up procedure and a command table.
- [x] **12.3 Stale facts.**
  - Files: `activeContext.md`, `progress.md`, `projectbrief.md`, `dataSources.md`.
  - Done when: deploy status, scope (layered coverage) and next steps match reality.

## Phase 13 — Performance

Budget (acceptance for the whole phase):
- On a mid-range phone over 4G, the map is interactive in under 3 s.
- Under 1.5 MB is transferred before the first interaction, excluding map tiles.
- There are no long tasks over 50 ms during playback.
- Playback runs at 60 fps on desktop and 30 fps on phones without heating the phone.

- [ ] **13.1 Lazy data.**
  - Goal: nothing heavy loads until it is needed.
  - Files: `src/features/scenario/components/shared-scenario.tsx`, `src/features/scenario/hooks/use-run-scenario.ts`, `src/data/use-dataset.ts`, `src/features/map/components/map-view.tsx`.
  - Done when:
    - `SharedScenario` does nothing without a request in `location.search`.
    - A run fetches only the inputs it needs.
    - Presets are enabled once the small inputs are ready.
    - An e2e test asserts that the first load does not request `roads.bin`, `bathymetry.f32` or `infra.geojson`.
- [ ] **13.2 Caching and compression.**
  - Files: `public/_headers` (new), `src/data/browser.ts`, `pipeline/` (grid encoding), `.github/workflows/smoke.yml`.
  - Done when:
    - `/assets/*` is served `immutable` for one year, and `/data/*` is versioned by the manifest sha256.
    - The smoke workflow prints `content-encoding` and `cache-control` for a JS chunk and a `.f32` file.
    - Binary data arrives compressed, either at the edge or as `.gz` decoded with `DecompressionStream`.
- [ ] **13.3 Map cost.**
  - Files: `src/features/map/lib/{map-config.ts,terrain.ts}`, `map-view.tsx`.
  - Done when:
    - Terrain is off on phones and devices with `hardwareConcurrency < 6` (hillshade only), and a 3D toggle exists.
    - There is one DEM source with `maxzoom` 12.
    - `pixelRatio` is capped at `min(devicePixelRatio, 2)` on desktop and 1.5 on phones.
    - Phone pitch is 0.
- [ ] **13.4 GPU playback.**
  - Goal: no per-frame CPU work proportional to the grid.
  - Files: `src/features/map/lib/{simulation-renderer.ts,simulation-frames.ts}`, a new custom deck.gl layer in `src/features/map/lib/`.
  - Done when:
    - The intensity raster and the wavefront bands are drawn by a shader from tP/tS/MMI textures uploaded once per scenario, with time as a uniform.
    - The 3D curtains rebuild at most 10 times per second from preallocated typed buffers.
    - Static layers are cached.
    - A Playwright trace of 10 s of playback shows no long task over 50 ms.
- [ ] **13.5 React updates.**
  - Files: `src/app/simulation-clock.tsx`, the timeline bar, `src/features/telemetry/hooks/use-canvas-frame.ts`.
  - Done when:
    - The clock and slider update the DOM through refs.
    - Selectors on `timeS` are rounded.
    - Telemetry canvases repaint at most 20 times per second, and only visible rows.
- [ ] **13.6 Worker scheduling.**
  - Files: `use-run-scenario.ts`, `src/workers/*.ts`, `simulation-renderer.ts`.
  - Done when:
    - The tsunami runs only when its tab or timeline scale is opened, with 1800 s on phones.
    - The road graph loads once inside the worker.
    - Response corridors are built in the worker.
- [ ] **13.7 Bundle.**
  - Files: `vite.config.ts`, `src/app/*`.
  - Done when:
    - zod, Radix and i18n have their own chunks.
    - Panels and dialogs are lazy-loaded.
    - The shell chunk shrinks, with the before and after sizes recorded in `progress.md`.

## Phase 14 — Event-centred grid and world map

- [ ] **14.1 Event grid.**
  - Goal: fix the rectangle clipping.
  - Files: `src/engine/grid/event-grid.ts` (new), `src/engine/sim/simulate.ts`, `use-run-scenario.ts`.
  - Grid:
    - Radius R(Mw): the distance where ASB14 on rock (Vs30 = 760 m/s) falls below MMI II, plus half the rupture length.
    - Cell size keeps at most 120k cells on desktop and 60k on phones.
    - Longitude spacing is scaled by cos(latitude).
    - `MAX_DISTANCE_KM` follows R.
  - Done when: in an Mw 7.8 test, every edge cell is below the display threshold, and the existing preset results stay within tolerance.
- [ ] **14.2 Vs30 everywhere.**
  - Files: `pipeline/`, `src/data/`.
  - Done when:
    - USGS global Vs30 is served as on-demand tiles: 0.01° for Türkiye, 0.05° for the world.
    - Without data, Vs30 is 760 and the UI says so.
- [ ] **14.3 Impact modules by coverage.**
  - Files: `simulate.ts`, the feature panels.
  - Done when:
    - Damage, network, routing, tsunami and telemetry map dynamic cells to the Marmara grid by lon/lat and run only inside it.
    - Elsewhere they show the "no data for this region" state.
- [ ] **14.4 Global faults.**
  - Files: `pipeline/src/quaketrace_pipeline/datasets/faults.py`, `reference-layers.ts`.
  - Done when:
    - GEM Global Active Faults (CC BY-SA 4.0) is merged with EFSM20 and served as PMTiles (`pmtiles` protocol).
    - Major faults (by slip rate) show at low zoom and detail grows with zoom.
    - Licenses are recorded in `dataSources.md`.
- [ ] **14.5 World map.**
  - Files: `map-config.ts`, `map-view.tsx`.
  - Done when:
    - There is no `MAX_BOUNDS`, `minZoom` is 1, and globe projection is used at low zoom.
    - The opening view is Türkiye (the phone view is still readable).
- [ ] **14.6 World live feeds.**
  - Files: `src/data/feeds/client.ts`, `src/features/live/`.
  - Done when:
    - `LIVE_REGION` is removed: USGS and EMSC are global (M ≥ 4.5 at world zoom), AFAD and Kandilli cover Türkiye.
    - Any event can become a scenario, falling back to `epicentreSource` when it is off-fault.
- [ ] **14.7 Editor anywhere.**
  - Done when: a click on any fault or point sets the source, and stations outside Marmara come from the FDSN station service through the proxy (virtual stations labelled "synthetic" if none).
- [ ] **14.8 Türkiye exposure.**
  - Done when: population per MMI class is shown by province and district (geoBoundaries ADM1/ADM2 + TÜİK ADNKS); no damage or fatality numbers are given outside Marmara.

## Phase 15 — Intensity and tsunami correctness

- [ ] **15.1 Legend matches layer.**
  - Files: `src/features/map/components/map-legend.tsx`, `simulation-frames.ts` (or its shader successor), a new shared constants module.
  - Done when:
    - The legend and the layer use the same ramps and thresholds, with open-ended ticks marked "≥".
    - Titles name the model: "MMI · Worden 2012", "Sea surface · linear shallow water".
- [ ] **15.2 Tsunami amplitude.**
  - Files: `src/engine/tsunami/{tsunami.ts,shallow-water.ts,source.ts}`, `tsunami-summary.tsx`.
  - Done when:
    - The peak is computed on η − η_static (the static uplift is excluded).
    - A Kajiura (1963) filter is applied to the initial condition.
    - Arrival is defined against the static offset.
    - The label reads "offshore amplitude (no run-up)".
- [ ] **15.3 Validation.**
  - Done when:
    - 1999 Kocaeli modelled MMI is within ±1 of USGS ShakeMap station values (recorded fixture, cited).
    - A Kajiura flat-bottom analytic test passes.
    - Mass conservation holds.
    - Marmara scenario amplitudes fall within published ranges (Hébert et al. 2005).
- [ ] **15.4 Methods text.** The About › Methods tab explains the PGA/PGV blend (Wald et al. 1999 weights on Worden 2012).

## Phase 16 — Design system v2

- [ ] **16.1 Direction and tokens.**
  - Files: `memory-bank/designSystem.md`, `src/styles/{tokens.css,index.css}`, `src/main.tsx`.
  - Done when:
    - Geist Sans and Geist Mono (OFL) replace IBM Plex.
    - The light theme is warm cream paper (about `oklch(0.975 0.012 85)`) with ink text; the dark theme is a warm neutral black.
    - There is one accent; physical scales (MMI, P/S, tsunami) are unchanged.
    - The theme defaults to `prefers-color-scheme`.
- [ ] **16.2 Layout.**
  - Done when:
    - The map is full-bleed and panels float, separated by space rather than borders.
    - Hairlines appear only at structural seams.
    - Spacing is on the 4 px grid.
    - There is no glass.
- [ ] **16.3 Basemap.** OpenFreeMap styles are recoloured from tokens after load (`setPaintProperty`).
- [ ] **16.4 Interaction.**
  - Done when:
    - A ⌘K command palette searches scenarios, live events and places.
    - There is one orchestrated load sequence, and `prefers-reduced-motion` is respected.
- [ ] **16.5 Screens.** Screenshots at 1440×900 and 390×844, in TR and EN and in both themes, are refreshed in `docs/screenshots/`.

## Phase 17 — Sweep and release

- [ ] **17.1 Audit.** knip, axe and Lighthouse (mobile) are run; findings are fixed or recorded in `progress.md`.
- [ ] **17.2 Release.** Merge to `main`, deploy, run `gh workflow run smoke.yml`, and update the README screenshots and live notes.
