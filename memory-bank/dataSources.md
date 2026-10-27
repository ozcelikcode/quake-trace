# Data Sources

Every dataset and feed used by quakeTrace, with license and handling. Add a row before using anything new. `public/data/ATTRIBUTION.md` is generated from the manifest by the pipeline; the in-app About dialog (Data tab) reads the same sources.

## Prepared datasets (`pipeline/` → `public/data/`)

Built 2026-10-25 with `uv run quaketrace-pipeline build --all` (run from `pipeline/`). Grids are north-up float32 (see `systemPatterns.md`).

| Dataset id | File | Source | License | Notes |
|---|---|---|---|---|
| `faults` | `faults.geojson` | EFSM20 crustal fault top traces via WFS (`services.seismofaults.eu/EFSM20/ows`, `EFSM20:efsm20_cf_top`), doi:10.13127/efsm20 | CC-BY 4.0 | 27 segments touching the region. Strike, dip, rake (min/avg/max), seismogenic depths, length, width, slip rate, Mw max (Leonard 2014). No segment names; right-hand-rule traces (dip azimuth = strike + 90°). Chosen over GEM GAF-DB, which carries fewer parameters and no dip direction |
| `districts` | `districts.geojson` | geoBoundaries TUR ADM2 + ADM1 (commit `9469f09`) | ODbL 1.0 (ADM2), CC-BY-SA 2.0 (ADM1) | 143 districts in 14 provinces (İstanbul 39). Coverage-simplified at about 200 m. Names normalized: "Prince Islands" → "Adalar", "X (merkez)" → "Merkez" |
| `districtCells` | `district-cells.f32` | Derived from `districts` | ODbL 1.0 | 1 km grid; value = district `index`, NaN outside districts |
| `population` | `population.f32` | WorldPop Global2 R2025A, Türkiye 2025, 1 km, constrained, UN-adjusted | CC-BY 4.0 | 26.37 M people in the region (İstanbul 16.14 M; TÜİK ADNKS 2024: 15.70 M). Replaces the planned GHSL + TÜİK scaling: WorldPop is already calibrated and small |
| `districtStats` | `district-stats.json` | İBB Açık Veri "2017 Yılı Mahalle Bazlı Bina Sayıları" + `population` | İBB Açık Veri Lisansı | İstanbul: observed buildings by period and storeys (1.166 M; Eyüp → Eyüpsultan alias; Windows-1254 CSV). Other provinces: **estimated** from İstanbul districts below 2,000 people/km² (6.51 persons per building), marked `buildingSource: "estimated"` |
| `vs30` | `vs30.f32` | USGS Global Vs30 mosaic (`global_vs30.grd`, 610 MB, cached) | Public domain | Averaged to 1 km; 180–900 m/s, median 544 |
| `vs30World` | `vs30-world/index.json` + 541 tiles `<N|S>lat<E|W>lon.u8.gz` (5 MB) | Same USGS mosaic | Public domain | Averaged to 0.05°, 10° tiles of 200 × 200 cells, one byte per cell on a log scale 100–2000 m/s (1.2 % steps, 0 = no data), stored gzipped (the client inflates them; the build does not add a copy). The simulation worker fetches the tiles under the event grid. |
| `stations` | `stations.json` | FDSN station services: KOERI EIDA node (KO) + EIDA federator (others) | Open access via EIDA; cite network DOIs | 81 permanent stations (KO 77, TK 1, TU 1, HT 1, HI 1), 50 with accelerometers. Temporary networks (codes starting with a digit or X/Y/Z, e.g. ZQ, 6G) excluded |
| `elevation` | `elevation.f32` | Copernicus DEM GLO-90 COG tiles on AWS (`copernicus-dem-90m`), doi:10.5270/ESA-c5d3d65 | Copernicus DEM licence (free, attribution) | 15 tiles averaged to 1 km; sea 0 m; max 2,433 m. Lifts 3D scenario elements onto the terrain (phase 2) |
| `bathymetry` | `bathymetry.f32` | EMODnet Bathymetry DTM via WCS (`emodnet:mean`) | CC-BY 4.0 | 500 m grid; elevation m, NaN on land; Çınarcık Basin below −1,000 m. Used by the tsunami solver (phase 7), loaded with the scenario inputs |
| `infra` | `infra.geojson` | OpenStreetMap, Geofabrik Türkiye extract | ODbL 1.0 | 705 hospitals, 184 fire stations, 499 police, 575 assembly points, 2,118 substations (points; areas reduced to centroids), 226 gas pipelines. İBB has no assembly-area dataset in its CKAN catalog |
| `roads` | `roads.bin` | OpenStreetMap, Geofabrik Türkiye extract | ODbL 1.0 | motorway…tertiary (+ links): 194,810 nodes, 354,612 directed edges, 5.6 MB. Flags: bridge, tunnel, one-way, link |
| `cells` | `cells.bin` | OpenCelliD, MCC 286 | CC-BY-SA 4.0 | **Pending:** needs a free API key in `pipeline/.env` (`OPENCELLID_API_KEY`). Module and tests are ready; the app treats cells as optional |

| `vulnerability` | `vulnerability.json` | GEM Global Vulnerability Model, release `v2026.0.0`, `Europe/Turkey` structural and fatality NRML (Nafeh, Aljawhari and Silva, 2025, doi:10.5281/zenodo.8391742) | **CC BY-NC-SA 4.0** (non-commercial; derived file under the same licence) | 10 functions: CR/LFINF with CDL+ERL, CDM+ERL, CDM+ERM × H:3, 6, 10 (RES) and CDM+ERM/H:3/COM for facilities; mean loss ratios only. Commercial use of quakeTrace would need a GEM licence |

Test fixtures (`uv run quaketrace-pipeline fixtures`, written to `tests/fixtures/`): `gmpe/asb14-rjb-mean.json`, the 540-row ASB14 Rjb verification table from OpenQuake hazardlib `v3.26.2` (PGA, PGV, SA 0.3, 0.6 and 1.0 s medians); `damage/ibb-2019-scenario.json`, the İBB 2019 scenario (Mw 7.5, night) summed per İstanbul district (very heavy, heavy, moderate, light damage, fatalities), each with source URL inside the file.

Validation-only source (phase 5, used): İBB Açık Veri "Deprem Senaryosu Analiz Sonuçları" (959 neighbourhoods, Windows-1254 CSV; totals 13,496 very heavy and 34,334 heavy damaged buildings, 14,145 fatalities).

## Runtime services

Probed on 2026-10-25 (phase 0 spike).

| Service | Use | Access | Findings |
|---|---|---|---|
| OpenFreeMap | Basemap vector tiles and styles | Direct, keyless | `https://tiles.openfreemap.org/styles/{dark,positron,…}`, CORS `*` |
| AWS Terrain Tiles (Terrarium) | 3D terrain DEM | Direct, keyless | `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`, CORS `*` |
| USGS earthquake feeds | Live events | Direct | GeoJSON summary feeds, CORS `*` |
| EMSC seismicportal | Live events | Direct | FDSN event `format=json` returns GeoJSON, CORS `*`; WebSocket push still to verify in phase 9 |
| AFAD event API | Live events (Türkiye) | Proxy `/api/afad` | `deprem.afad.gov.tr/apiv2/event/filter` redirects to `servisnet.afad.gov.tr/apigateway/deprem/apiv2/event/filter`. No CORS. A WAF rejects non-browser user agents, so the proxy sends a browser-like `User-Agent`. JSON array; numbers are strings (`latitude`, `magnitude`, `depth`) |
| Kandilli (KOERI) | Live events (Türkiye) | Proxy `/api/kandilli` | `www.koeri.boun.edu.tr/scripts/lst0.asp`, HTML with a `<pre>` list, `windows-1254` encoding, no CORS |
| KOERI EIDA FDSN | Station metadata and waveforms | Proxy `/api/koeri` | `http://eida-service.koeri.boun.edu.tr/fdsnws/…`, HTTP only (no TLS), so browsers block it as mixed content. CORS `*`. 77 open KO stations in the Marmara box with HH (broadband) and HN (accelerometer) channels. Dataselect latency about 3–10 min (204 at 3 min, data at 10 min) |
| EIDA federator (ORFEUS) | Station metadata and waveforms | Direct | `https://federator.orfeus-eu.org/fdsnws/…`, CORS reflects origin. Only 5 KO and 1 TK stations in the box, so KOERI direct is the main source |
| GEOFON | Station metadata | Direct | No GE stations inside the Marmara box |

AFAD strong-motion network (TK) is mostly absent from EIDA; observed records come from KOERI only.

Used in phase 9 (2026-10-26):

- Live catalogs: USGS FDSN event (GeoJSON) and EMSC FDSN event (`format=json`) directly; AFAD apiv2 `event/filter` and Kandilli `lst0.asp` through the proxy. AFAD dates carry no zone and are UTC (they match EMSC for the same event); Kandilli lists Türkiye local time (UTC+3 all year since 2016) in Windows-1254 with ASCII upper-case places, magnitude Mw > ML > MD. All validated with zod; region 26–31° E, 39.8–41.8° N, last 7 days, polled every 60 s while the live tab is open. AFAD's archive query for 2019/2025 returned nothing, so historical parameters come from USGS.
- Historical replays (USGS ComCat): usp0009d4z 1999-08-17 00:01:39.13 UTC Mw 7.6 (mwc) 40.748 N 29.864 E 17 km; us70005lkl 2019-09-26 10:59:25.648 UTC Mw 5.7 (mww) 40.904 N 28.150 E 8 km; us7000pufs 2025-04-23 09:49:11.631 UTC Mw 6.2 (mww) 40.834 N 28.190 E 12.7 km.
- Observed records: KOERI EIDA `dataselect` (HN?, miniSEED Steim2) and `station` (level=channel, InstrumentSensitivity in counts per m/s²) for the 24 nearest accelerometer stations within 200 km that operated at the origin time (metadata read first). 2025: 22 stations with data; 2019: 6; 1999: none. Counts → cm/s² after removing the 10 s pre-event mean (flat-response approximation).
- Fixtures of every response are in `tests/fixtures/feeds/` with their requests in its README.

## Handling rules

- Raw downloads go to `pipeline/.cache/` (ignored by Git; about 1.3 GB with the OSM extract and the Vs30 grid). Only prepared outputs are committed.
- Every prepared file is listed in `public/data/manifest.json` with size, SHA-256, generation time, sources and licenses; `.gitattributes` keeps `public/data/**` byte-exact.
- Pinned upstream versions where the source allows it (geoBoundaries commit). Moving sources (OSM, stations) are refreshed by rebuilding; station queries are cached per day.
- Real data is always labeled with its source in the interface; simulated data is always labeled as simulation.
- Live services are never called from tests; recorded responses live in `tests/fixtures/feeds/`.
