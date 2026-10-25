# Progress

## Current status

Phase: **2 (core engine and first vertical slice) complete** on branch `feat/phase-2-engine` (stacked on phase 1 `6faa61e` and phase 0 `d3f7e44`). Nothing is pushed. Next: phase 3 (telemetry: synthetic records and waveform panels).

## What works

- Project rules (`AGENTS.md`, `CLAUDE.md`) and the Memory Bank.
- App shell for desktop, tablet and phone; status bar with the live simulation clock and scenario status; TR/EN; dark/light.
- Map: MapLibre 6 with OpenFreeMap basemap, Terrarium 3D terrain and hillshade; draped reference layers (districts, EFSM20 faults, 81 stations).
- Data pipeline and data layer (phase 1) plus the elevation grid (Copernicus GLO-90) and the ASB14 test fixture.
- Engine (`src/engine/`, pure TypeScript): IASP91 travel times, finite-fault rupture with W&C94 scaling, ASB14 Rjb ground motion, Worden 2012 intensity, scenario orchestrator with per-district arrivals; about 0.3 s per preset.
- Simulation worker (Comlink), scenario and playback stores, four Main Marmara Fault presets.
- First vertical slice: choose a preset, compute in the worker, play back. MMI raster draped on the terrain appears as the S wave arrives; P and S wavefronts as 3D curtains; rupture front and epicentre; legend and "Simulation" watermark; timeline (play/pause, slider, 0.5×–10×, Space and arrow shortcuts); scenario summary; district arrival table (impact tab).
- Tooling: Vitest 113 tests (engine against OpenQuake, analytic and published references), Playwright 24 e2e tests across four profiles including a scenario run and axe scans with a scenario loaded, pipeline 48 tests, CI with app, pipeline and e2e jobs.
- Verified 2026-10-25: typecheck, lint, format, unit/integration, e2e, pipeline gates, build; screenshots of a running scenario on desktop and phone.

## Phases

Each phase ends with CI green and a deployable `main`.

- [x] **0. Skeleton** — Vite + React + TS strict, Tailwind tokens and fonts, i18n, responsive shell, MapLibre + deck.gl + 3D terrain, lint/format/test tooling with the `tests/` layout, CI, Worker proxy, CORS spike.
  - [ ] First deploy to Cloudflare (needs the user's account: `npx wrangler login`, then `npm run deploy`, or connect the repo in the dashboard).
- [x] **1. Data pipeline** — `pipeline/` modules, `public/data/` with manifest and attribution, typed loaders, reference layers on the map.
  - [ ] `cells` dataset (needs `OPENCELLID_API_KEY` in `pipeline/.env`; needed by phase 6, synthetic fallback otherwise).
- [x] **2. Core engine and first vertical slice** — velocity, rupture, gmpe, intensity, sim; worker; playback and scenario stores; wavefronts, intensity raster, timeline, presets, district arrivals.
- [ ] **3. Telemetry** — `random` module and scenario seed, stochastic records per station scaled to the GMPE median, uPlot panels synced to the clock, STA/LTA picks, stations flashing on trigger.
- [ ] **4. EEW** — detection, alert, district countdowns, blind zone.
- [ ] **5. Damage and critical infrastructure.**
- [ ] **6. Cell tower load, routing and corridors, heatmaps.**
- [ ] **7. Tsunami.**
- [ ] **8. Aftershocks (ETAS) and multi-scale timeline.**
- [ ] **9. Live mode and historical replay** with real feeds and seismograms.
- [ ] **10. Scenario editor and URL sharing; event log and PDF/GeoJSON/CSV export.**
- [ ] **11. Polish** — phone tuning, performance, accessibility audit, About and methodology page, README with screenshots and attribution, scientific validation results published.

## Known issues and follow-ups

- Playwright MCP cannot launch: it expects Google Chrome, which is not installed. The user chose to leave it (2026-10-25); visual checks use Playwright screenshots via script.
- `npm audit`: 4 advisories in `undici` pulled in by `wrangler`/`miniflare` (local dev tooling only, not shipped). Revisit when Wrangler updates its dependency.
- Phone: the opening view shows much of the Black Sea, and the map legend is large; tune in phase 11.
- Dark basemap: water and land contrast is low; with the intensity raster the map now reads well, revisit in phase 11.
- MapLibre has no API to start compact attribution collapsed; on narrow maps the `maplibregl-compact-show` class is removed after load (`map-view.tsx`).
- Building counts outside İstanbul are estimates (see `dataSources.md`); the UI must show this when damage results are displayed (phase 5).
- Wavefronts are cut where they leave the engine grid (for example north of 41.8° N).
- Median-only ground motion; aleatory variability arrives with phase 3.
- The IDE's pyright language server may show stale "import could not be resolved" diagnostics until it restarts; the CLI run is authoritative.

## Evolution of decisions

- 2026-10-25: Python backend replaced by a browser-only engine plus an edge proxy, after the user required a free, zero-install deployment without Docker.
- 2026-10-25: Unit tests moved from beside source files to a separate `tests/` tree.
- 2026-10-25: Cloudflare Pages Functions replaced by Workers static assets + `@cloudflare/vite-plugin`.
- 2026-10-25: TypeScript pinned to 6.0.x until typescript-eslint supports 7.
- 2026-10-25: vaul dropped; own `BottomSheet` and Radix `Sheet` instead.
- 2026-10-25: Data sources settled during phase 1: EFSM20, WorldPop R2025A, USGS Vs30 grid, İBB 2017 buildings plus estimation, OSM via Geofabrik, EMODnet WCS.
- 2026-10-25: Reference layers moved from deck.gl to MapLibre native layers because deck.gl does not drape on MapLibre terrain.
- 2026-10-25: Phase 2 models: IASP91, W&C94, ASB14, Worden 2012 (verifiable coefficients); Leonard 2014 and Bilal & Askan 2014 deferred.
- 2026-10-25: Intensity raster through a MapLibre image source updated with ImageData; canvas sources stay stale under terrain.
- 2026-10-25: `random` and `Scenario.seed` deferred to phase 3, where they are first used.
