"""Sanity checks on the committed outputs in public/data (no network access needed)."""

import hashlib
import json
from typing import Any

import numpy as np
import pytest

from quaketrace_pipeline.config import OUTPUT_DIR
from quaketrace_pipeline.grid import GRID_1KM, GRID_500M, GridSpec, read_float32_grid

MANIFEST: dict[str, Any] = json.loads((OUTPUT_DIR / "manifest.json").read_text("utf-8"))
DATASETS: dict[str, Any] = MANIFEST["datasets"]


def value_at(dataset: str, grid: GridSpec, lon: float, lat: float) -> float:
    values = read_float32_grid(OUTPUT_DIR / DATASETS[dataset]["path"], grid)
    ix, iy, inside = grid.cell_index(np.array([lon]), np.array([lat]))
    assert inside[0]
    return float(values[iy[0], ix[0]])


@pytest.mark.parametrize("dataset_id", sorted(DATASETS))
def test_files_match_manifest(dataset_id: str) -> None:
    entry = DATASETS[dataset_id]
    data = (OUTPUT_DIR / entry["path"]).read_bytes()
    assert len(data) == entry["bytes"]
    assert hashlib.sha256(data).hexdigest() == entry["sha256"]
    assert entry["sources"], "every dataset names its source"


def test_population_is_dense_in_istanbul_and_zero_at_sea() -> None:
    assert value_at("population", GRID_1KM, 28.95, 41.01) > 5_000  # Fatih
    assert value_at("population", GRID_1KM, 28.0, 40.75) == 0  # Sea of Marmara


def test_bathymetry_is_north_up() -> None:
    # Çınarcık Basin is over 1,000 m deep; the Sea of Marmara lies south of İstanbul.
    assert value_at("bathymetry", GRID_500M, 29.0, 40.75) < -1_000
    assert np.isnan(value_at("bathymetry", GRID_500M, 28.95, 41.01))  # land


def test_vs30_is_stiffer_on_uludag_than_on_the_adapazari_basin() -> None:
    assert value_at("vs30", GRID_1KM, 29.13, 40.07) > value_at("vs30", GRID_1KM, 30.40, 40.77)


def test_district_cells_point_to_the_right_district() -> None:
    districts = json.loads((OUTPUT_DIR / "districts.geojson").read_text("utf-8"))["features"]
    index = value_at("districtCells", GRID_1KM, 29.03, 40.99)  # Kadıköy
    assert districts[int(index)]["properties"]["name"] == "Kadıköy"
