"""Population and building stock per district.

Population is summed from population.f32 over district-cells.f32. Building counts come from
İBB's 2017 neighbourhood building counts for İstanbul. No open building inventory exists for
the other provinces, so their counts are estimated: persons per building and the shares by
construction period and storeys are taken from İstanbul's lower-density districts and applied
to each district's population. Estimated districts are marked `"buildingSource": "estimated"`.

Requires the `districts` and `population` datasets to be built first.
"""

import csv
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt

from ..config import OUTPUT_DIR
from ..download import fetch
from ..grid import GRID_1KM, read_float32_grid
from ..manifest import Source, record

IBB_BUILDINGS_URL = (
    "https://data.ibb.gov.tr/dataset/be3582eb-09d7-42f8-84d3-b3817dc9ab0a/resource/"
    "cef193d5-0bd2-4e8d-8a69-275c50288875/download/2017-yl-mahalle-bazl-bina-saylar.csv"
)
IBB_SOURCE = Source(
    name="İBB Açık Veri: 2017 Yılı Mahalle Bazlı Bina Sayıları",
    url="https://data.ibb.gov.tr/dataset/mahalle-bazli-bina-analiz-verisi",
    license="İBB Açık Veri Lisansı",
    attribution="İstanbul Büyükşehir Belediyesi, Deprem Risk Yönetimi ve Kentsel İyileştirme",
)
OUTPUT_FILE = "district-stats.json"
ISTANBUL = "İstanbul"

# Districts below this density stand in for building stock outside İstanbul.
REFERENCE_MAX_DENSITY_PER_KM2 = 2000.0
KM_PER_DEGREE = 111.32

PERIOD_COLUMNS = {
    "before1980": "1980_oncesi",
    "from1980To2000": "1980-2000_arasi",
    "after2000": "2000_sonrasi",
}
# Districts renamed after the İBB data was compiled (Eyüp became Eyüpsultan in 2017).
RENAMED_DISTRICTS = {"eyüp": "eyüpsultan"}

# Storey bands as published (1-4, 5-9, 9-19 floors).
STOREY_COLUMNS = {"low": "1-4 kat_arasi", "mid": "5-9 kat_arasi", "high": "9-19 kat_arasi"}


def decode_turkish(data: bytes) -> str:
    """İBB publishes some CSV files as UTF-8 and others as Windows-1254."""
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return data.decode("cp1254")


def turkish_key(name: str) -> str:
    """Case-insensitive key that respects Turkish dotted and dotless i."""
    return name.strip().replace("I", "ı").replace("İ", "i").lower()


@dataclass
class BuildingCounts:
    by_period: dict[str, float] = field(default_factory=lambda: dict.fromkeys(PERIOD_COLUMNS, 0.0))
    by_storeys: dict[str, float] = field(default_factory=lambda: dict.fromkeys(STOREY_COLUMNS, 0.0))

    @property
    def total(self) -> float:
        return sum(self.by_period.values())

    def add(self, other: "BuildingCounts") -> None:
        for key, value in other.by_period.items():
            self.by_period[key] += value
        for key, value in other.by_storeys.items():
            self.by_storeys[key] += value

    def to_json(self) -> dict[str, Any]:
        return {
            "total": round(self.total),
            "byPeriod": {k: round(v) for k, v in self.by_period.items()},
            "byStoreys": {k: round(v) for k, v in self.by_storeys.items()},
        }


def read_ibb_buildings(text: str) -> dict[str, BuildingCounts]:
    """Sums neighbourhood rows per district, keyed by `turkish_key(current district name)`."""
    totals: dict[str, BuildingCounts] = {}
    for row in csv.DictReader(text.splitlines(), delimiter=";"):
        counts = BuildingCounts(
            by_period={k: float(row[c] or 0) for k, c in PERIOD_COLUMNS.items()},
            by_storeys={k: float(row[c] or 0) for k, c in STOREY_COLUMNS.items()},
        )
        key = turkish_key(row["ilce_adi"])
        totals.setdefault(RENAMED_DISTRICTS.get(key, key), BuildingCounts()).add(counts)
    return totals


def cell_area_km2(rows: int, cols: int) -> npt.NDArray[np.float64]:
    lats = GRID_1KM.north - (np.arange(rows) + 0.5) * GRID_1KM.d_lat
    height = GRID_1KM.d_lat * KM_PER_DEGREE
    widths = GRID_1KM.d_lon * KM_PER_DEGREE * np.cos(np.radians(lats))
    return np.repeat((height * widths)[:, np.newaxis], cols, axis=1)


def zonal_sums(
    cells: npt.NDArray[np.float32], values: npt.NDArray[np.float64], count: int
) -> npt.NDArray[np.float64]:
    valid = np.isfinite(cells)
    return np.bincount(cells[valid].astype(np.intp), weights=values[valid], minlength=count)


@dataclass(frozen=True)
class Estimator:
    persons_per_building: float
    period_shares: dict[str, float]
    storey_shares: dict[str, float]

    def estimate(self, population: float) -> BuildingCounts:
        total = population / self.persons_per_building
        return BuildingCounts(
            by_period={k: total * s for k, s in self.period_shares.items()},
            by_storeys={k: total * s for k, s in self.storey_shares.items()},
        )

    def to_json(self) -> dict[str, Any]:
        return {
            "method": (
                "Persons per building and period/storey shares from İstanbul districts with "
                f"population density below {REFERENCE_MAX_DENSITY_PER_KM2:.0f} per km² (İBB 2017)."
            ),
            "personsPerBuilding": round(self.persons_per_building, 2),
            "periodShares": {k: round(v, 4) for k, v in self.period_shares.items()},
            "storeyShares": {k: round(v, 4) for k, v in self.storey_shares.items()},
        }


def fit_estimator(references: list[tuple[float, BuildingCounts]]) -> Estimator:
    """`references` holds (population, buildings) for the reference districts."""
    if not references:
        raise ValueError("no reference districts for the building estimate")
    pooled = BuildingCounts()
    population = 0.0
    for district_population, counts in references:
        pooled.add(counts)
        population += district_population
    storey_total = sum(pooled.by_storeys.values())
    return Estimator(
        persons_per_building=population / pooled.total,
        period_shares={k: v / pooled.total for k, v in pooled.by_period.items()},
        storey_shares={k: v / storey_total for k, v in pooled.by_storeys.items()},
    )


def build(output_dir: Path = OUTPUT_DIR) -> None:
    districts = json.loads((output_dir / "districts.geojson").read_text("utf-8"))["features"]
    cells = read_float32_grid(output_dir / "district-cells.f32", GRID_1KM)
    population_grid = read_float32_grid(output_dir / "population.f32", GRID_1KM).astype(np.float64)

    count = len(districts)
    population = zonal_sums(cells, population_grid, count)
    area = zonal_sums(cells, cell_area_km2(*GRID_1KM.shape), count)
    ibb = read_ibb_buildings(
        decode_turkish(fetch(IBB_BUILDINGS_URL, "ibb-2017-mahalle-bina-sayilari.csv").read_bytes())
    )

    observed: dict[int, BuildingCounts] = {}
    for feature in districts:
        props = feature["properties"]
        if props["province"] == ISTANBUL:
            counts = ibb.get(turkish_key(props["name"]))
            if counts is None:
                raise ValueError(f"no İBB building counts for {props['name']}")
            observed[props["index"]] = counts

    references = [
        (float(population[index]), counts)
        for index, counts in observed.items()
        if area[index] > 0 and population[index] / area[index] < REFERENCE_MAX_DENSITY_PER_KM2
    ]
    estimator = fit_estimator(references)

    rows: list[dict[str, Any]] = []
    for feature in districts:
        index = feature["properties"]["index"]
        counts = observed.get(index) or estimator.estimate(float(population[index]))
        rows.append(
            {
                "index": index,
                "id": feature["properties"]["id"],
                "population": round(float(population[index])),
                "areaKm2": round(float(area[index]), 1),
                "buildings": counts.to_json(),
                "buildingSource": "ibb-2017" if index in observed else "estimated",
            }
        )

    output = {"districts": rows, "estimation": estimator.to_json()}
    (output_dir / OUTPUT_FILE).write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n", "utf-8"
    )
    record(
        output_dir,
        "districtStats",
        OUTPUT_FILE,
        format="json",
        sources=[IBB_SOURCE],
        notes="Population from the population dataset; building counts outside İstanbul are "
        "estimates (see `estimation`).",
        stats={
            "districts": count,
            "observed": len(observed),
            "referenceDistricts": len(references),
            "personsPerBuilding": round(estimator.persons_per_building, 2),
            "unassignedPopulation": round(
                float(population_grid[~np.isfinite(cells)].sum())  # outside every district
            ),
            "buildingsTotal": round(sum(r["buildings"]["total"] for r in rows)),
        },
    )
