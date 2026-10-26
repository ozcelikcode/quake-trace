# Active Context

## Current focus

Phase 4 (EEW) is complete on branch `feat/phase-4-eew`: the first four STA/LTA triggers locate the event, a Pd magnitude with realistic saturation follows, and the alert drives the status bar, district countdowns, blind zone and timeline markers. Next is phase 5, damage and critical infrastructure.

## Recent changes (2026-10-26, phase 4)

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

1. Phase 5: building damage (HAZUS-style fragility on the district building stock), casualties by time of day, critical infrastructure status; validate against the İBB 2019 scenario.
2. Cell sites: OpenCelliD key before phase 6, otherwise synthetic sites (decided 2026-10-25).
3. User (optional): review, commit/push/PR on request; deploy to Cloudflare when ready.

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
- Real data needs defensive handling: AFAD needs a browser user agent, İBB CSVs mix UTF-8 and Windows-1254, the 2017 İBB data still calls Eyüpsultan "Eyüp", WorldPop uses a negative nodata value, OSM has `beds=0`, and EFSM20 uses `RL`/`LL` codes.
