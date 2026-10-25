from quaketrace_pipeline.datasets.stations import is_permanent_network, merge, parse_channels

HEADER = (
    "#Network|Station|Location|Channel|Latitude|Longitude|Elevation|Depth|Azimuth|Dip|"
    "SensorDescription|Scale|ScaleFreq|ScaleUnits|SampleRate|StartTime|EndTime"
)


def row(network: str, station: str, channel: str, lat: str = "40.5", lon: str = "29.0") -> str:
    return (
        f"{network}|{station}||{channel}|{lat}|{lon}|120.0|0.0|0|0|sensor|1|1|m/s|100|2010-01-01|"
    )


def test_parse_channels_groups_rows_per_station_and_flags_sensors() -> None:
    text = "\n".join(
        [
            HEADER,
            row("KO", "ARMT", "HHZ"),
            row("KO", "ARMT", "HNZ"),
            row("KO", "ARMT", "HNE"),
            row("KO", "BGKT", "EHZ", "41.1", "28.9"),
        ]
    )
    stations = parse_channels(text)

    assert [s["id"] for s in stations] == ["KO.ARMT", "KO.BGKT"]
    armt = stations[0]
    assert armt["channels"] == ["HHZ", "HNE", "HNZ"]
    assert armt["accelerometer"] is True
    assert armt["broadband"] is True
    assert armt["shortPeriod"] is False
    assert stations[1]["shortPeriod"] is True
    assert stations[1]["lat"] == 41.1


def test_merge_prefers_the_primary_source() -> None:
    primary = parse_channels(row("KO", "ARMT", "HHZ"))
    secondary = parse_channels("\n".join([row("KO", "ARMT", "BHZ"), row("TK", "2202", "HNZ")]))
    merged = merge(primary, secondary)
    assert [s["id"] for s in merged] == ["KO.ARMT", "TK.2202"]
    assert merged[0]["channels"] == ["HHZ"]


def test_temporary_networks_are_recognized() -> None:
    assert is_permanent_network("KO")
    assert is_permanent_network("TK")
    assert not is_permanent_network("ZQ")
    assert not is_permanent_network("6G")
    assert not is_permanent_network("XB")
