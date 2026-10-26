"""Reference values for engine tests, written to tests/fixtures.

- ASB14: the verification table distributed with OpenQuake hazardlib (Akkar, Sandıkkaya and
  Bommer, 2014, Rjb model), reduced to the intensity measures the engine uses.
- İBB 2019 earthquake scenario (Mw 7.5, night): damaged buildings and fatalities per İstanbul
  district, summed from the published neighbourhood results, for validating damage estimates.
"""

import csv
import json
from pathlib import Path
from typing import Any

from .config import REPO_ROOT
from .datasets.district_stats import RENAMED_DISTRICTS, decode_turkish, turkish_key
from .download import fetch

OPENQUAKE_TAG = "v3.26.2"
ASB14_URL = (
    f"https://raw.githubusercontent.com/gem/oq-engine/{OPENQUAKE_TAG}/openquake/hazardlib/"
    "tests/gsim/data/AKKAR14/AKKAR_2014_RJB_MEAN.csv"
)
FIXTURE_DIR = REPO_ROOT / "tests" / "fixtures" / "gmpe"
DAMAGE_FIXTURE_DIR = REPO_ROOT / "tests" / "fixtures" / "damage"
IBB_SCENARIO_URL = (
    "https://data.ibb.gov.tr/dataset/c13514d9-86b1-4b83-a9b9-1a15cb5f254c/resource/"
    "9c3ac492-de4b-4245-b418-7ad3df67a193/download/deprem-senaryosu-analiz-sonuclar.csv"
)
# İBB column → fixture key.
IBB_COLUMNS = {
    "cok_agir_hasarli_bina_sayisi": "veryHeavy",
    "agir_hasarli_bina_sayisi": "heavy",
    "orta_hasarli_bina_sayisi": "moderate",
    "hafif_hasarli_bina_sayisi": "light",
    "can_kaybi_sayisi": "fatalities",
}

# CSV column → fixture key (PGA and SA in g, PGV in cm/s; medians).
COLUMNS = {
    "pga": "pgaG",
    "pgv": "pgvCms",
    "0.3000": "sa03G",
    "0.6000": "sa06G",
    "1.0000": "sa10G",
}


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
        "units": {"pgaG": "g", "pgvCms": "cm/s", "sa03G": "g", "sa06G": "g", "sa10G": "g"},
        "rows": asb14_rows(source.read_text("utf-8")),
    }
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / "asb14-rjb-mean.json"
    path.write_text(json.dumps(fixture, ensure_ascii=False, indent=1) + "\n", "utf-8")
    return path


def ibb_district_totals(text: str) -> list[dict[str, Any]]:
    totals: dict[str, dict[str, float]] = {}
    for row in csv.DictReader(text.splitlines(), delimiter=";"):
        key = turkish_key(row["ilce_adi"])
        key = RENAMED_DISTRICTS.get(key, key)
        district = totals.setdefault(key, dict.fromkeys(IBB_COLUMNS.values(), 0.0))
        for column, field in IBB_COLUMNS.items():
            district[field] += float(row[column] or 0)
    return [{"name": name, **values} for name, values in sorted(totals.items())]


def build_ibb_scenario(directory: Path = DAMAGE_FIXTURE_DIR) -> Path:
    source = fetch(IBB_SCENARIO_URL, "ibb-2019-deprem-senaryosu-analiz-sonuclari.csv")
    fixture: dict[str, Any] = {
        "description": "İBB 2019 earthquake scenario (Mw 7.5, night), totals per district",
        "source": IBB_SCENARIO_URL,
        "license": "İBB Açık Veri Lisansı",
        "districts": ibb_district_totals(decode_turkish(source.read_bytes())),
    }
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / "ibb-2019-scenario.json"
    path.write_text(json.dumps(fixture, ensure_ascii=False, indent=1) + "\n", "utf-8")
    return path


def build_all() -> None:
    print(f"  wrote {build_asb14()}")
    print(f"  wrote {build_ibb_scenario()}")
