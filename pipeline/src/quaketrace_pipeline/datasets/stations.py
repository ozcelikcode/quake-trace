"""Open seismic stations in the region from FDSN station services (channel level, text format).

KOERI's EIDA node is the main source for network KO; the EIDA federator adds other networks
(e.g. AFAD's TK) that are not served by KOERI.
"""

import json
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from ..config import OUTPUT_DIR, REGION
from ..download import fetch
from ..manifest import Source, record

KOERI_URL = "http://eida-service.koeri.boun.edu.tr/fdsnws/station/1/query"
FEDERATOR_URL = "https://federator.orfeus-eu.org/fdsnws/station/1/query"

KOERI_SOURCE = Source(
    name="KOERI EIDA node, FDSN station service (network KO)",
    url="https://doi.org/10.7914/SN/KO",
    license="Open access via EIDA; cite the network DOI",
    attribution="Boğaziçi University Kandilli Observatory and Earthquake Research Institute",
)
FEDERATOR_SOURCE = Source(
    name="EIDA federator, FDSN station service",
    url="https://www.orfeus-eu.org/data/eida/",
    license="Open access via EIDA; cite each network DOI",
    attribution="ORFEUS EIDA and contributing network operators",
)
OUTPUT_FILE = "stations.json"

# SEED band/instrument codes: H = high broadband rate, N = accelerometer, H = high-gain seismometer.
ACCELEROMETER_PREFIXES = ("HN", "BN", "EN")
BROADBAND_PREFIXES = ("HH", "BH")
SHORT_PERIOD_PREFIXES = ("EH", "SH")


def query_params(networks: str) -> dict[str, str]:
    return {
        "network": networks,
        "level": "channel",
        "format": "text",
        "minlatitude": str(REGION.south),
        "maxlatitude": str(REGION.north),
        "minlongitude": str(REGION.west),
        "maxlongitude": str(REGION.east),
        "endafter": datetime.now(UTC).strftime("%Y-%m-%dT00:00:00"),
    }


def parse_channels(text: str) -> list[dict[str, Any]]:
    """Groups FDSN text channel rows into one record per network.station."""
    channels: dict[str, set[str]] = defaultdict(set)
    meta: dict[str, dict[str, Any]] = {}
    for line in text.splitlines():
        if not line or line.startswith("#"):
            continue
        cols = line.split("|")
        network, station, channel = cols[0], cols[1], cols[3]
        key = f"{network}.{station}"
        channels[key].add(channel)
        meta.setdefault(
            key,
            {
                "id": key,
                "network": network,
                "station": station,
                "lat": round(float(cols[4]), 5),
                "lon": round(float(cols[5]), 5),
                "elevationM": round(float(cols[6]), 1),
                "depthM": round(float(cols[7]), 1),
            },
        )

    stations: list[dict[str, Any]] = []
    for key, record_meta in meta.items():
        codes = sorted(channels[key])
        stations.append(
            {
                **record_meta,
                "channels": codes,
                "accelerometer": any(c.startswith(ACCELEROMETER_PREFIXES) for c in codes),
                "broadband": any(c.startswith(BROADBAND_PREFIXES) for c in codes),
                "shortPeriod": any(c.startswith(SHORT_PERIOD_PREFIXES) for c in codes),
            }
        )
    return sorted(stations, key=lambda s: s["id"])


def is_permanent_network(code: str) -> bool:
    """FDSN reserves codes starting with a digit or X, Y, Z for temporary deployments."""
    return not (code[:1].isdigit() or code[:1] in {"X", "Y", "Z"})


def merge(primary: list[dict[str, Any]], secondary: list[dict[str, Any]]) -> list[dict[str, Any]]:
    known = {s["id"] for s in primary}
    return sorted(
        [*primary, *(s for s in secondary if s["id"] not in known)], key=lambda s: s["id"]
    )


def build(output_dir: Path = OUTPUT_DIR) -> None:
    today = datetime.now(UTC).strftime("%Y-%m-%d")
    koeri = fetch(KOERI_URL, f"stations-koeri-{today}.txt", params=query_params("KO"))
    federator = fetch(FEDERATOR_URL, f"stations-federator-{today}.txt", params=query_params("*"))
    stations = merge(
        parse_channels(koeri.read_text("utf-8")),
        parse_channels(federator.read_text("utf-8")),
    )
    stations = [
        s
        for s in stations
        if REGION.contains(s["lon"], s["lat"]) and is_permanent_network(s["network"])
    ]

    (output_dir / OUTPUT_FILE).write_text(
        json.dumps({"stations": stations}, ensure_ascii=False, separators=(",", ":")) + "\n",
        "utf-8",
    )
    networks = sorted({s["network"] for s in stations})
    record(
        output_dir,
        "stations",
        OUTPUT_FILE,
        format="json",
        sources=[KOERI_SOURCE, FEDERATOR_SOURCE],
        stats={
            "stations": len(stations),
            "accelerometers": sum(s["accelerometer"] for s in stations),
            "networks": networks,
        },
    )
