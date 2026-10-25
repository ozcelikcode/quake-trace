# Project Brief

## What

quakeTrace is a browser-based command screen that simulates and monitors earthquakes in the Marmara region (İstanbul and surrounding provinces). A 3D topographic map sits at the center. When an earthquake is triggered on a fault, P and S wavefronts spread across districts second by second. Seismograph stations stream acceleration records in a side panel. A timeline can be scrubbed forward and backward to see which areas are affected at each moment, how cell towers are loaded and which emergency corridors remain usable.

## Goals

1. A professional, portfolio-grade product: scientifically defensible models, a polished and calm interface, clean engineering.
2. Fully free and zero-install for the viewer: open a URL and it works. Locally `npm install && npm run dev`.
3. Deterministic, scrubbable simulations: any moment of a scenario can be inspected instantly.
4. Real data where it exists, clearly labeled; simulation where it does not, clearly labeled.

## Scope

In scope (all confirmed by the user on 2026-10-25):

- **Data:** synthetic scenario engine, live earthquake feeds (AFAD, Kandilli, EMSC, USGS), historical replay, real seismograms (FDSN).
- **Physics:** finite-fault rupture, layered velocity model, GMPE (Akkar-Sandıkkaya-Bommer 2014), Vs30 site effects, MMI.
- **Impact:** earthquake early warning (EEW), building damage and casualty estimates, critical infrastructure, tsunami.
- **Operations:** emergency routes and corridors, aftershock sequences (ETAS), event log and reports (PDF, GeoJSON, CSV), scenario editor with URL sharing.
- **Interface:** fully responsive (desktop to phone), Turkish and English, dark and light themes.

Out of scope:

- User accounts, multi-user sessions, any server-side state.
- Paid services, Docker, self-operated servers.
- Acting as or imitating an official warning system.

## Constraints

- Runs entirely in the browser (physics in Web Workers). The only server code is a stateless proxy Worker on the Cloudflare Workers free plan, which also serves the static assets.
- Static assets must fit Cloudflare Workers static-asset limits (25 MiB per file, 20,000 files on the free plan).
- Data licenses (ODbL, CC-BY, CC-BY-SA) are honored with attribution in the app and in `public/data/ATTRIBUTION.md`.

## Success criteria

- A preset scenario computes in under 2 s on a mid-range laptop and plays back at 60 fps (30 fps on phones).
- Modeled PGA for the 2019 Mw 5.8 and 2025 Mw 6.2 Silivri earthquakes stays within ±0.3 mean ln residual of observed station values.
- Every screen is usable by keyboard and meets WCAG 2.2 AA contrast.
