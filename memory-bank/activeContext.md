# Active Context

## Current focus

Phase 1 is complete on branch `feat/phase-1-data-pipeline`, except the `cells` dataset, which waits for the user's OpenCelliD key. Next is phase 2: the core engine and the first vertical slice (scenario → arrival times → GMPE → wavefronts on the map, with the timeline).

## Recent changes (2026-10-25)

- Phase 0 committed locally (`d3f7e44` on `feat/phase-0-skeleton`); phase 1 branched from it.
- Pipeline built in `pipeline/` with one module per dataset, cached downloads with retries, a manifest with SHA-256 and a generated `ATTRIBUTION.md`.
- Source decisions recorded in `dataSources.md` (EFSM20, WorldPop R2025A, USGS Vs30, İBB 2017 buildings with estimation outside İstanbul, OSM, EMODnet).
- `src/data/` data layer with zod schemas, `DataRepository`, binary decoders and TanStack Query hooks.
- Map shows draped reference layers (districts, faults, stations) via MapLibre native layers.
- CI gained a pipeline job (ruff, pyright, pytest); Playwright limited to 2 workers and the a11y scan uses reduced motion, after contention and transition flakiness were diagnosed.

## Next steps

1. User: provide an OpenCelliD API key (free registration) in `pipeline/.env`, or decide to drop cell sites from scope.
2. User (optional): review, then request commit/push/PR; deploy to Cloudflare when ready.
3. Phase 2 kick-off: spike on dynamic layers over 3D terrain (deck.gl with sampled elevations versus MapLibre native sources), name the Marmara fault segments (EFSM20 ids → names from the literature), then velocity, rupture, gmpe (ASB14 with OpenQuake fixtures), intensity, random, sim, playback store and timeline.

## Active decisions and considerations

- Dark theme is the default; light theme is supported through tokens.
- Documentation and code in English; user-facing text in TR and EN catalogs; conversation with the user in Turkish.
- Every progress report to the user ends with a phase status block.
- Fonts: IBM Plex Sans (variable) and IBM Plex Mono (latin + latin-ext only).
- Source file names kebab-case; Memory Bank files keep camelCase.
- The design token vocabulary is our own (`surface-*`, `line`, `fg`, `signal`, states). shadcn components are translated to it when adopted.
- Panel content is registered once in `src/app/panels.ts`; layouts only arrange it.
- Static map context uses MapLibre native layers; deck.gl is for dynamic layers.

## Learnings and preferences

- The user wants disciplined, senior-level work: strict structure, current high-quality libraries, professional minimal design that is not barren.
- The user requires everything to be free and runnable as-is; no Docker or paid services.
- Tests must live in a separate folder; every folder must follow a clear order.
- The Memory Bank is the user's top priority for project continuity.
- The user wants the phase status reported in every update.
- Library checks pay off: typescript-eslint did not support TS 7, jsx-a11y did not support ESLint 10, react-refresh 0.5 exports a named `reactRefresh`, vaul ignores `modal={false}`, MapLibre's container CSS overrides `position: absolute`, pyosmium needs nodes read for the location cache, and deck.gl does not drape on MapLibre terrain.
- Real data needs defensive handling: AFAD needs a browser user agent, İBB CSVs mix UTF-8 and Windows-1254, the 2017 İBB data still calls Eyüpsultan "Eyüp", WorldPop uses a negative nodata value, and OSM has `beds=0`.
