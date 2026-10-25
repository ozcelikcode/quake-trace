from pathlib import Path

import numpy as np
import pytest

from quaketrace_pipeline.datasets.cells import (
    ENV_KEY,
    RADIO_BITS,
    api_key,
    encode,
    merge_sites,
    read_cells,
)


def row(radio: str, lon: float, lat: float, range_m: int = 1000) -> list[str]:
    return [radio, "286", "1", "100", "200", "0", str(lon), str(lat), str(range_m), "5", "1"]


def test_read_cells_skips_header_and_outside_region() -> None:
    rows = [
        ["radio", "mcc", "net", "area", "cell", "unit", "lon", "lat", "range"],
        row("LTE", 29.0, 41.0),
        row("GSM", 35.0, 39.0),
    ]
    cells = read_cells(rows)
    assert len(cells) == 1
    assert cells[0].radio == RADIO_BITS["LTE"]


def test_merge_sites_combines_nearby_cells() -> None:
    cells = read_cells(
        [
            row("LTE", 29.00010, 41.00010, 800),
            row("GSM", 29.00020, 41.00020, 1500),
            row("NR", 29.01000, 41.00000, 300),
        ]
    )
    sites = merge_sites(cells)
    assert len(sites.cell_count) == 2
    merged = int(np.argmax(sites.cell_count))
    assert sites.cell_count[merged] == 2
    assert sites.radios[merged] == RADIO_BITS["LTE"] | RADIO_BITS["GSM"]
    assert sites.range_m[merged] == 1500

    data, layout = encode(sites)
    last = layout["sections"][-1]
    assert last["byteOffset"] + last["length"] == len(data)


def test_api_key_reads_environment_then_env_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    env_file = tmp_path / ".env"
    monkeypatch.delenv(ENV_KEY, raising=False)
    assert api_key(env_file) is None

    env_file.write_text(f"{ENV_KEY}='from-file'\n")
    assert api_key(env_file) == "from-file"

    monkeypatch.setenv(ENV_KEY, "from-env")
    assert api_key(env_file) == "from-env"
