"""Active crustal fault sources from EFSM20 (Basili et al., 2024, doi:10.13127/efsm20).

Each output feature is the fault's top trace with the parameters the rupture model needs.
EFSM20 digitizes traces with the right-hand rule, so the fault dips to the right of the
trace direction (dip azimuth = strike + 90°).
"""

import json
from pathlib import Path
from typing import Any

from ..config import OUTPUT_DIR, REGION
from ..download import fetch
from ..geojson import Feature, round_coordinates, touches_bbox, write_collection
from ..manifest import Source, record

URL = (
    "https://services.seismofaults.eu/EFSM20/ows?service=WFS&version=1.1.0&request=GetFeature"
    "&typeName=EFSM20:efsm20_cf_top&outputFormat=application/json"
)
SOURCE = Source(
    name="European Fault-Source Model 2020 (EFSM20), crustal faults",
    url="https://doi.org/10.13127/efsm20",
    license="CC-BY-4.0",
    attribution="Basili et al. (2024), EFSM20, EFEHR",
)
OUTPUT_FILE = "faults.geojson"

# EFSM20 fault type codes.
FAULT_TYPES = {"N": "normal", "R": "reverse", "S": "strike-slip"}


def _range(props: dict[str, Any], key: str) -> dict[str, float]:
    return {
        "min": float(props[f"{key}min"]),
        "avg": float(props[f"{key}avg"]),
        "max": float(props[f"{key}max"]),
    }


def transform(feature: Feature) -> Feature:
    props = feature["properties"]
    return {
        "type": "Feature",
        "geometry": {
            "type": feature["geometry"]["type"],
            "coordinates": round_coordinates(feature["geometry"]["coordinates"]),
        },
        "properties": {
            "id": props["idfs"],
            "faultType": FAULT_TYPES.get(str(props["faulttype"]), "unknown"),
            "strikeDeg": _range(props, "strike"),
            "dipDeg": _range(props, "dip"),
            "rakeDeg": _range(props, "rake"),
            "upperDepthKm": float(props["mindepth"]),
            "lowerDepthKm": float(props["maxdepth"]),
            "lengthKm": float(props["length"]),
            "widthKm": _range(props, "width"),
            "slipRateMmYr": {
                "min": float(props["srmin"]),
                "mean": float(props["sramean"]),
                "max": float(props["srmax"]),
            },
            "mwMax": {
                "p05": float(props["mwmaxp05"]),
                "avg": float(props["mwmaxavg"]),
                "p95": float(props["mwmaxp95"]),
            },
        },
    }


def select(collection: dict[str, Any]) -> list[Feature]:
    features = [f for f in collection["features"] if touches_bbox(f, REGION)]
    return sorted((transform(f) for f in features), key=lambda f: f["properties"]["id"])


def build(output_dir: Path = OUTPUT_DIR) -> None:
    source_path = fetch(URL, "efsm20_cf_top.geojson")
    features = select(json.loads(source_path.read_text("utf-8")))
    write_collection(output_dir / OUTPUT_FILE, features)
    record(
        output_dir,
        "faults",
        OUTPUT_FILE,
        format="geojson",
        sources=[SOURCE],
        stats={"features": len(features)},
    )
