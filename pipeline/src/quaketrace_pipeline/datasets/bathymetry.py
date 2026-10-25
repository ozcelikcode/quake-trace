"""Sea-floor elevation on the 500 m grid from the EMODnet Bathymetry DTM (WCS subset).

Values are elevations in metres (negative below sea level); land and missing cells are NaN.
"""

from pathlib import Path

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.warp import Resampling, reproject

from ..config import OUTPUT_DIR, REGION
from ..download import fetch
from ..grid import GRID_500M, write_float32_grid
from ..manifest import Source, record

WCS_URL = "https://ows.emodnet-bathymetry.eu/wcs"
SOURCE = Source(
    name="EMODnet Digital Bathymetry (DTM)",
    url="https://emodnet.ec.europa.eu/en/bathymetry",
    license="CC-BY-4.0",
    attribution="EMODnet Bathymetry Consortium, EMODnet Digital Bathymetry (DTM)",
)
OUTPUT_FILE = "bathymetry.f32"
WGS84 = CRS.from_epsg(4326)

# Request at twice the target resolution, then average down.
REQUEST_OVERSAMPLE = 2


def wcs_params() -> dict[str, str]:
    return {
        "service": "WCS",
        "version": "1.0.0",
        "request": "GetCoverage",
        "coverage": "emodnet:mean",
        "crs": "EPSG:4326",
        "bbox": ",".join(str(v) for v in REGION.as_tuple()),
        "format": "image/tiff",
        "width": str(GRID_500M.nx * REQUEST_OVERSAMPLE),
        "height": str(GRID_500M.ny * REQUEST_OVERSAMPLE),
    }


def resample(path: Path) -> np.ndarray:
    destination = np.full(GRID_500M.shape, np.nan, dtype=np.float32)
    with rasterio.open(path) as src:
        reproject(
            source=rasterio.band(src, 1),
            destination=destination,
            src_crs=src.crs or WGS84,
            src_nodata=src.nodata,
            dst_transform=GRID_500M.transform,
            dst_crs=WGS84,
            dst_nodata=np.nan,
            resampling=Resampling.average,
        )
    destination[destination >= 0] = np.nan
    return destination


def build(output_dir: Path = OUTPUT_DIR) -> None:
    path = fetch(WCS_URL, "emodnet-bathymetry-marmara.tif", params=wcs_params())
    values = resample(path)
    write_float32_grid(output_dir / OUTPUT_FILE, GRID_500M, values)
    sea = values[np.isfinite(values)]
    record(
        output_dir,
        "bathymetry",
        OUTPUT_FILE,
        format="float32-grid",
        grid=GRID_500M,
        units="m (elevation, negative below sea level)",
        sources=[SOURCE],
        stats={"seaCells": int(sea.size), "minElevation": round(float(sea.min()), 1)},
    )
