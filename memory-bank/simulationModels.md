# Simulation Models

Scientific approach per engine module and how results reach the screen. Each implementation cites its sources in code; this file is the overview. Rows marked **(built)** are implemented and tested; the others are the plan.

## Grid

Marmara bounding box 26.0–31.0° E, 39.8–41.8° N. Engine grid `marmara-1km`: 0.01° cells, 500 × 200 (100,000 cells); phones may downsample by 2. Tsunami grid `marmara-500m`: 0.005°, 1000 × 400. Grids are north-up (row 0 = 41.8° N), row-major, little-endian `Float32Array`, NaN for no data; specs live in `manifest.json`, `src/types/grid.ts` is the shared type and `src/data/grid.ts` decodes them. Prepared inputs on these grids: population, Vs30, elevation, district index (1 km), bathymetry (500 m). Waves that leave the grid (for example north of 41.8° N over the Black Sea) are not drawn beyond it.

## Modules

| Module | Approach |
|---|---|
| `velocity` **(built)** | IASP91 crust and uppermost mantle (Kennett and Engdahl, 1991): 0–20 km Vp 5.80 / Vs 3.36, 20–35 km Vp 6.50 / Vs 3.75, mantle Vp 8.04 / Vs 4.47 km/s, verified against ObsPy's `iasp91.tvel`. First arrival = min(direct wave by ray-parameter bisection, head waves on every deeper interface). `TravelTimeCurve` tabulates first arrivals against distance (1 km steps, to 700 km) for each subfault depth. A regional Marmara model can replace IASP91 without code changes. |
| `rupture` **(built)** | Planar finite fault below the ruptured part of the trace (right-hand rule: dip direction = strike + 90°), width = seismogenic thickness / sin(dip). Subfaults: the hypocentre itself (radiating at t = 0) plus a grid of about 4 km along strike × 3 rows down dip. Circular rupture front from the hypocentre on the fault plane at 0.8 × Vs at the hypocentre (Heaton, 1990). Mw from rupture area with Wells and Coppersmith (1994) Table 2A (`M = 3.98 + 1.02·log A` for strike-slip), unless the scenario sets it. Leonard (2014) was the original plan; W&C94 is used because its coefficients were verified against OpenQuake's `WC1994`. |
| `sim` **(built)** | Arrival per cell = min over subfaults of (front time + first-arrival time at the chord distance). Ground motion = ASB14 median at the cell's Rjb (distance to the rupture's surface projection) and Vs30; MMI from PGA and PGV. Also returns per-district first P/S arrivals and peak MMI, the rupture summary and the scenario duration (last S arrival on the grid + 5 s). About 0.3–0.4 s per preset in Node; runs in a Web Worker in the app. |
| `gmpe` **(built)** | Akkar, Sandıkkaya and Bommer (2014), Rjb model: PGA, PGV, SA(0.3 s), SA(1.0 s); nonlinear Vs30 site term driven by the rock PGA; normal/reverse style terms from rake. Coefficients from OpenQuake hazardlib `AkkarEtAlRjb2014`; tests reproduce its 540-row verification table to 1e-6 in ln. Medians only in phase 2; aleatory variability (σ, τ available) comes with the random module in phase 3. |
| `intensity` **(built)** | Worden, Gerstenberger, Rhoades and Wald (2012) GMICE without magnitude/distance terms, with the ShakeMap low-amplitude extension (coefficients verified in USGS esi-shakelib `wgrw12.py`), g = 981 cm/s² as in ShakeMap. Combined MMI: PGA-based up to V, PGV-based from VII, linear weight between (Wald et al., 1999). Clamped to I–X. Bilal and Askan (2014) remains a candidate for a Türkiye-specific conversion once its coefficients are verified from the paper. |
| `random` | Seeded generator (mulberry32) and normal deviates; added in phase 3 with the first consumer (synthetic records), together with `Scenario.seed`. |
| `synth` | Stochastic accelerograms per station (Boore 2003): Brune source spectrum, geometric spreading, Q, kappa, duration model, site amplification; a P-wave segment precedes the S phase. 100 Hz, Z/N/E. Each record is scaled to the GMPE median at the station. |
| `eew` | STA/LTA triggering on synthetic records; grid-search location and Pd/τc magnitude estimate from the first four triggered stations; alert time T_alert. Warning time per district = S arrival − T_alert; negative values form the blind zone. |
| `damage` | Building stock per district by construction period (<1980, 1980–2000, >2000) and storeys (İBB 2017; estimated outside İstanbul). HAZUS-style lognormal fragility curves give damage-state probabilities; HAZUS casualty rates times indoor occupancy for the chosen time of day (03:00 or 14:00). Validate against the İBB 2019 scenario results. |
| `network` | Cell sites: Voronoi service areas times population give subscribers. Call demand rises with intensity and peaks within minutes; capacity and failure probability depend on PGA and power loss. Output per site: load %, state (normal, congested, down). |
| `routing` | Major road graph (motorway to tertiary) in CSR form. Edge cost = travel time × factors for bridge fragility and debris probability from nearby building damage. A* from AFAD and fire stations to the most damaged areas, and from damaged areas to hospitals with remaining capacity. Corridor usage aggregates into a heatmap. |
| `tsunami` | Okada (1985) seafloor displacement from the fault, optional submarine landslide source as a Gaussian hump. Linear shallow-water equations on bathymetry, about 500 m grid, finite differences with CFL-limited time step, in a worker. Output frames every 10 s, coastal arrival time and maximum amplitude. Labeled educational and simplified. |
| `etas` | Aftershock catalogs from Omori-Utsu and ETAS with Gutenberg-Richter magnitudes, spatially distributed along the rupture, up to 72 hours. |

## Timeline

One global clock `t` in seconds from origin (`state/playback-store.ts`). Built: 0 to the scenario duration, play/pause, slider, speeds 0.5×–10×, keyboard (Space, ←/→ 1 s, Shift ±10 s). Planned: scale presets Shaking (−10 s to 5 min), Tsunami (0 to 60 min), Response (0 to 72 h) and event markers (first P detection, EEW alert, S arrival at central İstanbul, tsunami coastal arrival, major aftershocks).

## Map layers

| Layer | Rendering |
|---|---|
| Intensity **(built)** | MMI per cell, shown once the S wave has arrived (1.5 s fade-in), ShakeMap colours with alpha rising from II to V. A MapLibre `image` source fed with `updateImage({ image: ImageData })` every frame, so it drapes on the terrain; rows are remapped from latitude to Web Mercator. Inserted below the reference lines and above the basemap roads. |
| P/S wavefronts **(built)** | Isoline of the arrival-time grid at `t` (marching squares), lifted onto the terrain with the elevation grid and repeated at 5 heights (250–2,850 m, fading) as a curtain of light: deck.gl `LineLayer` with binary attributes. P cyan (`--wave-p`), S amber (`--wave-s`). |
| Rupture **(built)** | Ruptured extent (faint) and the part the front has reached by `t` (bright), plus the epicentre; deck.gl, lifted onto the terrain. |
| Districts, faults, stations **(built)** | MapLibre native reference layers (phase 1). Planned: districts as an impact choropleth with selection details; stations flashing when triggered. |
| Cell sites | Columns (height = load, color = state) plus load heatmap. |
| Corridors | Animated trips plus usage heatmap; closed roads dashed in the critical color. |
| Infrastructure | Icons with functionality state. |
| Tsunami | Sea-surface height raster with coastal arrival labels. |
| Aftershocks | Points appearing over time, sized by magnitude. |

## Presets

Built (`src/features/scenario/lib/presets.ts`), all on the Main Marmara Fault (EFSM20 `TRCF045`, one 520 km source digitized east to west, dip 74°, rake −157°, 0.5–18 km), extents given as longitudes along the trace:

| Preset | Extent | Hypocentre | Result |
|---|---|---|---|
| North Marmara (Central Marmara – Princes' Islands) | 29.15° → 27.75° E | 28.25° E, 12 km | 121 km, Mw 7.4 |
| Kumburgaz segment | 28.95° → 28.45° E | 28.70° E, 12 km | about Mw 6.9 |
| Princes' Islands segment | 29.25° → 28.85° E | 29.05° E, 10 km | about Mw 6.8 |
| İzmit (1999-like) | 30.90° → 29.35° E | 29.90° E, 15 km | about Mw 7.4 (1999: Mw 7.6) |

Segment names follow the literature (Le Pichon et al., 2001; Armijo et al., 2002); limits are approximate and say so in the UI. Planned historical replays (phase 9): 1912 Mürefte Mw 7.3, 1999 Gölcük Mw 7.6 (1999-08-17 03:02), 2019 Silivri Mw 5.8 (2019-09-26), 2025 Silivri Mw 6.2 (2025-04-23); verify each event's parameters against the AFAD and KOERI catalogs before encoding it.

## Known model limits

- Medians only: observed 1999 intensities (IX–X near İzmit Bay) exceed the median VIII; the spread is within σ.
- One fault plane per scenario; multi-fault ruptures (e.g. jumping to a parallel strand) are not modelled.
- Flat-layered velocity model without topography or basin effects; Vs30 from topographic slope.
