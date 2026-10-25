"""OpenStreetMap source shared by the infrastructure and road datasets."""

from pathlib import Path

from .download import fetch
from .manifest import Source

PBF_URL = "https://download.geofabrik.de/europe/turkey-latest.osm.pbf"
SOURCE = Source(
    name="OpenStreetMap, Geofabrik Türkiye extract",
    url="https://download.geofabrik.de/europe/turkey.html",
    license="ODbL-1.0",
    attribution="© OpenStreetMap contributors",
)


def turkey_pbf() -> Path:
    return fetch(PBF_URL, "turkey-latest.osm.pbf")
