"""Command line entry point.

`uv run quaketrace-pipeline build <dataset ...> | --all` prepares public/data;
`uv run quaketrace-pipeline fixtures` writes reference values for engine tests.
"""

import argparse
import sys
from collections.abc import Callable
from pathlib import Path

from . import fixtures
from .config import OUTPUT_DIR
from .datasets import (
    bathymetry,
    cells,
    district_stats,
    districts,
    elevation,
    faults,
    infra,
    population,
    roads,
    stations,
    vs30,
)

Builder = Callable[[Path], None]

# Build order matters: later datasets may read earlier outputs.
DATASETS: dict[str, Builder] = {
    "faults": faults.build,
    "districts": districts.build,
    "population": population.build,
    "districtStats": district_stats.build,
    "vs30": vs30.build,
    "elevation": elevation.build,
    "stations": stations.build,
    "bathymetry": bathymetry.build,
    "infra": infra.build,
    "roads": roads.build,
    "cells": cells.build,
}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="quaketrace-pipeline")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("list", help="list datasets")
    commands.add_parser("fixtures", help="write reference values for engine tests")
    build = commands.add_parser("build", help="build datasets into public/data")
    build.add_argument("datasets", nargs="*", metavar="dataset")
    build.add_argument("--all", action="store_true", help="build every dataset in order")
    args = parser.parse_args(argv)

    if args.command == "list":
        print("\n".join(DATASETS))
        return 0
    if args.command == "fixtures":
        fixtures.build_all()
        return 0

    names: list[str] = list(DATASETS) if args.all else args.datasets
    if not names:
        parser.error("name at least one dataset or pass --all")
    unknown = [name for name in names if name not in DATASETS]
    if unknown:
        parser.error(f"unknown dataset(s): {', '.join(unknown)}; see `list`")
    for name in names:
        print(f"[{name}]")
        DATASETS[name](OUTPUT_DIR)
    return 0


if __name__ == "__main__":
    sys.exit(main())
