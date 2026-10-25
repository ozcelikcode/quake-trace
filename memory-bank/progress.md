# Progress

## Current status

Phase: **1 (data pipeline) complete except the cell-site dataset**, which needs the user's free OpenCelliD API key. Work is on branch `feat/phase-1-data-pipeline` (stacked on `feat/phase-0-skeleton`, committed as `d3f7e44`). Nothing is pushed. Next: phase 2 (core engine and first vertical slice).

## What works

- Project rules (`AGENTS.md`, `CLAUDE.md`) and the Memory Bank.
- App shell for three layouts: desktop (side panels), tablet (side sheets), phone (non-modal bottom sheet with snap heights). Status bar with simulation clock placeholder, language toggle (TR/EN, persisted) and theme toggle (dark/light, persisted, applied before first paint).
- Token-only design system in Tailwind v4; IBM Plex Sans/Mono self-hosted.
- MapLibre 6 map with OpenFreeMap basemap per theme, AWS Terrarium 3D terrain and hillshade, deck.gl `MapLibreOverlay` attached (no layers yet), lazy-loaded.
- Reference layers on the map, draped on the terrain: district outlines, EFSM20 faults (width by slip rate), 81 seismic stations (triangles; accelerometer stations brighter). Credits in the map attribution.
- Cloudflare Worker proxy for AFAD, Kandilli and KOERI FDSN with an allowlist, cache headers and gateway error mapping. It runs in `npm run dev` and `npm run preview`.
- Data pipeline (`pipeline/`, uv, Python 3.13): faults, districts, districtCells, population, districtStats, vs30, stations, bathymetry, infra, roads; cells ready but skipped without a key. Outputs in `public/data/` (about 9.5 MB) with `manifest.json` (sizes, SHA-256, sources, licenses) and a generated `ATTRIBUTION.md`.
- Data layer (`src/data/`): zod schemas for the manifest and every dataset, `DataRepository` with typed loaders, binary decoders (grids, CSR road graph, cell sites), TanStack Query hooks.
- Tooling: strict TypeScript project references, ESLint with layer-boundary rules, Prettier, Vitest (47 tests), Playwright (20 e2e tests across desktop, tablet and two phone profiles, axe WCAG scans in both themes), pipeline ruff + pyright strict + pytest (43 tests), GitHub Actions CI with app, pipeline and e2e jobs.
- Verified 2026-10-25: all of the above green; e2e green twice in a row; screenshots reviewed at 1440×900 (both themes), 1024×768 and Pixel 7.

## Phases

Each phase ends with CI green and a deployable `main`.

- [x] **0. Skeleton** — Vite + React + TS strict, Tailwind tokens and fonts, i18n, responsive shell, MapLibre + deck.gl + 3D terrain, lint/format/test tooling with the `tests/` layout, CI, Worker proxy, CORS spike.
  - [ ] First deploy to Cloudflare (needs the user's account: `npx wrangler login`, then `npm run deploy`, or connect the repo in the dashboard).
- [x] **1. Data pipeline** — `pipeline/` modules, `public/data/` with manifest and attribution, typed loaders, reference layers on the map.
  - [ ] `cells` dataset (needs `OPENCELLID_API_KEY` in `pipeline/.env`, then `uv run quaketrace-pipeline build cells`).
- [ ] **2. Core engine and first vertical slice** — velocity, rupture, gmpe, intensity, random, sim; playback store; wavefronts, intensity raster, districts, timeline. Includes a spike on drawing dynamic layers over the 3D terrain and naming the Marmara fault segments for presets.
  - Done when: a preset scenario computes in under 2 s and plays back with correct P/S fronts; engine reference tests pass.
- [ ] **3. Telemetry** — synthetic records, uPlot panels synced to the clock, STA/LTA picks.
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
- `npm audit`: 4 advisories in `undici` pulled in by `wrangler`/`miniflare` (local dev tooling only, not shipped). The suggested fix is a downgrade; revisit when Wrangler updates its dependency.
- Phone opening view: the narrow width gives a low zoom and the pitched camera shows a lot of the Black Sea. Consider a lower pitch or tighter bounds on phones (phase 11).
- Dark basemap: water and land contrast is very low. Tune it once data layers exist (phase 2), keeping data dominant.
- MapLibre has no API to start compact attribution collapsed; on narrow maps the `maplibregl-compact-show` class is removed after load (`map-view.tsx`).
- Building counts outside İstanbul are estimates (see `dataSources.md`); the UI must show this when damage results are displayed (phase 5).
- EFSM20 segments have no names; Marmara presets need a documented id → name mapping (phase 2).
- The IDE's pyright language server may show stale "import could not be resolved" diagnostics until it restarts and picks up `pyrightconfig.json`; the CLI run is authoritative.

## Evolution of decisions

- 2026-10-25: Python backend replaced by a browser-only engine plus an edge proxy, after the user required a free, zero-install deployment without Docker.
- 2026-10-25: Unit tests moved from beside source files to a separate `tests/` tree.
- 2026-10-25: Cloudflare Pages Functions replaced by Workers static assets + `@cloudflare/vite-plugin`.
- 2026-10-25: TypeScript pinned to 6.0.x until typescript-eslint supports 7.
- 2026-10-25: vaul dropped; own `BottomSheet` and Radix `Sheet` instead.
- 2026-10-25: Data sources settled during phase 1: EFSM20, WorldPop R2025A, USGS Vs30 grid, İBB 2017 buildings plus estimation, OSM via Geofabrik, EMODnet WCS.
- 2026-10-25: Reference layers moved from deck.gl to MapLibre native layers because deck.gl does not drape on MapLibre terrain.
