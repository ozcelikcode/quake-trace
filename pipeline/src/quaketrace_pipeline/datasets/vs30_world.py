"""Worldwide Vs30 tiles from the USGS Global Vs30 model, for shaking outside the regional grid.

The 30 arc-second model (Heath et al., 2020; slope-based where no regional map exists, Wald and
Allen, 2007) is averaged onto 0.05° cells and cut into 10° tiles. Each tile is 200 x 200 cells,
north-up, one byte per cell on a logarithmic scale and gzip-compressed, so a large earthquake
needs a few tiles of tens of kilobytes. `index.json` lists the tiles and the encoding.
"""

import gzip
import json
from pathlib import Path

import numpy as np
import numpy.typing as npt
import rasterio
from rasterio.crs import CRS
from rasterio.transform import from_origin
from rasterio.warp import Resampling, reproject

from ..config import OUTPUT_DIR
from ..download import fetch
from ..manifest import record
from .vs30 import SOURCE, URL

TILE_DEG = 10
CELL_DEG = 0.05
TILE_CELLS = round(TILE_DEG / CELL_DEG)
# Byte 0 means no data; bytes 1 to 255 span MIN_VS30 to MAX_VS30 logarithmically (1.2 % steps).
MIN_VS30 = 100.0
MAX_VS30 = 2000.0
DIRECTORY = "vs30-world"
INDEX_FILE = f"{DIRECTORY}/index.json"
WGS84 = CRS.from_epsg(4326)


def encode(values: npt.NDArray[np.float32]) -> npt.NDArray[np.uint8]:
    scaled = (np.log(np.clip(values, MIN_VS30, MAX_VS30)) - np.log(MIN_VS30)) / (
        np.log(MAX_VS30) - np.log(MIN_VS30)
    )
    codes = 1 + np.rint(scaled * 254)
    return np.where(np.isfinite(values) & (values > 0), codes, 0).astype(np.uint8)


def decode(codes: npt.NDArray[np.uint8]) -> npt.NDArray[np.float32]:
    values = MIN_VS30 * np.exp((codes.astype(np.float32) - 1) / 254 * np.log(MAX_VS30 / MIN_VS30))
    return np.where(codes == 0, np.nan, values).astype(np.float32)


def tile_name(south: int, west: int) -> str:
    return f"{'N' if south >= 0 else 'S'}{abs(south):02d}{'E' if west >= 0 else 'W'}{abs(west):03d}"


def world_grid(path: Path) -> npt.NDArray[np.float32]:
    """The model averaged onto 0.05° cells covering the globe, north-up from 90° N."""
    destination = np.full((round(180 / CELL_DEG), round(360 / CELL_DEG)), np.nan, np.float32)
    with rasterio.open(path) as src:
        reproject(
            source=rasterio.band(src, 1),
            destination=destination,
            src_crs=src.crs or WGS84,
            src_nodata=src.nodata,
            dst_transform=from_origin(-180, 90, CELL_DEG, CELL_DEG),
            dst_crs=WGS84,
            dst_nodata=np.nan,
            resampling=Resampling.average,
            warp_mem_limit=1024,
        )
    destination[destination <= 0] = np.nan
    return destination


def build(output_dir: Path = OUTPUT_DIR) -> None:
    world = world_grid(fetch(URL, "global_vs30.grd"))
    tile_dir = output_dir / DIRECTORY
    tile_dir.mkdir(parents=True, exist_ok=True)
    for stale in tile_dir.glob("*.u8.gz"):
        stale.unlink()
    tiles: list[str] = []
    for south in range(-90, 90, TILE_DEG):
        for west in range(-180, 180, TILE_DEG):
            row = round((90 - south - TILE_DEG) / CELL_DEG)
            col = round((west + 180) / CELL_DEG)
            values = world[row : row + TILE_CELLS, col : col + TILE_CELLS]
            if not np.isfinite(values).any():
                continue
            name = tile_name(south, west)
            # mtime=0 keeps the bytes, and so the manifest hash, stable across builds.
            data = gzip.compress(encode(values).tobytes(), compresslevel=9, mtime=0)
            (tile_dir / f"{name}.u8.gz").write_bytes(data)
            tiles.append(name)
    index = {
        "tileDeg": TILE_DEG,
        "cellDeg": CELL_DEG,
        "tileCells": TILE_CELLS,
        "encoding": {"minVs30": MIN_VS30, "maxVs30": MAX_VS30, "levels": 255},
        "tiles": tiles,
    }
    (output_dir / INDEX_FILE).write_text(json.dumps(index) + "\n", "utf-8")
    record(
        output_dir,
        "vs30World",
        INDEX_FILE,
        format="vs30-tiles",
        units="m/s",
        sources=[SOURCE],
        notes=(
            "Tiles `<N|S>lat<E|W>lon.u8.gz` (south-west corner) next to the index: 200 x 200 "
            "uint8 cells of 0.05 deg, north-up, gzip; code c > 0 is Vs30 = 100 * 20^((c-1)/254) "
            "m/s, 0 is no data."
        ),
        stats={"tiles": len(tiles)},
    )
