from typing import Any

from quaketrace_pipeline.datasets.faults import select

PROPERTIES: dict[str, Any] = {
    "idfs": "TRCF00X",
    "faulttype": "S",
    "strikemin": 260,
    "strikeavg": 265,
    "strikemax": 270,
    "dipmin": 85,
    "dipavg": 89,
    "dipmax": 90,
    "rakemin": 170,
    "rakeavg": 180,
    "rakemax": 190,
    "mindepth": 0,
    "maxdepth": 18,
    "length": 42.5,
    "widthmin": 17,
    "widthavg": 18,
    "widthmax": 19,
    "srmin": 10,
    "sramean": 15,
    "srmax": 20,
    "mwmaxp05": 7.0,
    "mwmaxavg": 7.3,
    "mwmaxp95": 7.6,
}


def feature(fault_id: str, coordinates: list[list[float]]) -> dict[str, Any]:
    return {
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": coordinates},
        "properties": {**PROPERTIES, "idfs": fault_id},
    }


def test_select_keeps_region_faults_and_normalizes_fields() -> None:
    collection = {
        "features": [
            feature("TRCF00Z", [[28.123456789, 40.8], [28.5, 40.85]]),
            feature("FAR", [[10.0, 45.0], [10.5, 45.1]]),
            feature("TRCF00A", [[27.0, 40.6], [27.5, 40.7]]),
        ]
    }
    selected = select(collection)

    assert [f["properties"]["id"] for f in selected] == ["TRCF00A", "TRCF00Z"]
    props = selected[1]["properties"]
    assert props["faultType"] == "strike-slip"
    assert props["dipDeg"] == {"min": 85.0, "avg": 89.0, "max": 90.0}
    assert props["lowerDepthKm"] == 18.0
    assert props["slipRateMmYr"]["mean"] == 15.0
    assert props["mwMax"]["avg"] == 7.3
    assert selected[1]["geometry"]["coordinates"][0] == [28.12346, 40.8]
