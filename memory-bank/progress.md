# Progress

## Current status

Phase: **11 (polish) complete** on branch `feat/phase-11-polish` (from phase 10, `a6de0ee`). Phase 3–10 branches are pushed to GitHub with upstream. `main` is at phase 2 (`5aec3bf`). All planned phases are done; merging and deploying are the user's next steps.

## What works

- Project rules (`AGENTS.md`, `CLAUDE.md`) and the Memory Bank.
- App shell for desktop, tablet and phone; status bar with the live simulation clock and scenario status; TR/EN; dark/light.
- Map: MapLibre 6 with OpenFreeMap basemap, Terrarium 3D terrain and hillshade; draped reference layers (districts, EFSM20 faults, 81 stations).
- Data pipeline and data layer (phase 1) plus the elevation grid (Copernicus GLO-90) and the ASB14 test fixture.
- Engine (`src/engine/`, pure TypeScript): IASP91 travel times, finite-fault rupture with W&C94 scaling, ASB14 Rjb ground motion, Worden 2012 intensity, scenario orchestrator with per-district arrivals; about 0.3 s per preset.
- Simulation worker (Comlink), scenario and playback stores, four Main Marmara Fault presets.
- Telemetry (phase 3): synthetic three-component accelerograms (100 Hz) at the 50 accelerometer stations, scaled to the ASB14 median; STA/LTA triggers; focused station with Z/N/E traces, picks, playhead and peak-so-far readouts; record-section station list in trigger order; stations flash on the map when they trigger; clicking a station on the map focuses it. Scenario compute about 0.5–0.9 s per preset in Node.
- Damage (phase 5): expected structural loss and night fatalities per district (GEM 2025 Türkiye vulnerability, averaged over ground-motion σ), revealed as the S wave arrives; damage summary and per-district line in the impact panel; 1,388 critical facilities assessed and coloured on the map when reached. North Marmara: ≈ 100,000 complete-loss-equivalent buildings, ≈ 6,400 fatalities (İstanbul ≈ 6,000; İBB 2019: 14,145).
- Polish (phase 11): About dialog (overview and disclaimer, methods with sources, validation, data sources from the manifest, shortcuts, `?`); status bar names the scenario source; phone opening view on the northern Marmara coast and phone header fitting 360 px; README with features, science, validation and screenshots. Scientific validation: modelled median PGA vs KOERI observations, mean ln residual +0.10 (2019, 12 stations) and +0.09 (2025, 43 stations), within the ±0.3 success criterion.
- Editor, sharing and exports (phase 10): scenario editor on any of the 27 EFSM20 faults (Mw 5 to the fault's p95 maximum, hypocentre by slider or by clicking a fault on the map, depth, seed) with a map preview; every run is in the address bar as readable query parameters (`?preset=`, `?replay=`, `?fault=&mw=&hypo=&depth=&seed=`, `?event=…`), validated with zod and run on load, with a copy-link button; event log of the scenario (rupture, detection, alert, S wave per province, strongest shaking, facilities out, bridges, network congestion, tsunami, M ≥ 5 aftershocks) revealed with the clock, each entry seeks there; exports: district CSV and GeoJSON, printable report (PDF via the print dialog, light, three A4 pages for the presets).
- Live mode and replay (phase 9): live list of the last 7 days from AFAD, Kandilli, EMSC and USGS (merged, refreshed every minute, catalog status shown) with map markers; any event from M 4 can be simulated on the nearest fault. Historical replays of 1999 Kocaeli, 2019 Silivri and 2025 Marmara Ereğlisi with USGS parameters; observed KOERI strong-motion records replace synthetic ones in telemetry where available (2025: 10 stations).
- Aftershocks (phase 8): 72-hour synthetic M ≥ 3 sequence (Reasenberg–Jones generic California) appearing on the map at their times, sized by magnitude; impact summary with count, largest so far and the model's 24-hour M ≥ 5/6 probabilities; Response timeline scale with hour steps and a largest-aftershock marker. North Marmara: 714 aftershocks by 24 h, largest M 6.8 after 6 h.
- Tsunami (phase 7): Okada seafloor motion of the rupture propagated for an hour with linear shallow water on the 500 m bathymetry in its own worker (about 3 s); Shaking / Tsunami timeline scales; sea-surface raster in the legend's shading control; impact summary with slip, seafloor motion, first arrival, highest coastal wave and coastal districts as they are reached. North Marmara: first coast after 0.5 min (Adalar), highest 1.8 m (Marmaraereğlisi).
- Cell network and emergency response (phase 6): about 32,750 synthetic cell sites (no OpenCelliD key), call demand up to 55× the busy hour for those who felt the shaking, site and resident counts by state and calls not carried in the impact panel; network raster (calls not carried per km²) selectable in the legend; sites shown from zoom 11. Fire response times before/after per district (KTY speeds, Hazus bridge closures, debris-slowed streets), hospital access after, response corridors weighted by lost buildings drawn as the S wave reaches each district. North Marmara: median fire response 5.8 → 5.9 min, 2,650 km of streets slowed, no bridge closed. Whole scenario about 0.5 s in Node.
- Early warning (phase 4): location by grid search on the first four triggers (1–2 km error on the presets), Pd magnitude with modelled saturation (first estimates M 6.2–6.5 for Mw 6.9–7.4), alert at T+6–11 s; status-bar alert chip (live region), EEW summary and per-district warning time / countdown / blind zone in the impact panel, blind-zone boundary and estimated epicentre on the map, detection and alert markers on the timeline.
- First vertical slice: choose a preset, compute in the worker, play back. MMI raster draped on the terrain appears as the S wave arrives; P and S wavefronts as 3D curtains; rupture front and epicentre; legend and "Simulation" watermark; timeline (play/pause, slider, 0.5×–10×, Space and arrow shortcuts); scenario summary; district arrival table (impact tab).
- Tooling (phase 11): Vitest 299 tests, Playwright 60 passed / 32 skipped (one network blip rerun), pipeline 53 tests.
- Tooling (phase 10): Vitest 297 tests (3 timing budgets fail on this machine in macOS Low Power Mode, also on the phase 9 commit), Playwright 57 passed / 27 skipped, pipeline 53 tests (unchanged).
- Tooling (phase 9): Vitest 283 tests, Playwright 48 passed / 20 skipped, pipeline 53 tests.
- Tooling (phase 8): Vitest 258 tests, Playwright 42 passed / 18 skipped, pipeline 53 tests.
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
- [x] **8. Aftershocks and multi-scale timeline** — Reasenberg–Jones sequence (instead of ETAS), aftershock layer and summary, Shaking / Tsunami / Response scales.
- [x] **9. Live mode and historical replay** — four catalogs merged and polled, replays with USGS parameters, observed KOERI records in telemetry.
- [x] **10. Scenario editor and URL sharing; event log and PDF/GeoJSON/CSV export.**
- [x] **11. Polish** — phone tuning, About and methodology dialog, README with screenshots and attribution, scientific validation results published (accessibility: axe in every e2e flow; performance: measured, splitting deferred).

## Known issues and follow-ups

- Playwright MCP cannot launch: it expects Google Chrome, which is not installed. The user chose to leave it (2026-10-25); visual checks use Playwright screenshots via script.
- `npm audit`: 4 advisories in `undici` pulled in by `wrangler`/`miniflare` (local dev tooling only, not shipped). Revisit when Wrangler updates its dependency.
- Dark basemap: water and land contrast is low; with the intensity raster the map reads well.
- MapLibre has no API to start compact attribution collapsed; on narrow maps the `maplibregl-compact-show` class is removed after load (`map-view.tsx`).
- Building counts outside İstanbul are estimates (see `dataSources.md`); the impact panel marks those districts "(estimated stock)".
- Wavefronts are cut where they leave the engine grid (for example north of 41.8° N).
- Median-only ground motion and records: map and telemetry stay consistent; aleatory variability (ASB14 σ, τ) is not sampled, so no uncertainty bands are shown.
- Damage: GEM data is CC BY-NC-SA 4.0 (non-commercial); time of day fixed at night (residents at home); facility state thresholds are assumptions; underestimates İBB 2019 fatalities by about 2.4× (different magnitude/rupture, median-centred stock assumptions).
- EEW: no telemetry or processing latency; depth fixed at 10 km.
- Editor and exports: no rupture-extent control (W&C94 from the magnitude); time of day stays night; the share link does not carry the playback moment; the report has no map image. The 2 s preset budget in the integration tests can fail on slow machines (macOS Low Power Mode); CI runners have not run it yet.
- Synthetic records are point-source shapes (Boore 2003) with finite-fault arrival times; P shares the S-wave attenuation (simplification). Compute time on phones (2–3× slower than desktop) is not yet measured.
- Live/replay: observed records only from KOERI (no AFAD TK network), converted with the flat sensitivity (no full response removal); real-time seismogram streaming for live events is not done (records are fetched only when an event is simulated, and KOERI data lag 3–10 min); events more than 15 km from every mapped fault rupture at their epicentre with the nearest fault's geometry (an assumption). Observed waveforms come from the 24 nearest stations that operated at the origin time (2019: 6 stations with data, 2025: 22).
- Aftershocks: generic California parameters, not fitted to Marmara/NAF sequences; no ETAS spatial clustering (uniform along the rupture with 5 km scatter); aftershocks do not add shaking, damage or tsunami.
- Tsunami: linear and non-dispersive, no run-up (depth floored at 10 m), no landslide sources, instantaneous uplift; heights are near-coast offshore values. Coastal arrivals are not labelled on the map yet. The 15 MB of frames stay in memory per scenario.
- Network: power cuts and battery autonomy are not modelled, so no site goes down in the presets (DOCOMO lost most sites to power cuts in 2011); demand ignores time of day; the surge decays over hours (visible on the response scale).
- Routing: debris slowdown is an assumption; OSM bridge types unknown (Hazus HWB28 for all); no traffic, no ferries (Adalar shows as cut off by road); the road graph is copied to the worker on each run.
- The IDE's pyright language server may show stale "import could not be resolved" diagnostics until it restarts; the CLI run is authoritative.

## Evolution of decisions

- 2026-10-26: Phase 11: validation in TypeScript against a recorded fixture (not the planned `pipeline/validate`), so it runs with the other tests and reuses the app's miniSEED reader; About is a dialog, not a page (no router); phones open About from the brand mark.

- 2026-10-26: Phase 10: readable query parameters instead of lz-string; PDF through the browser's print dialog instead of jsPDF (Turkish glyphs, no font embedding, no dependency); editor ruptures sized by W&C94 around the hypocentre (no extent control).

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
- 2026-10-26: Phase 9: own miniSEED/StationXML readers instead of seisplotjs; events placed on the nearest EFSM20 fault; 1912 Mürefte dropped from replays (no instrumental Mw).
- 2026-10-26: Phase 8: Reasenberg–Jones sampled directly instead of ETAS; module renamed `aftershocks`.
- 2026-10-26: Phase 7: tsunami arrival measured from the initial surface; Shaking / Tsunami timeline scales pulled forward from phase 8.
- 2026-10-26: Phase 6: synthetic cell sites (no key); debris closures replaced by slowdown; network raster shows calls not carried per km² rather than saturated demand; phone legend moved to the top of the map.
