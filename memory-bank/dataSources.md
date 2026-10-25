# Data Sources

Every dataset and feed used by quakeTrace, with license and handling. Add a row before using anything new. Attribution is mirrored in `public/data/ATTRIBUTION.md` and the in-app About page.

## Prepared datasets (`pipeline/` → `public/data/`)

| Output | Source | License | Notes |
|---|---|---|---|
| `faults.geojson` | EFSM20 (EFEHR); GEM Global Active Faults | CC-BY 4.0; CC-BY-SA 4.0 | Marmara segments with dip, seismogenic depths, rake, slip rate |
| `districts.geojson` | geoBoundaries ADM2 | CC-BY 4.0 | Marmara provinces, simplified with mapshaper |
| `population.bin` | GHSL GHS-POP | CC-BY 4.0 | District totals scaled to TÜİK ADNKS 2024 |
| `vs30.bin` | USGS Global Vs30 (topographic slope) | Public domain | Resampled to the engine grid |
| `buildings.json` | İBB Open Data "Deprem Senaryosu Analiz Sonuçları"; TÜİK building statistics outside İstanbul | İBB open data license; TÜİK terms | Building counts by type and construction period |
| `stations.json` | FDSN station services (KO, TK, GE and others) | Network-specific open data terms | Coordinates, sensor type, network codes |
| `cells.bin` | OpenCelliD (MCC 286) | CC-BY-SA 4.0 | Cells within 50 m merged into sites; derived data shared alike |
| `roads.bin` | OpenStreetMap via Geofabrik | ODbL 1.0 | motorway to tertiary, bridge flags; CSR graph |
| `infra.geojson` | OpenStreetMap; İBB assembly areas | ODbL 1.0; İBB open data license | Hospitals, fire stations, police, schools, bridges, pipelines |
| `bathymetry.bin` | EMODnet Bathymetry DTM | CC-BY 4.0 | About 500 m tsunami grid |
| `tests/fixtures/gmpe/*.json` | OpenQuake hazardlib | AGPL-3.0 tool; generated numbers only | Reference values for unit tests |

Status: none prepared yet. Verify each source's availability, exact license text and download path during phase 1, then update this table.

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

AFAD strong-motion network (TK) is mostly absent from EIDA; its own services are to be evaluated in phase 9.

## Handling rules

- Raw downloads go to `pipeline/.cache/` (ignored by Git). Only prepared outputs are committed.
- Every prepared file is listed in `public/data/manifest.json` with version, source, license and generation date.
- Real data is always labeled with its source in the interface; simulated data is always labeled as simulation.
- Live services are never called from tests; recorded responses live in `tests/fixtures/feeds/`.
