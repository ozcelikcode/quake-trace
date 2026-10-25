"""Time-averaged shear-wave velocity in the top 30 m (Vs30) from the USGS Global Vs30 model.

The global model infers Vs30 from topographic slope (Wald and Allen, 2007; Allen and Wald, 2009).
It is averaged onto the 1 km grid.
"""

from pathlib import Path

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.warp import Resampling, reproject

from ..config import OUTPUT_DIR
from ..download import fetch
from ..grid import GRID_1KM, write_float32_grid
from ..manifest import Source, record

URL = "https://apps.usgs.gov/shakemap_geodata/vs30/global_vs30.grd"
SOURCE = Source(
    name="USGS Global Vs30 Mosaic",
    url="https://earthquake.usgs.gov/data/vs30/",
    license="Public domain (U.S. Government work)",
    attribution="U.S. Geological Survey, Global Vs30 (Heath et al., 2020)",
)
OUTPUT_FILE = "vs30.f32"
WGS84 = CRS.from_epsg(4326)


def resample(path: Path) -> np.ndarray:
    destination = np.full(GRID_1KM.shape, np.nan, dtype=np.float32)
    with rasterio.open(path) as src:
        reproject(
            source=rasterio.band(src, 1),
            destination=destination,
            src_crs=src.crs or WGS84,
            src_nodata=src.nodata,
            dst_transform=GRID_1KM.transform,
            dst_crs=WGS84,
            dst_nodata=np.nan,
            resampling=Resampling.average,
        )
    destination[destination <= 0] = np.nan
    return destination


def build(output_dir: Path = OUTPUT_DIR) -> None:
    values = resample(fetch(URL, "global_vs30.grd"))
    write_float32_grid(output_dir / OUTPUT_FILE, GRID_1KM, values)
    finite = values[np.isfinite(values)]
    record(
        output_dir,
        "vs30",
        OUTPUT_FILE,
        format="float32-grid",
        grid=GRID_1KM,
        units="m/s",
        sources=[SOURCE],
        stats={
            "min": round(float(finite.min()), 1),
            "median": round(float(np.median(finite)), 1),
            "max": round(float(finite.max()), 1),
        },
    )
