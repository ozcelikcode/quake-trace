"""Cell sites from OpenCelliD (Türkiye, MCC 286).

Cells closer than about 50 m are merged into one site. Needs a free OpenCelliD API key in
`OPENCELLID_API_KEY` (environment or pipeline/.env); without it the dataset is skipped.

Binary layout of cells.bin (little-endian; offsets in the manifest `layout`): siteLonLat
float32[2S], siteCellCount uint16[S], siteRangeM uint16[S], siteRadios uint8[S] (bitmask).
"""

import csv
import gzip
import io
import os
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt

from ..config import OUTPUT_DIR, PIPELINE_ROOT, REGION
from ..download import fetch
from ..manifest import Source, record

URL = "https://opencellid.org/ocid/downloads"
SOURCE = Source(
    name="OpenCelliD cell towers, Türkiye (MCC 286)",
    url="https://opencellid.org",
    license="CC-BY-SA-4.0",
    attribution="OpenCelliD Project, licensed under CC BY-SA 4.0",
)
OUTPUT_FILE = "cells.bin"
ENV_KEY = "OPENCELLID_API_KEY"

RADIO_BITS = {"GSM": 1, "UMTS": 2, "LTE": 4, "NR": 8, "CDMA": 16}
# About 50 m at 41° N in each direction.
SITE_BIN_LON_DEG = 0.0006
SITE_BIN_LAT_DEG = 0.00045
UINT16_MAX = 65_535
GZIP_MAGIC = b"\x1f\x8b"


def api_key(env_file: Path = PIPELINE_ROOT / ".env") -> str | None:
    if value := os.environ.get(ENV_KEY):
        return value
    if env_file.exists():
        for line in env_file.read_text("utf-8").splitlines():
            key, _, value = line.partition("=")
            if key.strip() == ENV_KEY and value.strip():
                return value.strip().strip("\"'")
    return None


@dataclass(frozen=True)
class Cell:
    lon: float
    lat: float
    radio: int
    range_m: float


def read_cells(rows: Iterable[list[str]]) -> list[Cell]:
    """Parses OpenCelliD CSV rows (radio, mcc, net, area, cell, unit, lon, lat, range, ...)."""
    cells: list[Cell] = []
    for row in rows:
        if not row or row[0] == "radio":
            continue
        lon, lat = float(row[6]), float(row[7])
        if REGION.contains(lon, lat):
            cells.append(Cell(lon, lat, RADIO_BITS.get(row[0], 0), float(row[8] or 0)))
    return cells


@dataclass
class Sites:
    lon_lat: npt.NDArray[np.float32]
    cell_count: npt.NDArray[np.uint16]
    radios: npt.NDArray[np.uint8]
    range_m: npt.NDArray[np.uint16]


def merge_sites(cells: list[Cell]) -> Sites:
    lons = np.array([c.lon for c in cells])
    lats = np.array([c.lat for c in cells])
    keys = np.column_stack(
        (np.floor(lons / SITE_BIN_LON_DEG), np.floor(lats / SITE_BIN_LAT_DEG))
    ).astype(np.int64)
    _, site_of, counts = np.unique(keys, axis=0, return_inverse=True, return_counts=True)
    site_of = site_of.ravel()
    sites = len(counts)

    lon_sum = np.bincount(site_of, weights=lons, minlength=sites)
    lat_sum = np.bincount(site_of, weights=lats, minlength=sites)
    radios = np.zeros(sites, dtype=np.uint8)
    np.bitwise_or.at(radios, site_of, np.array([c.radio for c in cells], dtype=np.uint8))
    ranges = np.zeros(sites, dtype=np.float64)
    np.maximum.at(ranges, site_of, np.array([c.range_m for c in cells]))

    return Sites(
        lon_lat=np.column_stack((lon_sum / counts, lat_sum / counts)).astype(np.float32).ravel(),
        cell_count=np.minimum(counts, UINT16_MAX).astype(np.uint16),
        radios=radios,
        range_m=np.minimum(ranges, UINT16_MAX).astype(np.uint16),
    )


def encode(sites: Sites) -> tuple[bytes, dict[str, Any]]:
    sections = [
        ("siteLonLat", "float32", sites.lon_lat.astype("<f4")),
        ("siteCellCount", "uint16", sites.cell_count.astype("<u2")),
        ("siteRangeM", "uint16", sites.range_m.astype("<u2")),
        ("siteRadios", "uint8", sites.radios),
    ]
    chunks: list[bytes] = []
    layout: list[dict[str, Any]] = []
    offset = 0
    for name, dtype, array in sections:
        data = np.ascontiguousarray(array).tobytes()
        layout.append(
            {"name": name, "type": dtype, "byteOffset": offset, "length": int(array.size)}
        )
        chunks.append(data)
        offset += len(data)
    return b"".join(chunks), {
        "siteCount": len(sites.cell_count),
        "sections": layout,
        "radioBits": RADIO_BITS,
    }


def build(output_dir: Path = OUTPUT_DIR) -> None:
    key = api_key()
    if key is None:
        print(f"  skipped: set {ENV_KEY} in pipeline/.env (free key at https://opencellid.org)")
        return
    path = fetch(
        URL, "opencellid-286.csv.gz", params={"token": key, "type": "mcc", "file": "286.csv.gz"}
    )
    raw = path.read_bytes()
    if not raw.startswith(GZIP_MAGIC):
        path.unlink()
        raise RuntimeError(f"OpenCelliD did not return a gzip file: {raw[:200]!r}")

    with gzip.open(io.BytesIO(raw), "rt", encoding="utf-8") as text:
        cells = read_cells(csv.reader(text))
    sites = merge_sites(cells)
    data, layout = encode(sites)
    (output_dir / OUTPUT_FILE).write_bytes(data)
    record(
        output_dir,
        "cells",
        OUTPUT_FILE,
        format="binary-table",
        sources=[SOURCE],
        layout=layout,
        stats={"cells": len(cells), "sites": layout["siteCount"]},
    )
