"""District (ilçe) boundaries from geoBoundaries, plus a grid mapping engine cells to districts.

Outputs:
- districts.geojson: districts whose representative point lies in the region, sorted by province
  and name, each with an `index` property.
- district-cells.f32: on the 1 km grid, the `index` of the district containing each cell centre,
  NaN outside every district (sea, neighbouring countries).
"""

import re
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
import shapely
from rasterio.features import rasterize

from ..config import OUTPUT_DIR, REGION
from ..download import fetch
from ..geojson import round_coordinates, write_collection
from ..grid import GRID_1KM, write_float32_grid
from ..manifest import Source, record

GEOBOUNDARIES_BASE = "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TUR"
ADM1_URL = f"{GEOBOUNDARIES_BASE}/ADM1/geoBoundaries-TUR-ADM1.geojson"
ADM2_URL = f"{GEOBOUNDARIES_BASE}/ADM2/geoBoundaries-TUR-ADM2.geojson"

ADM2_SOURCE = Source(
    name="geoBoundaries TUR ADM2 (districts), 2021",
    url="https://www.geoboundaries.org",
    license="ODbL-1.0",
    attribution="geoBoundaries (Runfola et al., 2020); data © OpenStreetMap contributors",
)
ADM1_SOURCE = Source(
    name="geoBoundaries TUR ADM1 (provinces), 2021",
    url="https://www.geoboundaries.org",
    license="CC-BY-SA-2.0",
    attribution="geoBoundaries (Runfola et al., 2020); data © OpenStreetMap contributors",
)

OUTPUT_FILE = "districts.geojson"
CELLS_FILE = "district-cells.f32"

# About 200 m; shared borders stay shared because the coverage is simplified as a whole.
SIMPLIFY_TOLERANCE_DEG = 0.002

# geoBoundaries mixes a few English and descriptive names into the OSM-derived set.
NAME_OVERRIDES = {"Prince Islands": "Adalar"}
CENTRAL_DISTRICT = re.compile(r"^\S+\s*\(?merkez\)?$", re.IGNORECASE)


def normalize_name(name: str) -> str:
    """Official (TÜİK) district names: central districts are called "Merkez"."""
    name = NAME_OVERRIDES.get(name.strip(), name.strip())
    return "Merkez" if CENTRAL_DISTRICT.match(name) else name


def select_districts(adm2: gpd.GeoDataFrame, adm1: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    points = adm2.geometry.representative_point()
    in_region = points.within(shapely.box(*REGION.as_tuple()))
    districts = adm2.loc[in_region].copy()
    districts["point"] = points[in_region]

    provinces = gpd.GeoDataFrame(
        {"province": adm1["shapeName"]}, geometry=adm1.geometry, crs=adm1.crs
    )
    joined = gpd.sjoin(
        districts.set_geometry("point"), provinces, how="left", predicate="within"
    ).drop(columns=["index_right"])
    joined = joined.set_geometry("geometry").drop(columns=["point"])
    joined = joined.sort_values(["province", "shapeName"]).reset_index(drop=True)
    joined["geometry"] = shapely.coverage_simplify(
        joined.geometry.to_numpy(), SIMPLIFY_TOLERANCE_DEG
    )
    return joined


def to_features(districts: gpd.GeoDataFrame) -> list[dict[str, Any]]:
    features: list[dict[str, Any]] = []
    rows = zip(
        districts.geometry,
        districts["shapeID"],
        districts["shapeName"],
        districts["province"],
        strict=True,
    )
    for index, (shape, shape_id, name, province) in enumerate(rows):
        geometry = shapely.geometry.mapping(shape)
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": geometry["type"],
                    "coordinates": round_coordinates(geometry["coordinates"]),
                },
                "properties": {
                    "index": index,
                    "id": str(shape_id),
                    "name": normalize_name(str(name)),
                    "province": str(province),
                },
            }
        )
    return features


def district_cells(districts: gpd.GeoDataFrame) -> np.ndarray:
    shapes = ((geometry, index) for index, geometry in enumerate(districts.geometry))
    burned = rasterize(
        shapes,
        out_shape=GRID_1KM.shape,
        transform=GRID_1KM.transform,
        fill=-1,
        dtype="int32",
    )
    cells = np.asarray(burned, dtype=np.float32)
    cells[cells < 0] = np.nan
    return cells


def build(output_dir: Path = OUTPUT_DIR) -> None:
    adm2 = gpd.read_file(fetch(ADM2_URL, "geoBoundaries-TUR-ADM2.geojson"))
    adm1 = gpd.read_file(fetch(ADM1_URL, "geoBoundaries-TUR-ADM1.geojson"))
    districts = select_districts(adm2, adm1)
    if bool(districts["province"].isna().any()):
        missing = districts.loc[districts["province"].isna(), "shapeName"].tolist()
        raise ValueError(f"districts without a province: {missing}")

    features = to_features(districts)
    write_collection(output_dir / OUTPUT_FILE, features)
    record(
        output_dir,
        "districts",
        OUTPUT_FILE,
        format="geojson",
        sources=[ADM2_SOURCE, ADM1_SOURCE],
        stats={"features": len(features), "provinces": districts["province"].nunique()},
    )

    cells = district_cells(districts)
    write_float32_grid(output_dir / CELLS_FILE, GRID_1KM, cells)
    record(
        output_dir,
        "districtCells",
        CELLS_FILE,
        format="float32-grid",
        grid=GRID_1KM,
        units="district index",
        notes="Index into districts.geojson features (property `index`); NaN outside districts.",
        sources=[ADM2_SOURCE],
        stats={"cellsInDistricts": int(np.isfinite(cells).sum())},
    )
