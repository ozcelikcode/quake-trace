import numpy as np
import pytest

from quaketrace_pipeline.datasets.roads import (
    FLAG_BRIDGE,
    FLAG_LINK,
    FLAG_ONEWAY,
    Way,
    build_graph,
    classify,
    encode,
    segment_lengths,
    simplify_indices,
)


def test_classify_major_roads_and_flags() -> None:
    assert classify({"highway": "residential"}) is None
    assert classify({"highway": "primary"}) == (2, 0, 0)
    assert classify({"highway": "trunk_link", "bridge": "viaduct"}) == (
        1,
        FLAG_LINK | FLAG_BRIDGE,
        0,
    )
    assert classify({"highway": "motorway"}) == (0, FLAG_ONEWAY, 1)
    assert classify({"highway": "motorway", "oneway": "no"}) == (0, 0, 0)
    assert classify({"highway": "secondary", "oneway": "-1"}) == (3, FLAG_ONEWAY, -1)
    assert classify({"highway": "tertiary", "junction": "roundabout"}) == (4, FLAG_ONEWAY, 1)


def test_segment_lengths_match_a_degree_of_latitude() -> None:
    lengths = segment_lengths(np.array([[29.0, 40.0], [29.0, 41.0]]))
    assert lengths[0] == pytest.approx(111_195, rel=1e-3)


def test_simplify_drops_collinear_points_and_keeps_corners() -> None:
    straight = np.array([[29.0, 40.0], [29.001, 40.0], [29.002, 40.0], [29.003, 40.0]])
    assert simplify_indices(straight, 25.0) == [0, 3]
    corner = np.array([[29.0, 40.0], [29.01, 40.0], [29.01, 40.01]])
    assert simplify_indices(corner, 25.0) == [0, 1, 2]


def way(ids: list[int], coords: list[tuple[float, float]], oneway: int = 0) -> Way:
    return Way(node_ids=ids, coords=coords, road_class=2, flags=0, oneway=oneway)


def test_build_graph_splits_at_intersections_and_respects_one_way() -> None:
    # A two-way road crossing a one-way road at node 2.
    ways = [
        way([1, 2, 3], [(29.0, 40.0), (29.01, 40.0), (29.02, 40.0)]),
        way([4, 2, 5], [(29.01, 39.99), (29.01, 40.0), (29.01, 40.01)], oneway=1),
    ]
    graph = build_graph(ways)

    assert graph.node_count == 5
    # Two-way road: 2 segments x 2 directions; one-way road: 2 segments x 1 direction.
    assert graph.edge_count == 6
    assert graph.offsets[-1] == graph.edge_count
    assert np.all(np.diff(graph.offsets.astype(np.int64)) >= 0)
    assert float(graph.length_m.sum()) == pytest.approx(4 * 853 + 2 * 1112, rel=0.01)


def test_encode_describes_every_section() -> None:
    graph = build_graph([way([1, 2], [(29.0, 40.0), (29.01, 40.0)])])
    data, layout = encode(graph)
    assert layout["nodeCount"] == 2
    assert layout["edgeCount"] == 2
    last = layout["sections"][-1]
    assert last["byteOffset"] + last["length"] == len(data)
    offsets = [section["byteOffset"] for section in layout["sections"]]
    assert offsets == sorted(offsets)
