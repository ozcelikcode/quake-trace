"""Active faults worldwide for the map and for ruptures outside the Marmara presets.

EFSM20 (Basili et al., 2024) is used across Europe, Türkiye and the Mediterranean. Elsewhere the
GEM Global Active Faults Database (Styron and Pagani, 2020) fills in; its SHARE and EMME traces
that duplicate EFSM20 are dropped. Every trace is ordered by the right-hand rule (the fault dips
to the right of the trace), simplified to about 500 m and carries the parameters the rupture
model needs. Missing GEM dips, rakes and depths take typical values for the slip type.
"""

import json
import math
import re
from pathlib import Path
from typing import Any

from shapely.geometry import LineString

from ..config import OUTPUT_DIR
from ..download import fetch
from ..geojson import Feature, iter_positions, round_coordinates, write_collection
from ..manifest import Source, record
from . import faults

GEM_URL = (
    "https://raw.githubusercontent.com/GEMScienceTools/gem-global-active-faults/"
    "master/geojson/gem_active_faults_harmonized.geojson"
)
GEM_SOURCE = Source(
    name="GEM Global Active Faults Database (harmonized)",
    url="https://github.com/GEMScienceTools/gem-global-active-faults",
    license="CC-BY-SA-4.0",
    attribution="Styron and Pagani (2020), GEM Global Active Faults Database",
)
OUTPUT_FILE = "faults-world.geojson"
SIMPLIFY_DEG = 0.005
DECIMALS = 3
# GEM traces within this many 0.25° cells of an EFSM20 trace duplicate it.
DUPLICATE_CELL_DEG = 0.25
DUPLICATE_CATALOGS = {"SHARE", "EMME"}
SKIPPED_TYPES = {"Anticline", "Syncline"}

# (kind, dip °, rake °) typical of each GEM slip type, used where GEM gives none.
SLIP_TYPES: dict[str, tuple[str, float, float]] = {
    "Dextral": ("right-lateral", 90, 180),
    "Dextral_Transform": ("right-lateral", 90, 180),
    "Sinistral": ("left-lateral", 90, 0),
    "Sinistral_Transform": ("left-lateral", 90, 0),
    "Strike-Slip": ("right-lateral", 90, 180),
    "Reverse": ("reverse", 35, 90),
    "Reverse-Strike-Slip": ("reverse", 45, 135),
    "Dextral-Reverse": ("reverse", 60, 135),
    "Sinistral-Reverse": ("reverse", 60, 45),
    "Subduction_Thrust": ("reverse", 15, 90),
    "Normal": ("normal", 60, -90),
    "Normal-Dextral": ("normal", 70, -135),
    "Normal-Sinistral": ("normal", 70, -45),
    "Dextral-Normal": ("normal", 70, -135),
    "Sinistral-Normal": ("normal", 70, -45),
    "Spreading_Ridge": ("normal", 60, -90),
}
DEFAULT_SLIP = ("right-lateral", 90, 180)
COMPASS = {"N": 0, "NE": 45, "E": 90, "SE": 135, "S": 180, "SW": 225, "W": 270, "NW": 315}
DEFAULT_UPPER_KM = 0.0
DEFAULT_LOWER_KM = 15.0


def gem_value(text: Any) -> float | None:
    """First number of a GEM tuple string such as "(38,,)" or "(1.55,0.8,2.22)"."""
    if text is None:
        return None
    match = re.match(r"\(?\s*(-?[\d.]+)", str(text))
    return float(match.group(1)) if match else None


def bearing(a: tuple[float, float], b: tuple[float, float]) -> float:
    lon1, lat1, lon2, lat2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    y = math.sin(lon2 - lon1) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(lon2 - lon1)
    return math.degrees(math.atan2(y, x)) % 360


def right_hand(coords: list[list[float]], dip_azimuth: float | None) -> list[list[float]]:
    """Reverses a trace whose dip direction lies to its left (right-hand rule)."""
    if dip_azimuth is None or len(coords) < 2:
        return coords
    strike = bearing((coords[0][0], coords[0][1]), (coords[-1][0], coords[-1][1]))
    offset = (dip_azimuth - strike) % 360
    return coords if offset < 180 else coords[::-1]


def dip_azimuth(text: Any) -> float | None:
    if text is None:
        return None
    value = str(text).strip().upper()
    if value in COMPASS:
        return COMPASS[value]
    try:
        return float(value) % 360
    except ValueError:
        return None


def simplify(coords: list[list[float]]) -> list[list[float]]:
    line = LineString(coords).simplify(SIMPLIFY_DEG, preserve_topology=False)
    return round_coordinates([list(point) for point in line.coords], DECIMALS)


def efsm_feature(feature: Feature) -> list[Feature]:
    source = faults.transform(feature)
    props = source["properties"]
    geometry = source["geometry"]
    lines = (
        geometry["coordinates"]
        if geometry["type"] == "MultiLineString"
        else [geometry["coordinates"]]
    )
    return [
        world_feature(
            f"{props['id']}" if len(lines) == 1 else f"{props['id']}-{i}",
            None,
            simplify(line),
            kind=props["faultType"],
            dip=props["dipDeg"]["avg"],
            rake=props["rakeDeg"]["avg"],
            upper=props["upperDepthKm"],
            lower=props["lowerDepthKm"],
            slip_rate=props["slipRateMmYr"]["mean"],
            catalog="EFSM20",
        )
        for i, line in enumerate(lines)
    ]


def gem_feature(feature: Feature) -> Feature | None:
    props = feature["properties"]
    slip_type = props.get("slip_type")
    if slip_type in SKIPPED_TYPES:
        return None
    kind, dip, rake = SLIP_TYPES.get(slip_type or "", DEFAULT_SLIP)
    coords = right_hand(feature["geometry"]["coordinates"], dip_azimuth(props.get("dip_dir")))
    gem_dip = gem_value(props.get("average_dip"))
    gem_rake = gem_value(props.get("average_rake"))
    upper = gem_value(props.get("upper_seis_depth"))
    lower = gem_value(props.get("lower_seis_depth"))
    if upper is None or lower is None or lower <= upper:
        upper, lower = DEFAULT_UPPER_KM, DEFAULT_LOWER_KM
    return world_feature(
        f"GEM-{props['catalog_id']}",
        props.get("name") or None,
        simplify(coords),
        kind=kind,
        dip=gem_dip if gem_dip else dip,
        rake=gem_rake if gem_rake is not None else rake,
        upper=upper,
        lower=lower,
        slip_rate=gem_value(props.get("net_slip_rate")) or 0.0,
        catalog=str(props.get("catalog_name")),
    )


def world_feature(
    fault_id: str,
    name: str | None,
    coords: list[list[float]],
    *,
    kind: str,
    dip: float,
    rake: float,
    upper: float,
    lower: float,
    slip_rate: float,
    catalog: str,
) -> Feature:
    properties: dict[str, Any] = {
        "id": fault_id,
        "kind": kind,
        "dipDeg": round(dip, 1),
        "rakeDeg": round(rake, 1),
        "upperDepthKm": round(upper, 1),
        "lowerDepthKm": round(lower, 1),
        "slipRateMmYr": round(slip_rate, 2),
        "catalog": catalog,
    }
    if name:
        properties["name"] = name
    return {
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": coords},
        "properties": properties,
    }


def occupied_cells(features: list[Feature]) -> set[tuple[int, int]]:
    return {
        (math.floor(lon / DUPLICATE_CELL_DEG), math.floor(lat / DUPLICATE_CELL_DEG))
        for feature in features
        for lon, lat in iter_positions(feature["geometry"])
    }


def duplicates_efsm(feature: Feature, cells: set[tuple[int, int]]) -> bool:
    if feature["properties"].get("catalog_name") not in DUPLICATE_CATALOGS:
        return False
    for lon, lat in iter_positions(feature["geometry"]):
        col = math.floor(lon / DUPLICATE_CELL_DEG)
        row = math.floor(lat / DUPLICATE_CELL_DEG)
        if any((col + dc, row + dr) in cells for dc in (-1, 0, 1) for dr in (-1, 0, 1)):
            return True
    return False


def select(efsm: dict[str, Any], gem: dict[str, Any]) -> list[Feature]:
    efsm_features = [out for feature in efsm["features"] for out in efsm_feature(feature)]
    cells = occupied_cells(efsm_features)
    gem_features = [
        out
        for feature in gem["features"]
        if not duplicates_efsm(feature, cells)
        if (out := gem_feature(feature)) is not None
    ]
    return [f for f in efsm_features + gem_features if len(f["geometry"]["coordinates"]) >= 2]


def build(output_dir: Path = OUTPUT_DIR) -> None:
    efsm = json.loads(fetch(faults.URL, "efsm20_cf_top.geojson").read_text("utf-8"))
    gem = json.loads(fetch(GEM_URL, "gem_active_faults_harmonized.geojson").read_text("utf-8"))
    features = select(efsm, gem)
    write_collection(output_dir / OUTPUT_FILE, features)
    record(
        output_dir,
        "worldFaults",
        OUTPUT_FILE,
        format="geojson",
        sources=[faults.SOURCE, GEM_SOURCE],
        notes=(
            "Top traces by the right-hand rule, simplified to 0.005 deg; GEM SHARE/EMME traces "
            "near EFSM20 dropped; missing GEM parameters take typical values per slip type."
        ),
        stats={"features": len(features)},
    )
