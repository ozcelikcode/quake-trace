# Simulation Models

Scientific approach per engine module and how results reach the screen. Each implementation cites its sources in code; this file is the overview.

## Grid

Marmara bounding box 26.0–31.0° E, 39.8–41.8° N. Engine grid `marmara-1km`: 0.01° cells, 500 × 200 (100,000 cells); phones may downsample by 2. Tsunami grid `marmara-500m`: 0.005°, 1000 × 400. Grids are north-up (row 0 = 41.8° N), row-major, little-endian `Float32Array`, NaN for no data; specs live in `manifest.json` and `src/data/grid.ts` decodes them. Prepared inputs on these grids: population, Vs30, district index (1 km), bathymetry (500 m).

## Modules

| Module | Approach |
|---|---|
| `velocity` | Layered 1D Vp/Vs model for the Marmara crust. Travel-time table T(epicentral distance, depth) for direct and head waves; first arrival is the minimum. |
| `rupture` | Finite fault from segment geometry (trace, dip, upper and lower seismogenic depth) discretized into subfaults. Magnitude ↔ rupture length and area via Leonard (2014), cross-checked with Wells and Coppersmith (1994). Rupture velocity about 0.8 Vs, unilateral or bilateral from the hypocenter. Arrival at a cell = min over subfaults of (rupture time + travel time). |
| `gmpe` | Akkar, Sandıkkaya and Bommer (2014), Rjb form: PGA, PGV, SA(0.3 s), SA(1.0 s), Vs30 site term, Rjb from the finite fault. Optional seeded aleatory variability. |
| `intensity` | PGA and PGV to MMI with Bilal and Askan (2014) for Türkiye. Displayed with the USGS ShakeMap scale. |
| `synth` | Stochastic accelerograms per station (Boore 2003): Brune source spectrum, geometric spreading, Q, kappa, duration model, site amplification; a P-wave segment precedes the S phase. 100 Hz, Z/N/E. Each record is scaled to the GMPE median at the station. |
| `eew` | STA/LTA triggering on synthetic records; grid-search location and Pd/τc magnitude estimate from the first four triggered stations; alert time T_alert. Warning time per district = S arrival − T_alert; negative values form the blind zone. |
| `damage` | Building stock per district or neighborhood by type and construction period (<1980, 1980–2000, 2000–2018, >2018). HAZUS-style lognormal fragility curves give damage-state probabilities; HAZUS casualty rates times indoor occupancy for the chosen time of day (03:00 or 14:00). |
| `network` | Cell sites: Voronoi service areas times population give subscribers. Call demand rises with intensity and peaks within minutes; capacity and failure probability depend on PGA and power loss. Output per site: load %, state (normal, congested, down). |
| `routing` | Major road graph (motorway to tertiary) in CSR form. Edge cost = travel time × factors for bridge fragility and debris probability from nearby building damage. A* from AFAD and fire stations to the most damaged areas, and from damaged areas to hospitals with remaining capacity. Corridor usage aggregates into a heatmap. |
| `tsunami` | Okada (1985) seafloor displacement from the fault, optional submarine landslide source as a Gaussian hump. Linear shallow-water equations on bathymetry, about 500 m grid, finite differences with CFL-limited time step, in a worker. Output frames every 10 s, coastal arrival time and maximum amplitude. Labeled educational and simplified. |
| `etas` | Aftershock catalogs from Omori-Utsu and ETAS with Gutenberg-Richter magnitudes, spatially distributed along the rupture, up to 72 hours. |
| `sim` | Orchestrator: `Scenario` → `SimulationResult` (grid fields, station records, event list, module outputs). Heavy modules (tsunami, routing, network) run in separate lazy workers. |

## Timeline

One global clock `t` in seconds from origin. Scale presets: Shaking (−10 s to 5 min), Tsunami (0 to 60 min), Response (0 to 72 h). Event markers: first P detection, EEW alert, S arrival at central İstanbul, tsunami coastal arrival, major aftershocks. Playback speeds 0.25× to 10×.

## Map layers

| Layer | Rendering |
|---|---|
| P/S wavefronts | Isochrone of the arrival-time grid at `t` (marching squares), drawn as glowing extruded rings; height proportional to amplitude. Optional underground cross-section showing the hypocenter and fronts at depth. |
| Intensity | MMI on cells reached by the S wave, GPU colormapped raster. |
| Districts | Extruded choropleth by impact; selection shows MMI, warning time, damage, population. |
| Stations | Real locations; flash when triggered. |
| Cell sites | Columns (height = load, color = state) plus load heatmap. |
| Corridors | Animated trips plus usage heatmap; closed roads dashed in the critical color. |
| Infrastructure | Icons with functionality state. |
| Tsunami | Sea-surface height raster with coastal arrival labels. |
| Aftershocks | Points appearing over time, sized by magnitude. |

## Presets

- Historical replay: 1912 Mürefte Mw 7.3, 1999 Gölcük Mw 7.6 (1999-08-17 03:02), 2019 Silivri Mw 5.8 (2019-09-26), 2025 Silivri Mw 6.2 (2025-04-23). Real records where available, synthetic elsewhere, labeled per station.
- Expected Marmara earthquake: Central Marmara and Kumburgaz segment scenarios, Mw 7.2–7.6.

Verify each event's parameters against the AFAD and KOERI catalogs before encoding a preset.
