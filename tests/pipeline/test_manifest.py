import hashlib
import json
from pathlib import Path

from quaketrace_pipeline.grid import GRID_1KM
from quaketrace_pipeline.manifest import Source, record

SOURCE = Source(name="Test", url="https://example.org", license="CC-BY-4.0", attribution="Test")


def test_record_writes_entry_with_checksum_and_grids(tmp_path: Path) -> None:
    (tmp_path / "a.f32").write_bytes(b"\x00" * 8)
    entry = record(tmp_path, "a", "a.f32", format="float32-grid", sources=[SOURCE], grid=GRID_1KM)

    manifest = json.loads((tmp_path / "manifest.json").read_text())
    assert manifest["version"] == 1
    assert manifest["grids"]["marmara-1km"]["nx"] == 500
    assert manifest["datasets"]["a"] == entry
    assert entry["bytes"] == 8
    assert entry["sha256"] == hashlib.sha256(b"\x00" * 8).hexdigest()
    assert entry["grid"] == "marmara-1km"


def test_record_writes_attribution_from_sources(tmp_path: Path) -> None:
    (tmp_path / "a.json").write_text("{}")
    record(tmp_path, "a", "a.json", format="json", sources=[SOURCE])

    attribution = (tmp_path / "ATTRIBUTION.md").read_text()
    assert "| `a` | [Test](https://example.org) | CC-BY-4.0 | Test |" in attribution


def test_record_keeps_other_entries_sorted(tmp_path: Path) -> None:
    for name in ("b", "a"):
        (tmp_path / f"{name}.json").write_text("{}")
        record(tmp_path, name, f"{name}.json", format="json", sources=[SOURCE])

    manifest = json.loads((tmp_path / "manifest.json").read_text())
    assert list(manifest["datasets"]) == ["a", "b"]
