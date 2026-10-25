# Active Context

## Current focus

Phase 2 is complete on branch `feat/phase-2-engine`: a preset scenario computes in a worker in about 0.3 s and plays back on the 3D map with intensity, wavefronts, rupture, timeline and district arrivals. Next is phase 3, telemetry.

## Recent changes (2026-10-25)

- Pipeline: EFSM20 fault-type codes fixed (`RL`, `LL`, `N`, `R`; unknown codes now fail the build), elevation grid from Copernicus GLO-90, `fixtures` command writing the OpenQuake ASB14 verification table.
- Engine: velocity (IASP91), rupture (finite fault, W&C94, hypocentre as the first subfault), gmpe (ASB14 Rjb), intensity (Worden 2012 + ShakeMap extension), sim (orchestrator, per-district impacts). All coefficients verified against OpenQuake, USGS esi-shakelib and ObsPy sources.
- App: simulation worker (Comlink), scenario and playback stores, presets on the Main Marmara Fault, scenario panel, timeline controls and keyboard shortcuts, map renderer (image-source raster + deck.gl curtains), legend, watermark, status clock and scenario status, impact table; tablet drawer closes when a scenario starts.
- ESLint engine boundary rewritten as a regex (gitignore-style negations could not re-allow `@/lib/math`).

## Next steps

1. Phase 3: add `engine/random` and `Scenario.seed`; stochastic accelerograms per station (Boore 2003), scaled to the ASB14 median at each station; uPlot waveform panels in the telemetry tab, synced to the clock; STA/LTA triggers; stations flash on trigger.
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
