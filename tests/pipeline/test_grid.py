from pathlib import Path

import numpy as np
import pytest

from quaketrace_pipeline.datasets.vs30_world import decode, encode, tile_name
from quaketrace_pipeline.grid import (
    GRID_1KM,
    GRID_500M,
    GridSpec,
    aggregate_sum,
    read_float32_grid,
    write_float32_grid,
)

SMALL = GridSpec("test", west=26.0, north=41.0, d_lon=0.5, d_lat=0.5, nx=4, ny=2)


def test_regional_grids_cover_the_engine_extent() -> None:
    for grid in (GRID_1KM, GRID_500M):
        assert grid.west == pytest.approx(26.0)
        assert grid.east == pytest.approx(31.0)
        assert grid.south == pytest.approx(39.8)
        assert grid.north == pytest.approx(41.8)
    assert GRID_1KM.shape == (200, 500)
    assert GRID_500M.shape == (400, 1000)


def test_cell_index_is_north_up() -> None:
    ix, iy, inside = SMALL.cell_index(np.array([26.1, 27.9, 25.0]), np.array([40.9, 40.1, 40.5]))
    assert ix[:2].tolist() == [0, 3]
    assert iy[:2].tolist() == [0, 1]
    assert inside.tolist() == [True, True, False]


def test_aggregate_sum_keeps_totals_inside_the_grid() -> None:
    lons = np.array([26.1, 26.2, 27.6, 30.0])
    lats = np.array([40.9, 40.8, 40.2, 40.5])
    values = np.array([1.0, 2.0, 4.0, 100.0])
    out = aggregate_sum(SMALL, lons, lats, values)
    assert out[0, 0] == 3.0
    assert out[1, 3] == 4.0
    assert out.sum() == 7.0


def test_float32_grid_round_trip(tmp_path: Path) -> None:
    values = np.arange(8, dtype=np.float64).reshape(SMALL.shape)
    values[0, 1] = np.nan
    path = tmp_path / "grid.f32"
    write_float32_grid(path, SMALL, values)
    assert path.stat().st_size == 8 * 4
    restored = read_float32_grid(path, SMALL)
    np.testing.assert_array_equal(restored, values.astype(np.float32))


def test_write_rejects_wrong_shape(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="expected shape"):
        write_float32_grid(tmp_path / "bad.f32", SMALL, np.zeros((4, 2)))


def test_vs30_world_encoding_round_trips_within_one_step() -> None:
    values = np.array([150.0, 360.0, 760.0, 1500.0, np.nan], dtype=np.float32)
    restored = decode(encode(values))
    assert np.allclose(restored[:4], values[:4], rtol=0.013)
    assert np.isnan(restored[4])
    assert tile_name(40, 20) == "N40E020"
    assert tile_name(-10, -80) == "S10W080"
