"""Residential population per 1 km cell from WorldPop Global2 R2025A.

The source is the 2025 constrained, UN-adjusted 30 arc-second raster for Türkiye.

Source pixels (30 arc-seconds) are summed into the cells that contain their centres, so the
regional total is preserved.
"""

from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import from_bounds

from ..config import OUTPUT_DIR, REGION
from ..download import fetch
from ..grid import GRID_1KM, aggregate_sum, write_float32_grid
from ..manifest import Source, record

URL = (
    "https://data.worldpop.org/GIS/Population/Global_2015_2030/R2025A/2025/TUR/v1/1km_ua/"
    "constrained/tur_pop_2025_CN_1km_R2025A_UA_v1.tif"
)
SOURCE = Source(
    name="WorldPop Global2 R2025A, Türkiye 2025, 1 km, constrained, UN-adjusted",
    url="https://hub.worldpop.org/geodata/listing?id=135",
    license="CC-BY-4.0",
    attribution="WorldPop (www.worldpop.org), University of Southampton",
)
OUTPUT_FILE = "population.f32"


def pixel_centres(
    path: Path,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Longitudes, latitudes and values of the source pixels around the region."""
    with rasterio.open(path) as src:
        window = from_bounds(*REGION.as_tuple(), transform=src.transform)
        window = window.round_offsets().round_lengths()
        data = src.read(1, window=window).astype(np.float64)
        transform = src.window_transform(window)
        nodata = src.nodata
    # Unpopulated pixels carry the nodata value (a large negative number), not zero.
    invalid = ~np.isfinite(data) | (data < 0)
    if nodata is not None:
        invalid |= data == nodata
    data[invalid] = 0.0
    rows, cols = np.indices(data.shape)
    lons, lats = transform * (cols + 0.5, rows + 0.5)
    return np.asarray(lons).ravel(), np.asarray(lats).ravel(), data.ravel()


def build(output_dir: Path = OUTPUT_DIR) -> None:
    lons, lats, values = pixel_centres(fetch(URL, "tur_pop_2025_CN_1km_R2025A_UA_v1.tif"))
    grid = aggregate_sum(GRID_1KM, lons, lats, values)
    write_float32_grid(output_dir / OUTPUT_FILE, GRID_1KM, grid)
    record(
        output_dir,
        "population",
        OUTPUT_FILE,
        format="float32-grid",
        grid=GRID_1KM,
        units="persons",
        sources=[SOURCE],
        stats={"total": round(float(grid.sum()))},
    )
