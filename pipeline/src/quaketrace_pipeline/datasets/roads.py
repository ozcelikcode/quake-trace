"""Major road network (motorway to tertiary) from OpenStreetMap as a directed CSR graph.

Graph vertices are way endpoints, intersections (nodes shared by several ways) and the shape
points that survive Douglas-Peucker simplification, so edges can be drawn as straight segments.
Edge lengths are measured along the original, unsimplified geometry.

Binary layout of roads.bin (little-endian; offsets and counts are in the manifest `layout`):
nodeLonLat float32[2N], edgeOffsets uint32[N+1], edgeTargets uint32[E], edgeLengthM float32[E],
edgeClass uint8[E], edgeFlags uint8[E].
"""

from collections.abc import Iterable
from dataclasses import dataclass
from itertools import pairwise
from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt
import osmium
import osmium.filter
import osmium.osm

from ..config import OUTPUT_DIR, REGION
from ..manifest import record
from ..osm import SOURCE, turkey_pbf

OUTPUT_FILE = "roads.bin"

ROAD_CLASSES = {"motorway": 0, "trunk": 1, "primary": 2, "secondary": 3, "tertiary": 4}
FLAG_BRIDGE = 1
FLAG_TUNNEL = 2
FLAG_ONEWAY = 4
FLAG_LINK = 8

SIMPLIFY_TOLERANCE_M = 25.0
EARTH_RADIUS_M = 6_371_008.8
METRES_PER_DEGREE_LAT = 110_540.0
METRES_PER_DEGREE_LON_EQUATOR = 111_320.0


@dataclass(frozen=True)
class Way:
    node_ids: list[int]
    coords: list[tuple[float, float]]
    road_class: int
    flags: int
    oneway: int  # 0 both directions, 1 forward only, -1 backward only


def classify(tags: dict[str, str]) -> tuple[int, int, int] | None:
    """Road class, flags and one-way direction, or None if the way is not a major road."""
    highway = tags.get("highway", "")
    is_link = highway.endswith("_link")
    road_class = ROAD_CLASSES.get(highway.removesuffix("_link"))
    if road_class is None:
        return None

    flags = FLAG_LINK if is_link else 0
    if tags.get("bridge", "no") not in {"no", ""}:
        flags |= FLAG_BRIDGE
    if tags.get("tunnel", "no") not in {"no", ""}:
        flags |= FLAG_TUNNEL

    oneway_tag = tags.get("oneway", "")
    if oneway_tag == "-1":
        oneway = -1
    elif oneway_tag in {"yes", "true", "1"} or tags.get("junction") in {"roundabout", "circular"}:
        oneway = 1
    elif oneway_tag == "no":
        oneway = 0
    else:
        # OSM convention: motorways (not their links) are one-way unless tagged otherwise.
        oneway = 1 if highway == "motorway" else 0
    if oneway:
        flags |= FLAG_ONEWAY
    return road_class, flags, oneway


def read_ways(pbf: Path) -> Iterable[Way]:
    highway_values = [*ROAD_CLASSES, *(f"{c}_link" for c in ROAD_CLASSES)]
    tag_filter = osmium.filter.TagFilter(*(("highway", value) for value in highway_values))
    # Nodes must be read too: the location cache resolves way geometries from them.
    entities = osmium.osm.NODE | osmium.osm.WAY
    processor = osmium.FileProcessor(str(pbf), entities).with_locations().with_filter(tag_filter)
    for way in processor:
        if not isinstance(way, osmium.osm.Way):
            continue
        classified = classify(dict(way.tags))
        if classified is None:
            continue
        nodes = [n for n in way.nodes if n.location.valid()]
        if len(nodes) < 2 or not any(REGION.contains(n.lon, n.lat) for n in nodes):
            continue
        yield Way(
            node_ids=[n.ref for n in nodes],
            coords=[(n.lon, n.lat) for n in nodes],
            road_class=classified[0],
            flags=classified[1],
            oneway=classified[2],
        )


def segment_lengths(coords: npt.NDArray[np.float64]) -> npt.NDArray[np.float64]:
    """Haversine length of each consecutive segment, in metres."""
    lon = np.radians(coords[:, 0])
    lat = np.radians(coords[:, 1])
    dlat = np.diff(lat)
    dlon = np.diff(lon)
    a = np.sin(dlat / 2) ** 2 + np.cos(lat[:-1]) * np.cos(lat[1:]) * np.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_M * np.arcsin(np.sqrt(a))


def simplify_indices(coords: npt.NDArray[np.float64], tolerance_m: float) -> list[int]:
    """Douglas-Peucker on a local equirectangular projection; returns kept point indices."""
    lat0 = np.radians(coords[:, 1].mean())
    xy = np.column_stack(
        (
            coords[:, 0] * METRES_PER_DEGREE_LON_EQUATOR * np.cos(lat0),
            coords[:, 1] * METRES_PER_DEGREE_LAT,
        )
    )
    keep = np.zeros(len(xy), dtype=bool)
    keep[0] = keep[-1] = True
    stack = [(0, len(xy) - 1)]
    while stack:
        start, end = stack.pop()
        if end - start < 2:
            continue
        a, b = xy[start], xy[end]
        ab = b - a
        norm = float(np.hypot(*ab))
        points = xy[start + 1 : end]
        if norm == 0.0:
            distances = np.hypot(*(points - a).T)
        else:
            distances = np.abs(ab[0] * (points[:, 1] - a[1]) - ab[1] * (points[:, 0] - a[0])) / norm
        worst = int(np.argmax(distances))
        if distances[worst] > tolerance_m:
            split = start + 1 + worst
            keep[split] = True
            stack.extend(((start, split), (split, end)))
    return np.flatnonzero(keep).tolist()


@dataclass
class Graph:
    lon_lat: npt.NDArray[np.float32]
    offsets: npt.NDArray[np.uint32]
    targets: npt.NDArray[np.uint32]
    length_m: npt.NDArray[np.float32]
    road_class: npt.NDArray[np.uint8]
    flags: npt.NDArray[np.uint8]

    @property
    def node_count(self) -> int:
        return len(self.offsets) - 1

    @property
    def edge_count(self) -> int:
        return len(self.targets)


def build_graph(ways: list[Way], tolerance_m: float = SIMPLIFY_TOLERANCE_M) -> Graph:
    usage: dict[int, int] = {}
    for way in ways:
        for node_id in way.node_ids:
            usage[node_id] = usage.get(node_id, 0) + 1
        # Endpoints are always vertices, even when used by a single way.
        usage[way.node_ids[0]] = usage[way.node_ids[0]] + 1
        usage[way.node_ids[-1]] = usage[way.node_ids[-1]] + 1

    vertex_of: dict[int, int] = {}
    positions: list[tuple[float, float]] = []

    def vertex(node_id: int, position: tuple[float, float]) -> int:
        index = vertex_of.get(node_id)
        if index is None:
            index = vertex_of[node_id] = len(positions)
            positions.append(position)
        return index

    sources: list[int] = []
    targets: list[int] = []
    lengths: list[float] = []
    classes: list[int] = []
    flag_values: list[int] = []

    def add_edge(u: int, v: int, length: float, way: Way) -> None:
        if way.oneway >= 0:
            sources.append(u)
            targets.append(v)
            lengths.append(length)
            classes.append(way.road_class)
            flag_values.append(way.flags)
        if way.oneway <= 0:
            sources.append(v)
            targets.append(u)
            lengths.append(length)
            classes.append(way.road_class)
            flag_values.append(way.flags)

    for way in ways:
        coords = np.asarray(way.coords, dtype=np.float64)
        cumulative = np.concatenate(([0.0], np.cumsum(segment_lengths(coords))))
        split_points = [i for i, node_id in enumerate(way.node_ids) if usage[node_id] >= 2]
        for start, end in pairwise(split_points):
            kept = [start + k for k in simplify_indices(coords[start : end + 1], tolerance_m)]
            chain: list[int] = []
            for k in kept:
                if k in (start, end):
                    chain.append(vertex(way.node_ids[k], way.coords[k]))
                else:
                    # Shape points get vertices of their own, keyed by a negative synthetic id.
                    chain.append(vertex(-(len(positions) + 1), way.coords[k]))
            for (i, u), (j, v) in pairwise(zip(kept, chain, strict=True)):
                if u != v:
                    add_edge(u, v, float(cumulative[j] - cumulative[i]), way)

    node_count = len(positions)
    order = np.argsort(np.asarray(sources, dtype=np.int64), kind="stable")
    source_array = np.asarray(sources, dtype=np.int64)[order]
    offsets = np.zeros(node_count + 1, dtype=np.uint32)
    np.add.at(offsets, source_array + 1, 1)
    return Graph(
        lon_lat=np.asarray(positions, dtype=np.float32).reshape(-1),
        offsets=np.cumsum(offsets, dtype=np.uint32),
        targets=np.asarray(targets, dtype=np.uint32)[order],
        length_m=np.asarray(lengths, dtype=np.float32)[order],
        road_class=np.asarray(classes, dtype=np.uint8)[order],
        flags=np.asarray(flag_values, dtype=np.uint8)[order],
    )


def encode(graph: Graph) -> tuple[bytes, dict[str, Any]]:
    sections = [
        ("nodeLonLat", "float32", graph.lon_lat.astype("<f4")),
        ("edgeOffsets", "uint32", graph.offsets.astype("<u4")),
        ("edgeTargets", "uint32", graph.targets.astype("<u4")),
        ("edgeLengthM", "float32", graph.length_m.astype("<f4")),
        ("edgeClass", "uint8", graph.road_class),
        ("edgeFlags", "uint8", graph.flags),
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
        "nodeCount": graph.node_count,
        "edgeCount": graph.edge_count,
        "sections": layout,
        "classes": list(ROAD_CLASSES),
        "flags": {
            "bridge": FLAG_BRIDGE,
            "tunnel": FLAG_TUNNEL,
            "oneway": FLAG_ONEWAY,
            "link": FLAG_LINK,
        },
    }


def build(output_dir: Path = OUTPUT_DIR) -> None:
    ways = list(read_ways(turkey_pbf()))
    graph = build_graph(ways)
    data, layout = encode(graph)
    (output_dir / OUTPUT_FILE).write_bytes(data)
    km_by_class = {
        name: round(float(graph.length_m[graph.road_class == code].sum()) / 2000, 1)
        for name, code in ROAD_CLASSES.items()
    }
    record(
        output_dir,
        "roads",
        OUTPUT_FILE,
        format="csr-graph",
        sources=[SOURCE],
        layout=layout,
        notes="Lengths per class are approximate road kilometres (directed edges / 2).",
        stats={"ways": len(ways), "kmByClass": km_by_class},
    )
