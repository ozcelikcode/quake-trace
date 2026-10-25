# Progress

## Current status

Phase: **0 (skeleton) complete locally** on branch `feat/phase-0-skeleton`, not yet committed. Only the first Cloudflare deploy is left, and it needs the user's free Cloudflare account. Next: phase 1 (data pipeline).

## What works

- Project rules (`AGENTS.md`, `CLAUDE.md`) and the Memory Bank.
- App shell for three layouts: desktop (side panels), tablet (side sheets), phone (non-modal bottom sheet with snap heights). Status bar with simulation clock placeholder, language toggle (TR/EN, persisted) and theme toggle (dark/light, persisted, applied before first paint).
- Token-only design system in Tailwind v4; IBM Plex Sans/Mono self-hosted.
- MapLibre 6 map with OpenFreeMap basemap per theme, AWS Terrarium 3D terrain and hillshade, deck.gl `MapLibreOverlay` attached (no layers yet), lazy-loaded.
- Cloudflare Worker proxy for AFAD, Kandilli and KOERI FDSN with an allowlist, cache headers and gateway error mapping. It runs in `npm run dev` and `npm run preview`.
- Tooling: strict TypeScript project references, ESLint with layer-boundary rules (verified with probe files), Prettier, Vitest (27 tests), Playwright (20 e2e tests across desktop, tablet and two phone profiles, including axe WCAG scans in both themes), GitHub Actions CI.
- Verified 2026-10-25: typecheck, lint, unit/integration and e2e tests, build; screenshots reviewed at 1440×900 (both themes), 1024×768 and Pixel 7.

## Phases

Each phase ends with CI green and a deployable `main`.

- [x] **0. Skeleton** — Vite + React + TS strict, Tailwind tokens and fonts, i18n, responsive shell, MapLibre + deck.gl + 3D terrain, lint/format/test tooling with the `tests/` layout, CI, Worker proxy, CORS spike.
  - [ ] First deploy to Cloudflare (needs the user's account: `npx wrangler login`, then `npm run deploy`, or connect the repo in the dashboard).
- [ ] **1. Data pipeline** — `pipeline/` modules, `public/data/` with manifest and attribution, typed loaders.
  - Done when: every dataset in `dataSources.md` is prepared, validated by schema and loaded in the app.
- [ ] **2. Core engine and first vertical slice** — velocity, rupture, gmpe, intensity, random, sim; playback store; wavefronts, intensity raster, districts, timeline.
  - Done when: a preset scenario computes in under 2 s and plays back with correct P/S fronts; engine reference tests pass.
- [ ] **3. Telemetry** — synthetic records, uPlot panels synced to the clock, STA/LTA picks.
- [ ] **4. EEW** — detection, alert, district countdowns, blind zone.
- [ ] **5. Damage and critical infrastructure.**
- [ ] **6. Cell tower load, routing and corridors, heatmaps.**
- [ ] **7. Tsunami.**
- [ ] **8. Aftershocks (ETAS) and multi-scale timeline.**
- [ ] **9. Live mode and historical replay** with real feeds and seismograms.
- [ ] **10. Scenario editor and URL sharing; event log and PDF/GeoJSON/CSV export.**
- [ ] **11. Polish** — phone tuning, performance, accessibility audit, About and methodology page, README with screenshots and attribution, scientific validation results published.

## Known issues and follow-ups

- Playwright MCP cannot launch: it expects Google Chrome, which is not installed. The user chose to leave it (2026-10-25); visual checks use Playwright screenshots via script.
- `npm audit`: 4 advisories in `undici` pulled in by `wrangler`/`miniflare` (local dev tooling only, not shipped). The suggested fix is a downgrade; revisit when Wrangler updates its dependency.
- Phone opening view: the narrow width gives a low zoom and the pitched camera shows a lot of the Black Sea. Consider a lower pitch or tighter bounds on phones (phase 11).
- Dark basemap: water and land contrast is very low. Tune it once data layers exist (phase 2), keeping data dominant.
- MapLibre has no API to start compact attribution collapsed; on narrow maps the `maplibregl-compact-show` class is removed after load (`map-view.tsx`).

## Evolution of decisions

- 2026-10-25: Python backend replaced by a browser-only engine plus an edge proxy, after the user required a free, zero-install deployment without Docker.
- 2026-10-25: Unit tests moved from beside source files to a separate `tests/` tree.
- 2026-10-25: Cloudflare Pages Functions replaced by Workers static assets + `@cloudflare/vite-plugin`.
- 2026-10-25: TypeScript pinned to 6.0.x until typescript-eslint supports 7.
- 2026-10-25: vaul dropped; own `BottomSheet` and Radix `Sheet` instead.
