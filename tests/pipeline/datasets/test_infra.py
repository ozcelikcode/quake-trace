from quaketrace_pipeline.datasets.infra import is_gas_pipeline, point_feature, point_kind


def test_point_kind_maps_supported_tags() -> None:
    assert point_kind({"amenity": "hospital"}) == "hospital"
    assert point_kind({"amenity": "fire_station"}) == "fireStation"
    assert point_kind({"emergency": "assembly_point"}) == "assemblyPoint"
    assert point_kind({"power": "substation"}) == "substation"
    assert point_kind({"amenity": "school"}) is None


def test_gas_pipelines_only() -> None:
    assert is_gas_pipeline({"man_made": "pipeline", "substance": "gas"})
    assert is_gas_pipeline({"man_made": "pipeline", "substance": "natural_gas"})
    assert not is_gas_pipeline({"man_made": "pipeline", "substance": "water"})


def test_point_feature_keeps_name_and_numeric_beds() -> None:
    feature = point_feature("n1", "hospital", 29.123456789, 41.0, {"name": "Devlet", "beds": "250"})
    assert feature["geometry"]["coordinates"] == [29.12346, 41.0]
    assert feature["properties"] == {"id": "n1", "kind": "hospital", "name": "Devlet", "beds": 250}
    assert "beds" not in point_feature("n2", "hospital", 29, 41, {"beds": "~200"})["properties"]
    assert "beds" not in point_feature("n3", "hospital", 29, 41, {"beds": "0"})["properties"]
