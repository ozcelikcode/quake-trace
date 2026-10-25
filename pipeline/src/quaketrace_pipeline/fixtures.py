"""Reference values for engine unit tests, written to tests/fixtures.

ASB14: the verification table distributed with OpenQuake hazardlib (Akkar, Sandıkkaya and
Bommer, 2014, Rjb model), reduced to the intensity measures the engine uses.
"""

import csv
import json
from pathlib import Path
from typing import Any

from .config import REPO_ROOT
from .download import fetch

OPENQUAKE_TAG = "v3.26.2"
ASB14_URL = (
    f"https://raw.githubusercontent.com/gem/oq-engine/{OPENQUAKE_TAG}/openquake/hazardlib/"
    "tests/gsim/data/AKKAR14/AKKAR_2014_RJB_MEAN.csv"
)
FIXTURE_DIR = REPO_ROOT / "tests" / "fixtures" / "gmpe"

# CSV column → fixture key (PGA and SA in g, PGV in cm/s; medians).
COLUMNS = {"pga": "pgaG", "pgv": "pgvCms", "0.3000": "sa03G", "1.0000": "sa10G"}


def asb14_rows(text: str) -> list[dict[str, float]]:
    rows: list[dict[str, float]] = []
    for row in csv.DictReader(text.splitlines()):
        entry = {
            "mw": float(row["rup_mag"]),
            "rakeDeg": float(row["rup_rake"]),
            "rjbKm": float(row["dist_rjb"]),
            "vs30": float(row["site_vs30"]),
        }
        entry.update({key: float(row[column]) for column, key in COLUMNS.items()})
        rows.append(entry)
    return rows


def build_asb14(directory: Path = FIXTURE_DIR) -> Path:
    source = fetch(ASB14_URL, f"openquake-{OPENQUAKE_TAG}-AKKAR_2014_RJB_MEAN.csv")
    fixture: dict[str, Any] = {
        "description": "ASB14 Rjb median ground motion, verification table",
        "source": ASB14_URL,
        "reference": "Akkar, Sandıkkaya and Bommer (2014), Bull. Earthquake Eng. 12:359-387",
        "units": {"pgaG": "g", "pgvCms": "cm/s", "sa03G": "g", "sa10G": "g"},
        "rows": asb14_rows(source.read_text("utf-8")),
    }
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / "asb14-rjb-mean.json"
    path.write_text(json.dumps(fixture, ensure_ascii=False, indent=1) + "\n", "utf-8")
    return path


def build_all() -> None:
    print(f"  wrote {build_asb14()}")
