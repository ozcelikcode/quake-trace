# Simulation Models

Scientific approach per engine module and how results reach the screen. Each implementation cites its sources in code; this file is the overview. Rows marked **(built)** are implemented and tested; the others are the plan.

## Grid

Marmara bounding box 26.0–31.0° E, 39.8–41.8° N. Engine grid `marmara-1km`: 0.01° cells, 500 × 200 (100,000 cells); phones may downsample by 2. Tsunami grid `marmara-500m`: 0.005°, 1000 × 400. Grids are north-up (row 0 = 41.8° N), row-major, little-endian `Float32Array`, NaN for no data; specs live in `manifest.json`, `src/types/grid.ts` is the shared type and `src/data/grid.ts` decodes them. Prepared inputs on these grids: population, Vs30, elevation, district index (1 km), bathymetry (500 m). Waves that leave the grid (for example north of 41.8° N over the Black Sea) are not drawn beyond it.

## Modules

| Module | Approach |
|---|---|
| `velocity` **(built)** | IASP91 crust and uppermost mantle (Kennett and Engdahl, 1991): 0–20 km Vp 5.80 / Vs 3.36, 20–35 km Vp 6.50 / Vs 3.75, mantle Vp 8.04 / Vs 4.47 km/s, verified against ObsPy's `iasp91.tvel`. First arrival = min(direct wave by ray-parameter bisection, head waves on every deeper interface). `TravelTimeCurve` tabulates first arrivals against distance (1 km steps, to 700 km) for each subfault depth. A regional Marmara model can replace IASP91 without code changes. |
| `rupture` **(built)** | Planar finite fault below the ruptured part of the trace (right-hand rule: dip direction = strike + 90°), width = seismogenic thickness / sin(dip). Subfaults: the hypocentre itself (radiating at t = 0) plus a grid of about 4 km along strike × 3 rows down dip. Circular rupture front from the hypocentre on the fault plane at 0.8 × Vs at the hypocentre (Heaton, 1990). Mw from rupture area with Wells and Coppersmith (1994) Table 2A (`M = 3.98 + 1.02·log A` for strike-slip), unless the scenario sets it. Leonard (2014) was the original plan; W&C94 is used because its coefficients were verified against OpenQuake's `WC1994`. |
| `sim` **(built)** | Arrival per cell = min over subfaults of (front time + first-arrival time at the chord distance). Ground motion = ASB14 median at the cell's Rjb (distance to the rupture's surface projection) and Vs30; MMI from PGA and PGV. Also returns per-district first P/S arrivals and peak MMI, the rupture summary, station records and the scenario duration (the later of the last S arrival on the grid and the end of every station's S window, + 5 s). About 0.5–0.9 s per preset in Node, of which the grid is 0.2–0.4 s; runs in a Web Worker in the app. |
| `gmpe` **(built)** | Akkar, Sandıkkaya and Bommer (2014), Rjb model: PGA, PGV, SA(0.3 s), SA(1.0 s); nonlinear Vs30 site term driven by the rock PGA; normal/reverse style terms from rake. Coefficients from OpenQuake hazardlib `AkkarEtAlRjb2014`; tests reproduce its 540-row verification table to 1e-6 in ln. Medians only in phase 2; aleatory variability (σ, τ available) comes with the random module in phase 3. |
| `intensity` **(built)** | Worden, Gerstenberger, Rhoades and Wald (2012) GMICE without magnitude/distance terms, with the ShakeMap low-amplitude extension (coefficients verified in USGS esi-shakelib `wgrw12.py`), g = 981 cm/s² as in ShakeMap. Combined MMI: PGA-based up to V, PGV-based from VII, linear weight between (Wald et al., 1999). Clamped to I–X. Bilal and Askan (2014) remains a candidate for a Türkiye-specific conversion once its coefficients are verified from the paper. |
| `random` **(built)** | mulberry32 uniform deviates, Box–Muller normals, FNV-1a sub-stream seeds per station id, so a station's record does not depend on the station list. `Scenario.seed` (presets: 1). |
| `synth` **(built)** | Stochastic method (Boore 2003): windowed Gaussian noise (SMSIM exponential window, ε 0.2, η 0.05, tη = 2 × duration; Boore 2002 OFR 00-509), normalized, multiplied by the point-source acceleration spectrum and inverted. S spectrum: Campbell (2003) WNA defaults as in pyrvt v0.8.1 (β 3.5 km/s, ρ 2.8, Δσ 100 bar, Q 180 f^0.45, κ 0.04, spreading R⁻¹/R⁻⁰·⁵ at 40 km, duration 1/f0 + 0.05 R, crustal amplification table), distance = nearest-subfault distance (≈ Rrup). P phase: (0.52/0.63)(β/α)³ (Boore & Boatwright 1984), corner × 0.32/0.21 (Madariaga 1976), α = √3 β, sharing the S attenuation (simplification). Components: P on Z (cos i) and radial (sin i, Snell's law with Vp = √3·Vs30); S independent on N and E, on Z at 2/3 (Newmark & Hall 1982). One scale factor sets the geometric mean of the horizontal peaks to the ASB14 median (OpenQuake `IMC.GEOMETRIC_MEAN`). Gaussian noise floor 0.05 cm/s² rms (assumption). 100 Hz, Z/N/E, 60 s of pre-event noise for the LTA. Accelerometer stations only (50). |
| `eew` **(built)** | Location: grid search (0.01°, ±0.5° around the stations) on the first four triggers, depth fixed at 10 km, origin time = mean residual. Magnitude: Pd modelled from the rupture grown in 3 s (disc of radius Vr·3 s, cut to the fault width; W&C94 area → M, capped at Mw) through Wu & Zhao (2006) log Pd = −3.463 + 0.729 M − 1.374 log R with σ 0.305 (seeded), inverted at the estimated distance and averaged — Pd saturates as in real systems. Alert = 4th trigger + 3 s (Pd window; Wu et al. 2007); no telemetry latency. Warning time per district = S arrival − alert; ≤ 0 is the blind zone. Presets: location error 1–2 km, first estimate M 6.2–6.5, alert T+6–11 s. Phase 3 part: classic STA/LTA on |a| of the vertical (Trnkoczy 2012: STA 0.5 s, LTA 60 s, trigger 4; ObsPy window semantics); first trigger per station, 0.01–0.7 s after the P arrival. **Planned:** STA/LTA triggering on synthetic records; grid-search location and Pd/τc magnitude estimate from the first four triggered stations; alert time T_alert. Warning time per district = S arrival − T_alert; negative values form the blind zone. |
| `damage` **(built)** | GEM Global Vulnerability Model v2026.0.0 (Türkiye) mean loss ratios, structural and fatality, instead of HAZUS fragility (verifiable, Türkiye-specific). Stock classes: period → code level (before 1980 CDL+ERL, 1980–2000 CDM+ERL, after 2000 CDM+ERM; a modelling judgement), storeys 1–4/5–9/9–19 → H:3/6/10, period and storeys independent. Buildings and residents spread over district cells by population. Each class evaluated at its own measure (PGA, SA 0.3/0.6/1.0 from ASB14, SA 0.6 added) and averaged over the ASB14 total σ (ε ∈ [−3, 3], 0.5 steps), because vulnerability is convex. Outputs per district: loss ratio, complete-loss-equivalent buildings, night fatalities (everyone home). Facilities (hospitals, fire, police): CDM+ERM/H:3/COM loss ratio; display states operational < 5 % ≤ limited < 20 % ≤ likely out (assumption). Validation: North Marmara vs İBB 2019 — district fatality rank correlation 0.77 (buildings 0.55), İstanbul fatalities 6,000 vs 14,145. |
| `network` | Cell sites: Voronoi service areas times population give subscribers. Call demand rises with intensity and peaks within minutes; capacity and failure probability depend on PGA and power loss. Output per site: load %, state (normal, congested, down). |
| `routing` | Major road graph (motorway to tertiary) in CSR form. Edge cost = travel time × factors for bridge fragility and debris probability from nearby building damage. A* from AFAD and fire stations to the most damaged areas, and from damaged areas to hospitals with remaining capacity. Corridor usage aggregates into a heatmap. |
| `tsunami` | Okada (1985) seafloor displacement from the fault, optional submarine landslide source as a Gaussian hump. Linear shallow-water equations on bathymetry, about 500 m grid, finite differences with CFL-limited time step, in a worker. Output frames every 10 s, coastal arrival time and maximum amplitude. Labeled educational and simplified. |
| `etas` | Aftershock catalogs from Omori-Utsu and ETAS with Gutenberg-Richter magnitudes, spatially distributed along the rupture, up to 72 hours. |

## Timeline

One global clock `t` in seconds from origin (`state/playback-store.ts`). Built: 0 to the scenario duration, play/pause, slider, speeds 0.5×–10×, keyboard (Space, ←/→ 1 s, Shift ±10 s). Built: event markers for the first detection (`wave-p`) and the EEW alert (`critical`). Planned: scale presets Shaking (−10 s to 5 min), Tsunami (0 to 60 min), Response (0 to 72 h) and further markers (S arrival at central İstanbul, tsunami coastal arrival, major aftershocks).

## Map layers

| Layer | Rendering |
|---|---|
| Intensity **(built)** | MMI per cell, shown once the S wave has arrived (1.5 s fade-in), ShakeMap colours with alpha rising from II to V. A MapLibre `image` source fed with `updateImage({ image: ImageData })` every frame, so it drapes on the terrain; rows are remapped from latitude to Web Mercator. Inserted below the reference lines and above the basemap roads. |
| Blind zone and estimate **(built)** | After the alert: the S isochrone at the alert time as a low curtain in the critical hue (blind-zone boundary) and a critical ring at the estimated epicentre. |
| Station triggers **(built)** | deck.gl: one expanding P-coloured ring (1.2 s) when a station triggers, then a steady dot; no ring with reduced motion. A ring in the station hue marks the focused station. Clicking an accelerometer station focuses it in telemetry. |
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
