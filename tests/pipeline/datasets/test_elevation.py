from quaketrace_pipeline.datasets.elevation import region_tiles, tile_name


def test_tile_names_follow_the_copernicus_pattern() -> None:
    assert tile_name(40, 28) == "Copernicus_DSM_COG_30_N40_00_E028_00_DEM"
    assert tile_name(-1, -5) == "Copernicus_DSM_COG_30_S01_00_W005_00_DEM"


def test_region_tiles_cover_the_engine_extent() -> None:
    tiles = region_tiles()
    assert (39, 26) in tiles
    assert (41, 30) in tiles
    assert len(tiles) == 3 * 5
