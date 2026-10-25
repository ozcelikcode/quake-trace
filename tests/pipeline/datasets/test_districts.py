import geopandas as gpd
import numpy as np
import pytest
from shapely.geometry import box

from quaketrace_pipeline.datasets.districts import (
    district_cells,
    normalize_name,
    select_districts,
    to_features,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Prince Islands", "Adalar"),
        ("Bilecik (merkez)", "Merkez"),
        ("Edirne merkez", "Merkez"),
        ("Kadıköy", "Kadıköy"),
        (" Gölcük ", "Gölcük"),
    ],
)
def test_normalize_name(raw: str, expected: str) -> None:
    assert normalize_name(raw) == expected


def test_select_districts_keeps_region_and_assigns_provinces() -> None:
    adm2 = gpd.GeoDataFrame(
        {"shapeID": ["b", "a", "far"], "shapeName": ["Zeta", "Alpha", "Far"]},
        geometry=[box(29.0, 40.9, 29.1, 41.0), box(28.9, 40.9, 29.0, 41.0), box(10, 45, 11, 46)],
        crs="EPSG:4326",
    )
    adm1 = gpd.GeoDataFrame(
        {"shapeName": ["İstanbul"]}, geometry=[box(28.5, 40.5, 29.5, 41.5)], crs="EPSG:4326"
    )
    districts = select_districts(adm2, adm1)
    features = to_features(districts)

    assert [f["properties"]["name"] for f in features] == ["Alpha", "Zeta"]
    assert [f["properties"]["index"] for f in features] == [0, 1]
    assert {f["properties"]["province"] for f in features} == {"İstanbul"}

    cells = district_cells(districts)
    assert set(np.unique(cells[np.isfinite(cells)]).tolist()) == {0.0, 1.0}
    assert np.isnan(cells).any()
