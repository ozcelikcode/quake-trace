"""Population and province of every 2 km cell in Türkiye, for shaking exposure.

Population: WorldPop Global2 R2025A (2025, constrained, UN-adjusted, 30 arc-seconds) summed into
the cells that contain the pixel centres, as for the Marmara grid. Provinces: geoBoundaries
ADM1 rasterised at cell centres; `turkey-provinces.json` maps the index to the name.
"""

import json
from pathlib import Path

import geopandas as gpd
import numpy as np
import rasterio
from rasterio.features import rasterize
from rasterio.windows import from_bounds

from ..config import OUTPUT_DIR
from ..download import fetch
from ..grid import GRID_TURKEY, aggregate_sum, write_float32_grid
from ..manifest import record
from . import districts, population

POPULATION_FILE = "turkey-population.f32"
PROVINCE_FILE = "turkey-provinces.f32"
NAMES_FILE = "turkey-provinces.json"


def population_grid() -> np.ndarray:
    path = fetch(population.URL, "tur_pop_2025_CN_1km_R2025A_UA_v1.tif")
    with rasterio.open(path) as src:
        bounds = (GRID_TURKEY.west, GRID_TURKEY.south, GRID_TURKEY.east, GRID_TURKEY.north)
        window = from_bounds(*bounds, transform=src.transform).round_offsets().round_lengths()
        data = src.read(1, window=window, boundless=True, fill_value=0).astype(np.float64)
        transform = src.window_transform(window)
    data[~np.isfinite(data) | (data < 0)] = 0.0
    rows, cols = np.indices(data.shape)
    lons, lats = transform * (cols + 0.5, rows + 0.5)
    return aggregate_sum(
        GRID_TURKEY, np.asarray(lons).ravel(), np.asarray(lats).ravel(), data.ravel()
    )


def province_grid(provinces: gpd.GeoDataFrame) -> np.ndarray:
    shapes = ((geometry, index) for index, geometry in enumerate(provinces.geometry))
    raster = rasterize(
        shapes,
        out_shape=GRID_TURKEY.shape,
        transform=GRID_TURKEY.transform,
        fill=-1,
        dtype="int16",
    ).astype(np.float32)
    raster[raster < 0] = np.nan
    return raster


def build(output_dir: Path = OUTPUT_DIR) -> None:
    provinces = gpd.read_file(fetch(districts.ADM1_URL, "geoBoundaries-TUR-ADM1.geojson"))
    provinces = provinces.sort_values("shapeName").reset_index(drop=True)
    people = population_grid()
    index = province_grid(provinces)
    write_float32_grid(output_dir / POPULATION_FILE, GRID_TURKEY, people)
    write_float32_grid(output_dir / PROVINCE_FILE, GRID_TURKEY, index)
    names = [{"index": i, "name": str(name)} for i, name in enumerate(provinces["shapeName"])]
    (output_dir / NAMES_FILE).write_text(
        json.dumps({"provinces": names}, ensure_ascii=False) + "\n", "utf-8"
    )
    record(
        output_dir,
        "turkeyPopulation",
        POPULATION_FILE,
        format="float32-grid",
        grid=GRID_TURKEY,
        units="residents per cell",
        sources=[population.SOURCE],
        stats={"total": round(float(people.sum()))},
    )
    record(
        output_dir,
        "turkeyProvinces",
        PROVINCE_FILE,
        format="float32-grid",
        grid=GRID_TURKEY,
        units="province index",
        notes="Index into turkey-provinces.json; NaN outside Türkiye.",
        sources=[districts.ADM1_SOURCE],
        stats={"provinces": len(names)},
    )
    record(
        output_dir,
        "turkeyProvinceNames",
        NAMES_FILE,
        format="json",
        sources=[districts.ADM1_SOURCE],
    )
