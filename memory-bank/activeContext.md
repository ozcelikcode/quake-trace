# Active Context

## Current focus

Phase 8 (aftershocks and the response timeline) is complete on branch `feat/phase-8-aftershocks` (from phase 7). Next is phase 9: live mode and historical replay.

## Recent changes (2026-10-26, phase 8)

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

1. Phase 9: live earthquake feeds (USGS, EMSC, AFAD and Kandilli through the proxy), real seismograms (FDSN via seisplotjs), historical replays (1999 Gölcük, 2019 and 2025 Silivri; verify parameters with AFAD/KOERI first).
2. Optional: OpenCelliD key in `pipeline/.env`, then `build cells`; the engine uses real sites unchanged.
3. User (optional): review, push/PR on request; deploy to Cloudflare when ready.

## Active decisions and considerations

- Dark theme is the default; light theme is supported through tokens.
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
