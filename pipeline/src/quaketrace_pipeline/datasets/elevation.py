"""Ground elevation on the 1 km grid from the Copernicus DEM GLO-90 (cloud-optimized tiles).

Used to lift 3D map elements (wavefront rings) onto the terrain; deck.gl layers are not draped
on MapLibre terrain. Sea pixels are 0 m in the source and stay 0.
"""

import math
from pathlib import Path

import httpx
import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.warp import Resampling, reproject

from ..config import OUTPUT_DIR, REGION
from ..download import fetch
from ..grid import GRID_1KM, write_float32_grid
from ..manifest import Source, record

TILE_URL = "https://copernicus-dem-90m.s3.amazonaws.com/{name}/{name}.tif"  # 1° x 1° tiles
SOURCE = Source(
    name="Copernicus DEM GLO-90",
    url="https://doi.org/10.5270/ESA-c5d3d65",
    license="Copernicus DEM licence (free, attribution required)",
    attribution=(
        "© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under "
        "COPERNICUS by the European Union and ESA"
    ),
)
OUTPUT_FILE = "elevation.f32"
WGS84 = CRS.from_epsg(4326)
HTTP_NOT_FOUND = 404


def tile_name(lat: int, lon: int) -> str:
    ns = "N" if lat >= 0 else "S"
    ew = "E" if lon >= 0 else "W"
    return f"Copernicus_DSM_COG_30_{ns}{abs(lat):02d}_00_{ew}{abs(lon):03d}_00_DEM"


def region_tiles() -> list[tuple[int, int]]:
    lats = range(math.floor(REGION.south), math.ceil(REGION.north))
    lons = range(math.floor(REGION.west), math.ceil(REGION.east))
    return [(lat, lon) for lat in lats for lon in lons]


def fetch_tile(lat: int, lon: int) -> Path | None:
    """All-sea tiles do not exist upstream (HTTP 404); those return None."""
    name = tile_name(lat, lon)
    try:
        return fetch(TILE_URL.format(name=name), f"copernicus-dem/{name}.tif")
    except httpx.HTTPStatusError as error:
        if error.response.status_code == HTTP_NOT_FOUND:
            return None
        raise


def mosaic(paths: list[Path]) -> np.ndarray:
    destination = np.zeros(GRID_1KM.shape, dtype=np.float32)
    for path in paths:
        tile = np.full(GRID_1KM.shape, np.nan, dtype=np.float32)
        with rasterio.open(path) as src:
            reproject(
                source=rasterio.band(src, 1),
                destination=tile,
                src_crs=src.crs or WGS84,
                src_nodata=src.nodata,
                dst_transform=GRID_1KM.transform,
                dst_crs=WGS84,
                dst_nodata=np.nan,
                resampling=Resampling.average,
            )
        covered = np.isfinite(tile)
        destination[covered] = tile[covered]
    return destination


def build(output_dir: Path = OUTPUT_DIR) -> None:
    paths = [path for lat, lon in region_tiles() if (path := fetch_tile(lat, lon)) is not None]
    values = mosaic(paths)
    write_float32_grid(output_dir / OUTPUT_FILE, GRID_1KM, values)
    record(
        output_dir,
        "elevation",
        OUTPUT_FILE,
        format="float32-grid",
        grid=GRID_1KM,
        units="m above sea level",
        sources=[SOURCE],
        stats={"tiles": len(paths), "max": round(float(values.max()), 1)},
    )
