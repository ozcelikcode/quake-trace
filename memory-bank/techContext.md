# Tech Context

## Stack

Versions are pinned exactly in `package.json`; the lines below were current on npm on 2026-10-25.

| Area | Choice | Version line | Why |
|---|---|---|---|
| Runtime | Node.js | 24 LTS (`.nvmrc`) | Local toolchain (v24.21.0) |
| Build | Vite (Rolldown) | 8.x | Fast dev server, worker bundling, `resolve.tsconfigPaths` |
| Language | TypeScript | 6.0.x, strict | TypeScript 7 exists, but typescript-eslint 8.72 supports `<6.1`; move to 7 when it does |
| UI | React | 19.x | deck.gl's primary binding |
| Compiler | React Compiler (Babel preset via `@rolldown/plugin-babel`) | 1.0 | Automatic memoization; the Rust port in plugin-react is still experimental |
| Map | MapLibre GL JS | 6.x | Open-source vector maps and 3D terrain, no token; ESM-only, worker URL set with `setWorkerUrl` |
| GPU layers | deck.gl (`@deck.gl/maplibre` `MapLibreOverlay`, interleaved) | 9.4 | Wavefronts, rasters, columns, trips, heatmaps |
| State | Zustand | 5.x | Small, selector-based stores; `persist` for the theme |
| Primitives | radix-ui (unified package) | 1.x | Accessible Tabs, ToggleGroup, Tooltip, Dialog; components are owned code in `src/components/ui/` |
| Styling | Tailwind CSS (`@tailwindcss/vite`) + tw-animate-css | 4.x | Token-only theme; enter/exit animations |
| Class utilities | clsx + tailwind-merge (extended for the custom type scale) + class-variance-authority | | Variant styling |
| Icons | lucide-react | 1.x | Consistent stroke set |
| i18n | i18next + react-i18next + i18next-browser-languagedetector | 26 / 17 / 8 | TR + EN catalogs, typed keys |
| Fonts | @fontsource-variable/ibm-plex-sans, @fontsource/ibm-plex-mono (latin + latin-ext) | 5.x | Self-hosted, full Turkish coverage |
| Validation | zod | 4.x | Schemas for the manifest and every prepared dataset (later: feeds, URL state) |
| Data fetching | @tanstack/react-query | 5.x | Caching and status for dataset loads (later: live feed polling) |
| Workers | Comlink | 4.x | Typed RPC to the simulation worker, transferable result arrays |
| Dynamic layers | @deck.gl/layers | 9.4 | `LineLayer` with binary attributes for wavefront curtains, `PathLayer`, `ScatterplotLayer` |
| Unit/integration tests | Vitest + jsdom + @vitest/coverage-v8 | 5.x | Vite-native |
| E2E | @playwright/test + @axe-core/playwright | 1.64 / 4.14 | Flows, responsive projects, WCAG scans |
| Lint/format | ESLint 10 (flat) + typescript-eslint (strictTypeChecked) + react-hooks + react-refresh; Prettier 3 + tailwind plugin | | Layer boundaries enforced with `no-restricted-imports` |
| Edge | Cloudflare Workers static assets + `@cloudflare/vite-plugin` + Wrangler 4 | | Free plan; same Worker in dev (workerd) and production |
| Data prep | Python 3.13 via uv (`uv.lock`) | uv 0.13 | numpy, rasterio (GDAL 3.12 with netCDF), geopandas/shapely/pyogrio, osmium (pyosmium 4), httpx, affine |
| Pipeline quality | ruff, pyright (strict, root `pyrightconfig.json`), pytest | | Same gates locally and in CI |

Planned for later phases (add a row with the reason when adopted): obspy (validation scripts; used once via `uv run --with obspy` to produce the miniSEED test reference).

Bundle (phase 11): shell chunk 245 KB gzipped (all panels and features), map chunk 486 KB gzipped (lazy), workers separate. Splitting the panels by route or lazy-loading rarely used ones (About, report, live) is the next step if first load matters.

Bundle (phase 2): shell chunk about 190 KB gzipped (React, Radix, i18next, zod, TanStack Query); the lazy map chunk about 480 KB gzipped (MapLibre, deck.gl); the simulation worker is a separate chunk.

Not adopted:

- `eslint-plugin-jsx-a11y`: no ESLint 10 support; accessibility is enforced with axe in e2e instead.
- `vaul`: forced a modal dialog (page `aria-hidden`) for persistent sheets and has had no release since 2024-12.
- `react-map-gl`: a thin in-house wrapper around MapLibre and `MapLibreOverlay` is enough.
- `uPlot`: waveforms are drawn by an in-house canvas painter over min/max envelopes (phase 3); last uPlot release 2025-03.
- `lz-string` and `jsPDF` (phase 10): share links are readable query parameters (`URLSearchParams` + zod); the PDF report is printed by the browser (`window.print()` with a print stylesheet), which keeps Turkish text and the app fonts without embedding.
- `seisplotjs` (3.2.7, phase 9): its single export pulls d3, leaflet, handlebars, jszip and luxon; miniSEED 2.4 (Steim1/2) and StationXML are read by `src/lib/formats/` instead, checked against ObsPy 1.5.1.

## Development setup

```
npm install
npm run dev            # Vite + Worker proxy (workerd) on localhost
npm run typecheck      # tsc -b over app, worker, tests, configs
npm run lint
npm run format:check
npm run test           # Vitest: tests/unit + tests/integration
npm run test:e2e       # Playwright: builds, serves the preview, runs tests/e2e
npm run build
npm run preview        # production build with the Worker, locally
npm run cf-typegen     # regenerate worker/worker-configuration.d.ts after editing wrangler.jsonc
npm run deploy         # build + wrangler deploy (needs `npx wrangler login` once)
gh workflow run smoke.yml   # check the deployed Worker from GitHub Actions
```

TypeScript projects: `tsconfig.base.json` holds shared strict options; `tsconfig.app.json` (src), `tsconfig.worker.json` (worker, Cloudflare runtime types), `tsconfig.test.json` (tests + src), `tsconfig.node.json` (config files). TypeScript 6 no longer includes `@types` automatically, so each project lists its `types`.

npm 11 `allowScripts` in `package.json` approves install scripts for `workerd` and `esbuild` and denies `fsevents`.

Pipeline (developers only; run from `pipeline/`):

```
uv sync
uv run quaketrace-pipeline list                    # datasets in build order
uv run quaketrace-pipeline build --all             # or: build faults districts ...
uv run pytest                                      # tests/pipeline (testpaths in pyproject)
uv run ruff check . ../tests/pipeline && uv run ruff format --check . ../tests/pipeline
uv run pyright -p ../pyrightconfig.json
```

The system Python is 3.9; uv manages the 3.13 interpreter for the pipeline. A full build downloads about 1.3 GB into `pipeline/.cache/` (OSM extract 651 MB, Vs30 grid 610 MB) and needs about 4 GB of RAM for the road graph. `cells` needs `OPENCELLID_API_KEY` in `pipeline/.env` (see `.env.example`) and is skipped without it.


## Constraints

- No paid services, no Docker, no long-running server.
- Cloudflare Workers free plan: 100,000 Worker requests per day (static asset requests are free), 25 MiB per asset, 20,000 assets.
- The Workers Cache API is a no-op on `*.workers.dev` hosts; responses therefore carry `Cache-Control` so browsers do not repeat requests.
- Initial download: shell chunk about 146 KB gzipped; MapLibre and deck.gl load lazily (about 400 KB gzipped). Scenario datasets load on the first run, as gzip copies (`<file>.gz?v=<sha256>`) emitted by the build; caching rules live in `public/_headers`.
- Scenario computation under 2 s on a mid-range laptop (tsunami runs in the background).
- Playback at 60 fps desktop, 30 fps phones; device pixel ratio capped at 1.5 on phones.
- Basemap and terrain are keyless: OpenFreeMap styles (`dark`, `positron`), AWS Terrain Tiles (Terrarium encoding).
- Secrets (OpenCelliD API key) exist only in `pipeline/.env`, never in the repo or the client bundle.

## Tool usage

- Library documentation: read the current official docs or the installed package's types before using an API.
- Visual checks: Playwright screenshots via a script (Chromium from `npx playwright install`); `@playwright/test` for automated e2e.
- Assistant-specific tools are listed in that assistant's own file (for example `CLAUDE.md`), not here.
- pyright for Python type checking: the pipeline dev dependency for CLI and CI, the global 1.1.414 install for the IDE plugin; both read `pyrightconfig.json`.

## Dependency policy

A dependency is added only if it is actively maintained, ships types and ESM, is tree-shakeable, has a compatible license and solves something the platform does not. Add a row to the stack table with the reason. Remove it when it is no longer used.
