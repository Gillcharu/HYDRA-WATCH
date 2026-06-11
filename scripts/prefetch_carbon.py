#!/usr/bin/env python3
"""Prefetch live carbon from Electricity Maps for all electricity zones (optional)."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from hydrawatch.analysis import load_regions
from hydrawatch.carbon_live import fetch_live_carbon


def main() -> int:
    if not os.environ.get("ELECTRICITY_MAPS_API_KEY"):
        print("Set ELECTRICITY_MAPS_API_KEY to prefetch live carbon.")
        return 1
    df = load_regions()
    zones = sorted({str(z) for z in df["electricity_zone"].dropna() if z})
    cache: dict[str, dict] = {}
    for zone in zones:
        result = fetch_live_carbon(zone)
        if result:
            carbon, source, mode, as_of = result
            cache[zone] = {"carbon_kg_per_kwh": carbon, "source": source, "mode": mode, "as_of": as_of}
            print(f"  {zone}: {carbon} kg/kWh ({source})")
    out = ROOT / "data" / "carbon_live_cache.json"
    out.write_text(json.dumps(cache, indent=2))
    print(f"Wrote {len(cache)} zones to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
