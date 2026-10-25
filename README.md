# quakeTrace

Real-time seismology and disaster-response command screen for the Marmara region. A 3D terrain map of İstanbul and the Sea of Marmara shows P and S wavefronts spreading district by district, seismograph stations stream acceleration records, and a scrubbable timeline shows shaking, early-warning times, cell tower load and emergency corridors at every second of a scenario.

Everything runs in the browser. There is no server to operate and no paid service.

> **Simulation, not a warning system.** quakeTrace is an educational and portfolio project. Simulated output is always labeled as simulation; real earthquake data is always labeled with its source. It is not an official early-warning or alerting service.

## Status

Phases 0–2 are in place. Pick a Main Marmara Fault scenario and watch it in the browser: the rupture spreads along the fault, P and S wavefronts cross the region as curtains of light over the 3D terrain, and the intensity map (MMI) fills in as the S wave arrives. A timeline plays it back or scrubs it at any speed, and a table lists when the S wave reaches each district. Ground motion uses the Akkar–Sandıkkaya–Bommer (2014) model, verified against OpenQuake's reference values. Telemetry, early warning, damage and the other modules follow; see [`memory-bank/progress.md`](memory-bank/progress.md).

## Quick start

Requirements: Node.js 24 or newer.

```sh
npm install
npm run dev
```

Open the printed local URL. The `/api/*` data proxy runs locally inside the dev server; no Cloudflare account is needed for development.

## Scripts

| Command                           | Purpose                                                                    |
| --------------------------------- | -------------------------------------------------------------------------- |
| `npm run dev`                     | Development server with the data proxy                                     |
| `npm run build`                   | Typecheck and production build                                             |
| `npm run preview`                 | Serve the production build locally                                         |
| `npm run typecheck`               | TypeScript across app, worker, tests and configs                           |
| `npm run lint`                    | ESLint, including layer-boundary rules                                     |
| `npm run format` / `format:check` | Prettier                                                                   |
| `npm run test`                    | Unit and integration tests (Vitest)                                        |
| `npm run test:e2e`                | End-to-end tests on desktop, tablet and phone viewports (Playwright)       |
| `npm run cf-typegen`              | Regenerate Cloudflare Worker runtime types after changing `wrangler.jsonc` |
| `npm run deploy`                  | Build and deploy to Cloudflare Workers                                     |

## Architecture

- **Client:** React, TypeScript and Vite. MapLibre GL renders the basemap and 3D terrain; deck.gl renders data layers on the GPU. The physics engine runs in Web Workers.
- **Data proxy:** a small Cloudflare Worker (`worker/`) forwards an allowlist of upstream services that lack CORS or HTTPS (AFAD, Kandilli, KOERI FDSN) and adds caching headers. Static assets are served by Cloudflare Workers static assets.
- **Data preparation:** offline Python scripts (`pipeline/`, developers only) prepare datasets that are committed to `public/data/`.

Project rules, architecture, design system and data sources are documented in [`AGENTS.md`](AGENTS.md) and [`memory-bank/`](memory-bank/).

## Deploying for free

Cloudflare Workers' free plan serves the static site and the proxy.

1. Create a free Cloudflare account.
2. Either connect this GitHub repository in the Cloudflare dashboard (Workers & Pages → Create → Import a repository, build command `npm run build`, deploy command `npx wrangler deploy`), or deploy from your machine:

   ```sh
   npx wrangler login
   npm run deploy
   ```

## Data and attribution

- Basemap: [OpenFreeMap](https://openfreemap.org), © [OpenMapTiles](https://openmaptiles.org), data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
- Terrain: [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/), © Mapzen and [contributors](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)
- Earthquake data (live mode): AFAD, Boğaziçi University Kandilli Observatory (KOERI), EMSC, USGS

Prepared datasets: faults (EFSM20), districts (geoBoundaries), population (WorldPop), Vs30 (USGS), elevation (Copernicus DEM), building counts (İBB), seismic stations (KOERI, EIDA), bathymetry (EMODnet), infrastructure and roads (OpenStreetMap). The full list with licenses is generated into [`public/data/ATTRIBUTION.md`](public/data/ATTRIBUTION.md); sources and processing are described in [`memory-bank/dataSources.md`](memory-bank/dataSources.md).

### Rebuilding the data (developers only)

The datasets are committed, so running the app never needs this. To rebuild them, install [uv](https://docs.astral.sh/uv/) and run from `pipeline/`:

```sh
uv sync
uv run quaketrace-pipeline build --all
```

A full build downloads about 1.3 GB into `pipeline/.cache/`. Cell sites need a free [OpenCelliD](https://opencellid.org) key in `pipeline/.env` (see `pipeline/.env.example`).

## License

Code is released under the [MIT License](LICENSE). Datasets keep their own licenses.
