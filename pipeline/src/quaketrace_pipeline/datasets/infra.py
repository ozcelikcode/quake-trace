"""Critical infrastructure from OpenStreetMap.

Points: hospitals, fire stations, police, emergency assembly points and power substations
(areas are reduced to their centroid). Lines: natural gas pipelines.
"""

from collections.abc import Iterable
from pathlib import Path
from typing import Any

import osmium
import osmium.filter
import osmium.osm
import shapely
from shapely.geometry import Polygon

from ..config import OUTPUT_DIR, REGION
from ..geojson import Feature, round_coordinates, write_collection
from ..manifest import record
from ..osm import SOURCE, turkey_pbf

OUTPUT_FILE = "infra.geojson"

POINT_KINDS: dict[tuple[str, str], str] = {
    ("amenity", "hospital"): "hospital",
    ("amenity", "fire_station"): "fireStation",
    ("amenity", "police"): "police",
    ("emergency", "assembly_point"): "assemblyPoint",
    ("power", "substation"): "substation",
}
PIPELINE_TAG = ("man_made", "pipeline")


def point_kind(tags: dict[str, str]) -> str | None:
    for (key, value), kind in POINT_KINDS.items():
        if tags.get(key) == value:
            return kind
    return None


def is_gas_pipeline(tags: dict[str, str]) -> bool:
    return tags.get(PIPELINE_TAG[0]) == PIPELINE_TAG[1] and tags.get("substance") in {
        "gas",
        "natural_gas",
    }


def point_feature(osm_id: str, kind: str, lon: float, lat: float, tags: dict[str, str]) -> Feature:
    properties: dict[str, Any] = {"id": osm_id, "kind": kind}
    if name := tags.get("name"):
        properties["name"] = name
    beds = tags.get("beds", "")
    if beds.isdigit() and int(beds) > 0:
        properties["beds"] = int(beds)
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": round_coordinates([lon, lat])},
        "properties": properties,
    }


def _area_centroid(area: osmium.osm.Area) -> tuple[float, float] | None:
    polygons: list[Polygon] = []
    for outer in area.outer_rings():
        ring = [(n.lon, n.lat) for n in outer if n.location.valid()]
        if len(ring) >= 4:
            polygons.append(Polygon(ring))
    if not polygons:
        return None
    centroid = shapely.MultiPolygon(polygons).centroid
    return (centroid.x, centroid.y)


def read_features(pbf: Path) -> Iterable[Feature]:
    tag_filter = osmium.filter.TagFilter(*POINT_KINDS.keys(), PIPELINE_TAG)
    processor = osmium.FileProcessor(str(pbf)).with_locations().with_areas().with_filter(tag_filter)
    for obj in processor:
        tags = dict(obj.tags)
        if isinstance(obj, osmium.osm.Node):
            kind = point_kind(tags)
            if kind and REGION.contains(obj.location.lon, obj.location.lat):
                yield point_feature(f"n{obj.id}", kind, obj.location.lon, obj.location.lat, tags)
        elif isinstance(obj, osmium.osm.Area):
            kind = point_kind(tags)
            centroid = _area_centroid(obj) if kind else None
            if kind and centroid and REGION.contains(*centroid):
                prefix = "w" if obj.from_way() else "r"
                yield point_feature(f"{prefix}{obj.orig_id()}", kind, *centroid, tags)
        elif isinstance(obj, osmium.osm.Way) and is_gas_pipeline(tags):
            coords = [(n.lon, n.lat) for n in obj.nodes if n.location.valid()]
            if len(coords) >= 2 and any(REGION.contains(x, y) for x, y in coords):
                yield {
                    "type": "Feature",
                    "geometry": {"type": "LineString", "coordinates": round_coordinates(coords)},
                    "properties": {"id": f"w{obj.id}", "kind": "gasPipeline"},
                }


def build(output_dir: Path = OUTPUT_DIR) -> None:
    features = sorted(
        read_features(turkey_pbf()),
        key=lambda f: (f["properties"]["kind"], f["properties"]["id"]),
    )
    write_collection(output_dir / OUTPUT_FILE, features)
    counts: dict[str, int] = {}
    for feature in features:
        kind = feature["properties"]["kind"]
        counts[kind] = counts.get(kind, 0) + 1
    record(output_dir, "infra", OUTPUT_FILE, format="geojson", sources=[SOURCE], stats=counts)
