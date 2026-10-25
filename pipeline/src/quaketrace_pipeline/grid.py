"""Regular longitude/latitude grids and their binary encoding.

Grids are stored north-up: row 0 is the northern edge, columns run west to east. Values are
little-endian float32, row-major, with NaN for no data. The same layout is decoded by
src/data/grid.ts.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt
from affine import Affine

from .config import REGION

FloatArray = npt.NDArray[np.float64]


@dataclass(frozen=True)
class GridSpec:
    id: str
    west: float
    north: float
    d_lon: float
    d_lat: float
    nx: int
    ny: int

    @property
    def east(self) -> float:
        return self.west + self.nx * self.d_lon

    @property
    def south(self) -> float:
        return self.north - self.ny * self.d_lat

    @property
    def shape(self) -> tuple[int, int]:
        return (self.ny, self.nx)

    @property
    def transform(self) -> Affine:
        return Affine(self.d_lon, 0.0, self.west, 0.0, -self.d_lat, self.north)

    def cell_index(
        self, lons: FloatArray, lats: FloatArray
    ) -> tuple[npt.NDArray[np.intp], npt.NDArray[np.intp], npt.NDArray[np.bool_]]:
        """Column, row and an in-grid mask for each point."""
        ix = np.floor((lons - self.west) / self.d_lon).astype(np.intp)
        iy = np.floor((self.north - lats) / self.d_lat).astype(np.intp)
        inside = (ix >= 0) & (ix < self.nx) & (iy >= 0) & (iy < self.ny)
        return ix, iy, inside

    def to_manifest(self) -> dict[str, Any]:
        return {
            "west": self.west,
            "north": self.north,
            "dLon": self.d_lon,
            "dLat": self.d_lat,
            "nx": self.nx,
            "ny": self.ny,
            "rowOrder": "north-to-south",
            "encoding": "float32-le",
        }


def _grid(grid_id: str, step: float) -> GridSpec:
    nx = round((REGION.east - REGION.west) / step)
    ny = round((REGION.north - REGION.south) / step)
    return GridSpec(grid_id, REGION.west, REGION.north, step, step, nx, ny)


# About 1 km (engine grid) and about 500 m (tsunami grid).
GRID_1KM = _grid("marmara-1km", 0.01)
GRID_500M = _grid("marmara-500m", 0.005)
GRIDS = (GRID_1KM, GRID_500M)


def aggregate_sum(
    grid: GridSpec, lons: FloatArray, lats: FloatArray, values: FloatArray
) -> FloatArray:
    """Sums point values into the cells that contain them; totals inside the grid are kept."""
    ix, iy, inside = grid.cell_index(lons, lats)
    valid = inside & np.isfinite(values)
    out = np.zeros(grid.shape, dtype=np.float64)
    np.add.at(out, (iy[valid], ix[valid]), values[valid])
    return out


def write_float32_grid(path: Path, grid: GridSpec, values: npt.ArrayLike) -> None:
    array = np.asarray(values, dtype="<f4")
    if array.shape != grid.shape:
        raise ValueError(f"expected shape {grid.shape} for {grid.id}, got {array.shape}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(np.ascontiguousarray(array).tobytes(order="C"))


def read_float32_grid(path: Path, grid: GridSpec) -> npt.NDArray[np.float32]:
    return np.frombuffer(path.read_bytes(), dtype="<f4").reshape(grid.shape)
