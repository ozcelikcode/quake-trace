# Testing Strategy

## Layout

All tests live under `tests/`. Nothing test-related lives in `src/`, `worker/` or `pipeline/src/`.

```
tests/
├─ unit/          Vitest · mirrors src/ paths (unit/engine/gmpe/asb14.test.ts)
├─ integration/   Vitest · workers, data loaders, stores, proxy Worker (integration/worker/)
├─ e2e/           Playwright · user flows, responsive and visual checks
├─ pipeline/      pytest · pipeline modules
└─ fixtures/      reference values, small datasets, recorded feed responses
```

- File naming: `<source-file-name>.test.ts` for Vitest, `<flow>.spec.ts` for Playwright, `test_<module>.py` for pytest.
- Shared helpers go in `tests/<level>/_helpers/`.
- Fixtures are small and committed. Each fixture file records its origin (source, date, command used to produce it).

## Levels

| Level | Scope | Runs |
|---|---|---|
| Unit | Engine math, formatting, schemas, store logic | Every change, `npm run test` |
| Integration | Worker round-trips with transferables, asset loading against fixture manifests, proxy Worker against stubbed upstreams | Every change, `npm run test` |
| E2E | Main flows on desktop and phone viewports, both locales | UI changes and CI, `npm run test:e2e` |
| Pipeline | Dataset transforms on tiny inputs | Pipeline changes, `uv run pytest ../tests/pipeline` |
| Scientific validation | Model versus observed ground motion | When models change, `uv run quaketrace-pipeline validate` |

## Engine references

| Module | Reference |
|---|---|
| `gmpe` **(built)** | OpenQuake hazardlib's 540-row ASB14 Rjb verification table (`tests/fixtures/gmpe/asb14-rjb-mean.json`, PGA, PGV, SA 0.3 s, SA 1.0 s); ln difference below 1e-6 |
| `velocity` **(built)** | Analytic travel times in a half-space; two-layer head wave, critical and crossover distances; vertical ray through IASP91 layers; continuity across interfaces; monotonicity; tabulated curve against the exact solution |
| `rupture` **(built)** | Wells and Coppersmith (1994) Table 2A areas and magnitudes; rupture geometry (width, area, dip direction, hypocentre, front timing) on a synthetic fault |
| `intensity` **(built)** | Worden et al. (2012) segment formulas, ShakeMap low-amplitude extension, clamping, PGA/PGV blending |
| `sim` **(built)** | Synthetic fault on a small grid (S after P, epicentral first arrival, strongest along the rupture, determinism); presets on the real data in `tests/integration/engine/` (under 2 s, Mw range, Fatih S arrival and intensity, 1999-like strongest near İzmit Bay) |
| `tsunami` | Okada (1985) published test case; shallow-water wave speed √(gh) on a flat bottom; mass conservation |
| `routing` | A* equals Dijkstra on random graphs |
| `etas` | Omori-Utsu decay recovered from generated catalogs within tolerance |
| `damage` | Damage-state probabilities sum to 1; monotonic in ground motion |
| `random` **(built)** | Same seed gives identical streams; uniform mean and variance; normal mean, variance and 2σ tail share; distinct sub-stream seeds |
| `synth` **(built)** | Window analytic conditions (peak 1 at ε, η at tη, zero slope, b = 1.25315); Brune corner (0.1124 Hz at Mw 7), M0^(-1/3) scaling, Madariaga ratio, spreading, amplification table, ω² slope, P/S ratio; realizations reproduce the target spectrum band by band (±25 %), no mean, energy inside the window; station record PGA equals the target, noise floor before P, P projection on Z and the radial component |
| `eew` location and Pd **(built)** | Exact picks from a known source are relocated within 1.5 km; Wu & Zhao relation value and exact inversion; grown-rupture magnitude (disc, band, cap); presets locate within 5 km, alert within 15 s, estimate between 5.5 and Mw + 0.3 |
| `eew` STA/LTA **(built)** | Stationary signal ratio 1, analytic ratio across an amplitude step, trigger index |
| `lib/math/fft` **(built)** | Direct DFT, single cosine, Parseval and inversion |

Map frame logic (`features/map/lib/simulation-frames.ts`, `layer-order.ts`) is unit-tested as pure functions; the imperative `SimulationRenderer` is covered by e2e and screenshot review.

## E2E flows

1. App loads, map and terrain render, no console errors.
2. Preset scenario runs; at t = 20 s the P wavefront is visible, a station record is drawn and the event log contains the EEW alert.
3. Timeline scrubbing forward and backward updates map, telemetry and readouts consistently.
4. Language switch TR ↔ EN changes all visible text; theme switch keeps contrast.
5. Phone viewport: bottom sheet tabs reach every function.
6. Shared scenario URL reproduces the same state.

Viewports: 1440×900 desktop, 1024×768 tablet, 390×844 phone (iPhone class), 412×915 phone (Pixel class).

## Coverage

- `src/engine/`: at least 90 % lines and branches.
- Rest of `src/`: behavior-focused; no coverage chasing on presentational components.
- Coverage is a signal, not the goal: every engine formula has at least one test against a cited reference.

## Prepared data checks

- `tests/pipeline/test_outputs.py` verifies every file in `public/data` against the manifest (size, SHA-256, sources) and spot-checks real values: Fatih population, Çınarcık depth, Vs30 on Uludağ versus the Adapazarı basin, the Kadıköy district index.
- `tests/integration/data/repository.test.ts` loads the same files through `DataRepository` from disk, validates every JSON dataset with its zod schema, decodes the grids and the road graph, and repeats the spot checks. Python and TypeScript therefore agree on grid orientation.
- Schema validation has already caught a real data issue (an OSM hospital with `beds=0`); fix such issues in the pipeline, not by loosening the schema.

## Environments and accessibility

- Vitest runs in Node by default; files that need the DOM declare `// @vitest-environment jsdom` at the top.
- Every e2e run includes an axe scan (WCAG 2.0–2.2 A/AA tags) in both themes; serious and critical violations fail the test and list their target selectors. The map canvas is excluded. The scan runs with `reducedMotion: 'reduce'` so it never measures colors mid-transition.
- Playwright runs with 2 workers and a 60 s timeout: headless browsers render the 3D map with software WebGL, and more workers starve the main thread.
- E2E specs pin `locale: 'tr-TR'` so language detection is deterministic.
- Visual checks during development: screenshots via a Playwright script (the Playwright MCP is unavailable on this machine because it expects Google Chrome).

## External services

Tests never call live services. Feed and FDSN responses are recorded once into `tests/fixtures/feeds/` and replayed.
