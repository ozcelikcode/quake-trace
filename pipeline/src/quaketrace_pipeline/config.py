"""Paths and the regional extent shared by every dataset."""

from dataclasses import dataclass
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = PIPELINE_ROOT.parent
CACHE_DIR = PIPELINE_ROOT / ".cache"
OUTPUT_DIR = REPO_ROOT / "public" / "data"

USER_AGENT = "quaketrace-pipeline/0.1 (+https://github.com/ozcelikcode/quake-trace)"


@dataclass(frozen=True)
class BBox:
    west: float
    south: float
    east: float
    north: float

    def contains(self, lon: float, lat: float) -> bool:
        return self.west <= lon <= self.east and self.south <= lat <= self.north

    def as_tuple(self) -> tuple[float, float, float, float]:
        return (self.west, self.south, self.east, self.north)


# Engine extent (memory-bank/simulationModels.md, Grid).
REGION = BBox(west=26.0, south=39.8, east=31.0, north=41.8)
