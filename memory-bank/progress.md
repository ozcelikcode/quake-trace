# Progress

## Current status

Phase: **7 (tsunami) complete** on branch `feat/phase-7-tsunami` (from phase 6, `00f82e3`). Phase 3–6 branches are pushed to GitHub with upstream. `main` is at phase 2 (`5aec3bf`). Next: phase 8 (aftershocks and the response timeline).

## What works

- Project rules (`AGENTS.md`, `CLAUDE.md`) and the Memory Bank.
- App shell for desktop, tablet and phone; status bar with the live simulation clock and scenario status; TR/EN; dark/light.
- Map: MapLibre 6 with OpenFreeMap basemap, Terrarium 3D terrain and hillshade; draped reference layers (districts, EFSM20 faults, 81 stations).
- Data pipeline and data layer (phase 1) plus the elevation grid (Copernicus GLO-90) and the ASB14 test fixture.
- Engine (`src/engine/`, pure TypeScript): IASP91 travel times, finite-fault rupture with W&C94 scaling, ASB14 Rjb ground motion, Worden 2012 intensity, scenario orchestrator with per-district arrivals; about 0.3 s per preset.
- Simulation worker (Comlink), scenario and playback stores, four Main Marmara Fault presets.
- Telemetry (phase 3): synthetic three-component accelerograms (100 Hz) at the 50 accelerometer stations, scaled to the ASB14 median; STA/LTA triggers; focused station with Z/N/E traces, picks, playhead and peak-so-far readouts; record-section station list in trigger order; stations flash on the map when they trigger; clicking a station on the map focuses it. Scenario compute about 0.5–0.9 s per preset in Node.
- Damage (phase 5): expected structural loss and night fatalities per district (GEM 2025 Türkiye vulnerability, averaged over ground-motion σ), revealed as the S wave arrives; damage summary and per-district line in the impact panel; 1,388 critical facilities assessed and coloured on the map when reached. North Marmara: ≈ 100,000 complete-loss-equivalent buildings, ≈ 6,400 fatalities (İstanbul ≈ 6,000; İBB 2019: 14,145).
- Tsunami (phase 7): Okada seafloor motion of the rupture propagated for an hour with linear shallow water on the 500 m bathymetry in its own worker (about 3 s); Shaking / Tsunami timeline scales; sea-surface raster in the legend's shading control; impact summary with slip, seafloor motion, first arrival, highest coastal wave and coastal districts as they are reached. North Marmara: first coast after 0.5 min (Adalar), highest 1.8 m (Marmaraereğlisi).
- Cell network and emergency response (phase 6): about 32,750 synthetic cell sites (no OpenCelliD key), call demand up to 55× the busy hour for those who felt the shaking, site and resident counts by state and calls not carried in the impact panel; network raster (calls not carried per km²) selectable in the legend; sites shown from zoom 11. Fire response times before/after per district (KTY speeds, Hazus bridge closures, debris-slowed streets), hospital access after, response corridors weighted by lost buildings drawn as the S wave reaches each district. North Marmara: median fire response 5.8 → 5.9 min, 2,650 km of streets slowed, no bridge closed. Whole scenario about 0.5 s in Node.
- Early warning (phase 4): location by grid search on the first four triggers (1–2 km error on the presets), Pd magnitude with modelled saturation (first estimates M 6.2–6.5 for Mw 6.9–7.4), alert at T+6–11 s; status-bar alert chip (live region), EEW summary and per-district warning time / countdown / blind zone in the impact panel, blind-zone boundary and estimated epicentre on the map, detection and alert markers on the timeline.
- First vertical slice: choose a preset, compute in the worker, play back. MMI raster draped on the terrain appears as the S wave arrives; P and S wavefronts as 3D curtains; rupture front and epicentre; legend and "Simulation" watermark; timeline (play/pause, slider, 0.5×–10×, Space and arrow shortcuts); scenario summary; district arrival table (impact tab).
- Tooling (phase 7): Vitest 243 tests, Playwright 39 passed / 17 skipped, pipeline 53 tests.
- Tooling (phase 6): Vitest 222 tests, Playwright 36 passed / 16 skipped, pipeline 53 tests.
- Tooling (earlier): Vitest 174 tests (engine against OpenQuake, analytic and published references), Playwright 33 e2e tests across four profiles including scenario, telemetry, early-warning and damage flows and axe scans with a scenario loaded, pipeline 48 tests, CI with app, pipeline and e2e jobs.
- Verified 2026-10-26: typecheck, lint, format, unit/integration, e2e, build; telemetry screenshots on desktop and phone, dark and light.

## Phases

Each phase ends with CI green and a deployable `main`.

- [x] **0. Skeleton** — Vite + React + TS strict, Tailwind tokens and fonts, i18n, responsive shell, MapLibre + deck.gl + 3D terrain, lint/format/test tooling with the `tests/` layout, CI, Worker proxy, CORS spike.
  - [ ] First deploy to Cloudflare (needs the user's account: `npx wrangler login`, then `npm run deploy`, or connect the repo in the dashboard).
- [x] **1. Data pipeline** — `pipeline/` modules, `public/data/` with manifest and attribution, typed loaders, reference layers on the map.
  - [ ] `cells` dataset (needs `OPENCELLID_API_KEY` in `pipeline/.env`; needed by phase 6, synthetic fallback otherwise).
- [x] **2. Core engine and first vertical slice** — velocity, rupture, gmpe, intensity, sim; worker; playback and scenario stores; wavefronts, intensity raster, timeline, presets, district arrivals.
- [x] **3. Telemetry** — `random` module and scenario seed, stochastic records per station scaled to the GMPE median, canvas waveform panels synced to the clock, STA/LTA picks, stations flashing on trigger.
- [x] **4. EEW** — detection, location, Pd magnitude, alert, district countdowns, blind zone, timeline markers.
- [x] **5. Damage and critical infrastructure** — GEM vulnerability, district losses and fatalities, facility states, İBB 2019 validation.
- [x] **6. Cell tower load, routing and corridors, heatmaps** — synthetic sites (OpenCelliD optional), call-demand load, damage-aware routing, corridors, network raster.
- [x] **7. Tsunami** — Okada source, linear shallow-water solver in a worker, coastal arrivals, tsunami raster, Shaking / Tsunami timeline scales.
- [ ] **8. Aftershocks (ETAS) and multi-scale timeline** (Shaking / Tsunami scales already built in phase 7; Response 72 h remains).
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
- Median-only ground motion and records: map and telemetry stay consistent; aleatory variability (ASB14 σ, τ) is not sampled yet (candidate for the scenario editor, phase 10).
- Damage: GEM data is CC BY-NC-SA 4.0 (non-commercial); time of day fixed at night (residents at home); facility state thresholds are assumptions; underestimates İBB 2019 fatalities by about 2.4× (different magnitude/rupture, median-centred stock assumptions).
- EEW: no telemetry or processing latency; depth fixed at 10 km; event log entries arrive with phase 10.
- Synthetic records are point-source shapes (Boore 2003) with finite-fault arrival times; P shares the S-wave attenuation (simplification). Compute time on phones (2–3× slower than desktop) is not yet measured.
- Tsunami: linear and non-dispersive, no run-up (depth floored at 10 m), no landslide sources, instantaneous uplift; heights are near-coast offshore values. Coastal arrivals are not labelled on the map yet. The 15 MB of frames stay in memory per scenario.
- Network: power cuts and battery autonomy are not modelled, so no site goes down in the presets (DOCOMO lost most sites to power cuts in 2011); demand ignores time of day; the surge decays over hours, beyond the current scenario timeline (multi-scale timeline in phase 8).
- Routing: debris slowdown is an assumption; OSM bridge types unknown (Hazus HWB28 for all); no traffic, no ferries (Adalar shows as cut off by road); the road graph is copied to the worker on each run.
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
- 2026-10-26: uPlot not adopted; waveforms use one canvas painter over min/max envelopes (list and focus views, no per-frame data copies).
- 2026-10-26: Damage from GEM 2025 vulnerability functions (verifiable, Türkiye) rather than HAZUS fragility; expected values over ASB14 σ.
- 2026-10-26: EEW Pd modelled from the rupture grown in 3 s (Wu & Zhao 2006 + seeded scatter), not measured from the point-source records, which radiate the full moment at once and gave M 8–9 estimates.
- 2026-10-26: Phone status bar shows the brand mark only, so the clock and alert fit.
- 2026-10-26: Synthetic records scaled to the median (not sampled with σ) to keep map and telemetry consistent.
- 2026-10-26: Phase 7: tsunami arrival measured from the initial surface; Shaking / Tsunami timeline scales pulled forward from phase 8.
- 2026-10-26: Phase 6: synthetic cell sites (no key); debris closures replaced by slowdown; network raster shows calls not carried per km² rather than saturated demand; phone legend moved to the top of the map.
