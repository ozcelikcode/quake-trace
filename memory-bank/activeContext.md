# Active Context

## Current focus

v2 plan in `roadmap.md` (phases 12–17), written 2026-10-27 after user feedback on the public deploy: rectangle-clipped footprint, Marmara-only map, 1–2 minute load and hot phones, unverified intensity/tsunami display, generic design. Phases 12 and 13 are done; phase 14 is in progress on `feat/phase-14-world` (from the phase 12–13 branch): 14.1–14.8 done except 14.7b (editor anywhere, open); next is phase 15. Phases 0–11 are in `main` and deployed at https://quake-trace.ozcelikcode.workers.dev.

## Recent changes (2026-10-27, phase 14)

- 14.8: pipeline `turkeyExposure` (`datasets/turkey_exposure.py`, grid `turkey-2km`), `engine/exposure/population-exposure.ts`, `SimulationResult.exposure`, `ExposureSummary` in the impact panel.

- 14.7a: `recordingSites` adds virtual stations outside the network; `planStations` skips stations with no arrival; `focusScenario` also runs when the renderer starts with a result (shared links).

- 14.6: `feedUrl` (USGS world M ≥ 4.5; EMSC, AFAD and Kandilli for Türkiye), `liveStore.scope` with `inScope` (Marmara / Türkiye / World), `worldFaultSource` and the world catalogue in `scenarioFromEvent` (regional faults win; world copies of regional ids are skipped); the smoke test asks AFAD for the Türkiye box.

- 14.4–14.5: pipeline `worldFaults` (`datasets/world_faults.py`), `worldFaultsSchema`, map layer `quaketrace-world-fault-lines` under the regional faults. Opening view is Türkiye (pitch 20; phones flat); `applyProjection` switches globe and Mercator at zoom 3.5; `focusScenario` flies to each new result; GEM credited in the map attribution.

- 14.3: `inRegion` on the result; impact panel "outside the detailed model" state; `tsunamiStore.clear()` when the shaking does not reach Marmara.

- 14.2: pipeline `vs30World` (`datasets/vs30_world.py`) writes gzipped 0.05° uint8 tiles; `data/vs30-tiles.ts` decodes them and `DataRepository.vs30Tiles(bounds)` caches them; the simulation worker plans the event grid (`planEventGrid`), fetches the covering tiles and passes them as `siteGrids` (Vs30 lookup: regional grid, tiles, then 760 m/s). Paths ending in `.gz` are fetched as they are.

- 14.1: event-centred shaking grid (`engine/grid/event-grid.ts`, see `simulationModels.md`); `SimulationResult.grid` is the event grid and `regionGrid` the regional one (network raster); the renderer keeps one image source per raster grid and samples elevation by lon/lat; stations take Vs30 by lon/lat with the 760 m/s default; `MAX_BOUNDS` replaced by `MIN_ZOOM` 1; phones send `maxEventCells` 100k.

## Changes (2026-10-27, phase 13)

- 13.7: telemetry, impact and events panels lazy (`app/panels.ts`, Suspense in the tab layouts), About dialog lazy in `features/about/index.ts` and mounted only while open, report mounted only with a result.

- 13.6: tsunami runs are scheduled (`useTsunamiStore.schedule`, status `pending`) and start at the end of the shaking playback (`useTsunamiTrigger` in the app shell), on the Tsunami scale button (opens the scale when ready, `openWhenReady`) or when the tsunami summary mounts.

- 13.4–13.5: `SimulationRenderer` throttles the raster upload and isolines to 15 Hz (trailing update), stops repainting a settled raster, caches static positions and draws at most 30 frames a second on compact maps (constructor option `compact`). The clock and the timeline select formatted or slider-rounded time instead of raw `timeS`; telemetry canvases repaint at most 20 times a second, at a pixel ratio of at most 2, with the box size from the resize observer. Before and after numbers are in `roadmap.md` 13.4. Measuring script pattern: Playwright + CDP `Performance.getMetrics` (`TaskDuration`) over a 10 s playback window against `vite preview`, with `Emulation.setCPUThrottlingRate` 4 for the phone viewport.

- 13.3: 3D terrain is on by default only on screens wider than 640 px with at least six logical cores (`terrainByDefault` in `ui-store`, persisted); MapLibre's `TerrainControl` switches it and the `terrain` event stores the choice (ignored during a style swap). DEM `maxzoom` 12, map `pixelRatio` capped at 2 (1.5 on compact maps), compact view pitch 0, elevation grid fetched only with terrain on.

- 13.2: `public/_headers` (hashed assets immutable for a year, data one day, manifest `no-cache`); the build emits `data/<file>.gz` for every manifest dataset (`compressData` in `vite.config.ts`) and production fetches `<file>.gz?v=<sha256>` and inflates it with `DecompressionStream` (Cloudflare does not compress octet-stream; roads 5.9 → 3.1 MB, infra 0.8 → 0.13 MB). The smoke workflow prints and checks the headers.

- 13.1: the page opens with only the manifest, faults, districts and stations. `useRunScenario` fetches the simulation inputs on the first run (`queryClient.query` with the shared query options in `data/use-dataset.ts`), the tsunami fetches the bathymetry itself, `SharedScenario` mounts its runner only when the address bar holds a request, and the map, event log and facility layer load roads, elevation and infra once a result exists. e2e asserts that the first load does not request them.

## Changes (2026-10-27, phase 12)

- `memory-bank/roadmap.md`: v2 phases 12–17 with root causes, decisions and acceptance criteria.
- `AGENTS.md` is agent-neutral (task pick-up, command table, reporting rules); Claude Code tools moved to `CLAUDE.md`; stale facts fixed.

## Changes (2026-10-26, review after phase 11)

- Observed records: `fetchObservedRecords` reads the station metadata first and requests waveforms only from the nearest 24 stations operating at the origin time, among all accelerometers within 200 km (before: the 12 nearest stations of today, none of which recorded 2019; now 2019 shows 6 stations, 2025 shows 22).
- Catalog events farther than 15 km (`ON_FAULT_KM`) from every mapped trace rupture at the epicentre on a straight trace with the nearest fault's strike, dip, rake and depths (`placement: 'epicentre'`); before, they were moved onto the nearest fault however far it was. Summary row "Rupture placement".
- The status-bar alert chip ends with the shaking (`eewPhase(…, shakingEndS)`); it no longer shows a red alert hours later on the response scale.
- The tsunami integration test's timeout now covers its 10 s budget (it was cut at the default 5 s).
- Exports used only in their own file are no longer exported (knip scan); no unused files or dependencies.
- First CI runs on `main` (merged by fast-forward): `astral-sh/setup-uv` pinned to `v10.3.2` (no floating `v10` tag); wall-clock budgets checked off CI only; scenario e2e flows on desktop only in CI (no GPU on runners).

## Changes (2026-10-26, phase 11)

- Validation: `tests/fixtures/validation/observed-pga.json` (KOERI KO HN? records of 2019 and 2025, geometric-mean horizontal PGA, procedure in its README) and `tests/integration/engine/ground-motion-validation.test.ts`: mean ln(observed/model) +0.10 (2019, 12 stations) and +0.09 (2025, 43 stations), scatter about 0.5; criterion ±0.3 met.
- App: feature `about` (`AboutDialog`: overview with the disclaimer, methods with sources and the validation result, data sources from the manifest plus live services, keyboard shortcuts; `?` opens it at the shortcuts); `components/ui/dialog.tsx` (full screen on phones); `useManifest`; `ui-store.about`. Status bar: About button (desktop/tablet), brand mark opens About on phones, scenario source in the status ("Simulation · Historical · Mw 6.2"), phone header without the divider and with tighter gaps (fits 360 px with the alert chip; an About button there had pushed the page to 415 px and hidden the sheet tabs). Phone opening view frames the northern Marmara coast (`COMPACT_VIEW`), narrower phone legend. Tsunami log line says the height is the coast's highest.
- README rewritten (features, science, validation table) with screenshots in `docs/screenshots/`.
- Tests: About dialog e2e (axe included), 360 px no-overflow e2e.

## Changes (2026-10-26, phase 10)

- Data: `data/fault-source.ts` (moved from the scenario presets; shared with the map).
- App: scenario tab Editor (`scenario-editor.tsx`: fault, Mw up to the EFSM20 p95 maximum, hypocentre along the trace, depth in the seismogenic layer, seed; `lib/custom-scenario.ts` with `normalizeDraft`); `state/editor-store.ts`; map preview and click-to-place (`map/lib/editor-layers.ts`, wide transparent hit line over the faults). Share links: `lib/run-request.ts` encodes every run as readable query parameters (zod on decode), `publishRequest` writes it with `history.replaceState`, `SharedScenario` in the app shell runs a link once data loads (`scenario.error` now `'compute' | 'link'`), `ShareLinkButton` copies the URL.
- Events: `lib/event-log.ts` (milestones from the result and tsunami), `entry-text.ts`, panel with the log revealed by the clock (newest first, click to `playbackStore.reveal`), exports `district-export.ts` (CSV RFC 4180 + BOM, GeoJSON with `simulation: true`), `ScenarioReport` always in the page while a scenario is loaded and shown only in print (`window.print()` / Cmd+P save as PDF). Dark tokens scoped to `@media screen`, so print is light.
- `roundSignificant` moved to `lib/format.ts`; `lib/download.ts`; cells/routing indexes export `summarizeNetwork` / `responseStats`; replay index exports `HISTORICAL_EVENTS`.
- Tests: `_helpers/a11y.ts` and `pauseAndJump` / `openEventsPanel` in `_helpers/layout.ts`; `editor-events.spec.ts`.

## Changes (2026-10-26, phase 9)

- Data: `lib/formats/miniseed.ts` (SEED 2.4, Steim1/2, verified against ObsPy), `lib/formats/station-xml.ts`, `data/feeds/` (parsers for USGS, EMSC, AFAD, Kandilli; merge; requests; KOERI observed records in cm/s²). Fixtures in `tests/fixtures/feeds/`.
- Engine: `RuptureSpec.startKm/endKm` optional (W&C94 extent centred on the hypocentre); `lib/math/polyline.nearestOnPath`.
- App: scenario panel tabs; features `replay` (three USGS-verified events) and `live` (polling, list, simulate from M 4); `state/live-store`, `state/observed-store`; scenario store keeps the scenario origin; telemetry shows observed records; live map layer; map `styleReadyRef` fix (updates were dropped while tiles loaded).
- Tests: e2e helpers moved to `tests/e2e/_helpers/layout.ts`; tsunami/aftershock flows fixed to pause with focus off the scale control.

## Changes (2026-10-26, phase 8)

- Engine: `aftershocks` (`reasenberg-jones.ts` rate, closed-form counts, Omori and Gutenberg–Richter samplers; `catalog.ts` 72-hour M ≥ 3 catalog along the rupture, Poisson count, hourly 24-hour M ≥ 5/6 probabilities); `SimulationResult.aftershocks`; `types/aftershocks.ts`.
- App: Response timeline scale (72 h), largest-aftershock marker, h:mm:ss clock (and a rounding fix: 59.96 s no longer reads 00:60.0), aftershock map layer, feature `aftershocks` (impact summary), `--aftershock` token; phone timeline without the duplicate clock.

## Changes (2026-10-26, phase 7)

- Git: the working copy was found on `main` again at the start; phase 7 was branched from phase 6 (nothing lost).
- Engine: `tsunami` — `okada.ts` (Okada 1985 uz, GeoClaw port, Table 2 tests), `source.ts` (rectangles from the ruptured trace, D = M0/μA, seafloor uplift), `shallow-water.ts` (linear C-grid, forward-backward, open edges), `tsunami.ts` (one hour, 15 s frames on the 1 km grid, coastal summaries). `types/tsunami.ts`.
- App: `workers/tsunami.worker.ts` + client, `state/tsunami-store.ts`, playback store with `TIMELINE_SCALES` (Shaking / Tsunami), timeline scale control and tsunami marker, map tsunami raster and legend option, feature `tsunami` (impact summary), `--tsunami` tokens.

## Changes (2026-10-26, phase 6)

- Git: phase 3–5 branches pushed with upstream after the user signed in with `gh` (`gh auth setup-git`).
- Engine: `grid` (DEGURBA settlement classes, point index), `network` (synthetic sites at ITU-R M.2135 spacing, raster service areas, DOCOMO/Bagrow call demand, host-building loss), `routing` (Dijkstra, KTY speeds, Hazus HWB28 bridges, debris slowdown, district response times, corridors). `districtDamage` also returns the per-cell loss ratio; `SimulationResult.network` and `.routing`; facility kinds and thresholds moved to `types/damage.ts`; `RoadGraph` type moved to `types/roads.ts`.
- App: features `cells` (site state, network summary) and `routing` (response summary, district row text); map network raster selectable in the legend, corridor / impaired-road / site layers with `TimedReveal`; `--load` tokens; `useCellSites`; `formatCompact`, `formatPercent` (fixes `%` placement in English).

## Changes (2026-10-26, phase 5)

- Pipeline: `vulnerability` dataset (GEM v2026.0.0, CC BY-NC-SA 4.0), fixtures: ASB14 SA(0.6) column and the İBB 2019 district totals.
- Engine: ASB14 SA(0.6); `damage/` (OpenQuake-style interpolation, expectation over σ, building classes, district damage, facilities); `SimulationResult.damage`; shared `types/damage.ts`.
- App: `features/infra` (facility status rule, summary), impact panel damage summary and district damage line, map facility layer with feature states, `criticalFacilityKinds` in `data/schemas.ts`.

## Changes (2026-10-26, phase 4)

- Engine: `eew/locate` (grid search, origin time as mean residual), `eew/early-warning` (Pd from the rupture grown in 3 s via W&C94, Wu & Zhao 2006 forward and inverse, alert = 4th trigger + 3 s). `SimulationResult.earlyWarning`.
- App: `features/eew` (status chip with live region, summary), impact panel warning column, map blind-zone curtain and estimated epicentre, timeline markers.

## Changes (2026-10-26, phase 3)

- Engine: `random` (mulberry32, Box–Muller, FNV-1a sub-streams), `synth` (Boore 2003 stochastic method with Campbell 2003 WNA parameters verified in pyrvt v0.8.1, SMSIM exponential window, P phase with Boore & Boatwright 1984 radiation and Madariaga 1976 corner ratio), `eew/sta-lta` (Trnkoczy 2012 parameters, ObsPy window semantics), `sim/arrivals` (shared arrival model for cells and stations), `sim/stations`. `lib/math/fft` and `lib/math/grid` added. `Scenario.seed` added; presets use seed 1.
- App: telemetry store (`state/telemetry-store.ts`, focused station + resolver shared with the map), telemetry panel (focused station, record-section list), canvas frame hook, map trigger layers and station click.
- Git: the user's tooling switched the working copy to `main` twice and committed WIP as `4cf6f5f` "quake-trace" on the phase 3 branch; work continued on top of it. Check the branch before every session.

## Earlier changes (2026-10-25)

- Pipeline: EFSM20 fault-type codes fixed (`RL`, `LL`, `N`, `R`; unknown codes now fail the build), elevation grid from Copernicus GLO-90, `fixtures` command writing the OpenQuake ASB14 verification table.
- Engine: velocity (IASP91), rupture (finite fault, W&C94, hypocentre as the first subfault), gmpe (ASB14 Rjb), intensity (Worden 2012 + ShakeMap extension), sim (orchestrator, per-district impacts). All coefficients verified against OpenQuake, USGS esi-shakelib and ObsPy sources.
- App: simulation worker (Comlink), scenario and playback stores, presets on the Main Marmara Fault, scenario panel, timeline controls and keyboard shortcuts, map renderer (image-source raster + deck.gl curtains), legend, watermark, status clock and scenario status, impact table; tablet drawer closes when a scenario starts.
- ESLint engine boundary rewritten as a regex (gitignore-style negations could not re-allow `@/lib/math`).

## Next steps

1. Roadmap phase 15 (intensity and tsunami correctness), then 16 (design) and 17; 14.7b stays open. Branch `feat/phase-14-world` holds phases 12–14 (not merged or deployed yet). Deploy phase 13 when the user asks (`npm run deploy`, then `gh workflow run smoke.yml`).
2. After each deploy: `gh workflow run smoke.yml` (the developer's network cannot reach `*.workers.dev`).
3. Optional: OpenCelliD key in `pipeline/.env`, then `build cells`; the engine uses real sites unchanged.

## Active decisions and considerations

- Theme: dark is the current default; v2 (roadmap 16.1) switches to the system preference with a cream light theme.
- Coverage (v2): world shaking simulation and live events, Türkiye exposure, full modules only in Marmara; modules outside their data show "no data for this region".
- Documentation and code in English; user-facing text in TR and EN catalogs; conversation with the user in Turkish.
- Every progress report to the user ends with a phase status block.
- Static map context uses MapLibre native layers; dynamic rasters use an image source; dynamic 3D geometry uses deck.gl lifted with the elevation grid.
- Scientific coefficients are only taken from verifiable sources and recorded in `simulationModels.md`.
- Presets are defined by longitude ranges on EFSM20 `TRCF045`.

## Learnings and preferences

- The user wants disciplined, senior-level work: strict structure, current high-quality libraries, professional minimal design that is not barren.
- The user requires everything to be free and runnable as-is; no Docker or paid services.
- Tests must live in a separate folder; every folder must follow a clear order.
- The Memory Bank is the user's top priority for project continuity.
- The user wants the phase status reported in every update and delegates technical choices ("hangisi öneriliyorsa").
- Library checks pay off: typescript-eslint did not support TS 7, jsx-a11y did not support ESLint 10, react-refresh 0.5 exports a named `reactRefresh`, vaul ignores `modal={false}`, MapLibre's container CSS overrides `position: absolute`, pyosmium needs nodes read for the location cache, deck.gl does not drape on MapLibre terrain, and MapLibre canvas sources stay stale under terrain.
- Binary thresholds on expected values create artefacts at network scale (debris closures isolated whole cities); prefer continuous effects, and check the regional result before keeping a rule.
- A model that saturates (call demand) makes a flat map; show a quantity with spatial contrast (blocked calls per km²).
- Real data needs defensive handling: AFAD needs a browser user agent, İBB CSVs mix UTF-8 and Windows-1254, the 2017 İBB data still calls Eyüpsultan "Eyüp", WorldPop uses a negative nodata value, OSM has `beds=0`, and EFSM20 uses `RL`/`LL` codes.
