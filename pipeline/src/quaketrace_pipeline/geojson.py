"""Small GeoJSON helpers shared by vector datasets."""

import json
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from .config import BBox

Feature = dict[str, Any]

# Five decimals of a degree is about 1 m, well below any map or model resolution used here.
COORDINATE_DECIMALS = 5


def iter_positions(geometry: dict[str, Any]) -> Iterable[tuple[float, float]]:
    def walk(node: Any) -> Iterable[tuple[float, float]]:
        if node and isinstance(node[0], int | float):
            yield (float(node[0]), float(node[1]))
        else:
            for child in node:
                yield from walk(child)

    yield from walk(geometry["coordinates"])


def touches_bbox(feature: Feature, bbox: BBox) -> bool:
    geometry = feature.get("geometry")
    if not geometry:
        return False
    return any(bbox.contains(lon, lat) for lon, lat in iter_positions(geometry))


def round_coordinates(node: Any, decimals: int = COORDINATE_DECIMALS) -> Any:
    if node and isinstance(node[0], int | float):
        return [round(float(value), decimals) for value in node[:2]]
    return [round_coordinates(child, decimals) for child in node]


def write_collection(path: Path, features: list[Feature]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    collection = {"type": "FeatureCollection", "features": features}
    path.write_text(
        json.dumps(collection, ensure_ascii=False, separators=(",", ":")) + "\n", "utf-8"
    )
