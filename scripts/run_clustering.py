#!/usr/bin/env python3
"""Generate region sustainability clusters."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from hydrawatch.analysis import load_regions
from hydrawatch.clustering import cluster_regions, save_clusters

DATA = ROOT / "data"

if __name__ == "__main__":
    df = load_regions()
    result = cluster_regions(df)
    out = DATA / "region_clusters.json"
    save_clusters(result, out)
    print(f"Wrote {out}")
    for cid, info in result["summary"].items():
        print(f"Cluster {cid}: {info['label']} — {info['count']} regions")
