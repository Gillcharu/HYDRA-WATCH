#!/usr/bin/env python3
"""Generate per-region WUE, hourly carbon patterns, and GPU availability."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

# Climate-based WUE heuristics (L/kWh) when provider disclosure unavailable
COUNTRY_WUE: dict[str, float] = {
    "Sweden": 0.8, "Norway": 0.85, "Finland": 0.75, "Ireland": 1.2,
    "France": 1.0, "Germany": 1.3, "Netherlands": 1.1, "Belgium": 1.1,
    "United Kingdom": 1.2, "Switzerland": 0.9, "Italy": 1.4, "Spain": 1.5,
    "United States": 1.7, "Canada": 1.3, "India": 2.4, "Singapore": 2.0,
    "Australia": 1.9, "Japan": 1.6, "South Korea": 1.7, "Brazil": 1.5,
    "South Africa": 2.0, "Bahrain": 2.2, "Hong Kong": 2.0, "Taiwan": 1.8,
}

# Grid zone → hourly shape template (24 factors, normalized ~1.0 avg)
TEMPLATES = {
    "solar_heavy": [0.85, 0.82, 0.80, 0.78, 0.80, 0.88, 0.95, 1.0, 1.05, 1.08, 1.10, 1.12,
                    1.10, 1.08, 1.05, 1.02, 1.0, 1.05, 1.10, 1.08, 1.02, 0.98, 0.92, 0.88],
    "nuclear_hydro": [0.95, 0.94, 0.93, 0.92, 0.91, 0.92, 0.95, 0.98, 1.0, 1.02, 1.01, 0.99,
                      0.97, 0.96, 0.95, 0.96, 0.98, 1.0, 1.02, 1.01, 0.99, 0.97, 0.96, 0.95],
    "coal_heavy": [0.85, 0.82, 0.80, 0.78, 0.80, 0.85, 0.92, 0.98, 1.0, 1.02, 1.05, 1.08,
                   1.10, 1.08, 1.05, 1.02, 1.0, 1.05, 1.10, 1.08, 1.02, 0.98, 0.92, 0.88],
    "mixed": [0.90, 0.88, 0.86, 0.85, 0.87, 0.90, 0.95, 0.98, 1.0, 1.02, 1.03, 1.04,
              1.05, 1.04, 1.03, 1.02, 1.0, 1.05, 1.10, 1.08, 1.02, 0.98, 0.95, 0.92],
}

GRID_TEMPLATE = {
    "Sweden": "nuclear_hydro", "Norway": "nuclear_hydro", "Finland": "nuclear_hydro",
    "France": "nuclear_hydro", "India": "coal_heavy", "Australia": "coal_heavy",
    "DEFAULT": "mixed",
}

GPUS = ["A100", "H100", "V100", "T4"]
# Most major regions support common GPUs; flag gaps
NO_H100 = {"af-south-1", "me-south-1", "southafricanorth", "brazilsouth"}
DO_REGIONS = {"nyc1", "nyc3", "sfo3", "ams3", "lon1", "fra1", "sgp1", "tor1", "blr1", "syd1"}
LIMITED_GPU = {"A100", "V100", "T4"}  # DigitalOcean — no H100


def generate_wue(regions: pd.DataFrame) -> dict:
    from hydrawatch.constants import WUE as LEGACY
    out = dict(LEGACY)
    for _, r in regions.iterrows():
        rc = r["region_code"]
        if rc in out and rc != "DEFAULT":
            continue
        country = r["country"]
        out[rc] = round(COUNTRY_WUE.get(country, 1.8), 2)
    return out


def generate_carbon_patterns(regions: pd.DataFrame) -> dict:
    patterns = {}
    for _, r in regions.iterrows():
        rc = r["region_code"]
        carbon = float(r.get("carbon_kg_per_kwh", 0.4))
        source = str(r.get("carbon_source", ""))
        country = r["country"]
        tmpl_key = GRID_TEMPLATE.get(country, GRID_TEMPLATE["DEFAULT"])
        if carbon < 0.15:
            tmpl_key = "nuclear_hydro"
        elif carbon > 0.55:
            tmpl_key = "coal_heavy"
        patterns[rc] = {
            "grid": source or country,
            "annual_avg": carbon,
            "hourly_factor": TEMPLATES[tmpl_key],
        }
    patterns["_note"] = "Generated per-region patterns. Set ELECTRICITY_MAPS_API_KEY for live data."
    return patterns


# Electricity Maps zones by country (global coverage)
COUNTRY_ELECTRICITY_ZONE: dict[str, str] = {
    "Sweden": "SE", "Norway": "NO", "Finland": "FI", "France": "FR",
    "Germany": "DE", "Netherlands": "NL", "Belgium": "BE", "United Kingdom": "GB",
    "Ireland": "IE", "Switzerland": "CH", "Italy": "IT", "Spain": "ES",
    "India": "IN", "Singapore": "SG", "Japan": "JP", "South Korea": "KR",
    "Australia": "AU", "United States": "US", "Brazil": "BR", "Canada": "CA",
    "South Africa": "ZA", "Bahrain": "BH", "Hong Kong": "HK", "Taiwan": "TW",
}

US_REGION_ZONE: dict[str, str] = {
    "us-east-1": "US-MIDA-PJM", "us-east-2": "US-MIDA-MISO",
    "us-west-1": "US-CAL-CISO", "us-west-2": "US-NW-PACW",
    "eastus": "US-MIDA-PJM", "eastus2": "US-MIDA-PJM",
    "westus": "US-CAL-CISO", "westus2": "US-NW-PACW",
    "westus3": "US-SW-AZPS", "centralus": "US-MIDA-MISO",
}


def generate_electricity_zones(regions: pd.DataFrame) -> dict:
    zones = {}
    for _, r in regions.iterrows():
        rc = r["region_code"]
        if rc in US_REGION_ZONE:
            zones[rc] = US_REGION_ZONE[rc]
        else:
            zones[rc] = COUNTRY_ELECTRICITY_ZONE.get(r["country"], "")
    return {k: v for k, v in zones.items() if v}


def generate_gpu_availability(regions: pd.DataFrame) -> dict:
    avail = {}
    for _, r in regions.iterrows():
        rc = r["region_code"]
        gpus = list(GPUS)
        if rc in NO_H100:
            gpus.remove("H100")
        if rc in DO_REGIONS:
            gpus = list(LIMITED_GPU)
        avail[rc] = {"provider": r["provider"], "gpus": gpus}
    return avail


def main() -> None:
    path = DATA / "cloud_regions_enriched.csv"
    regions = pd.read_csv(path)
    wue = generate_wue(regions)
    carbon = generate_carbon_patterns(regions)
    gpu = generate_gpu_availability(regions)
    zones = generate_electricity_zones(regions)
    (DATA / "wue_by_region.json").write_text(json.dumps(wue, indent=2))
    (DATA / "carbon_hourly_patterns.json").write_text(json.dumps(carbon, indent=2))
    (DATA / "gpu_availability.json").write_text(json.dumps(gpu, indent=2))
    (DATA / "electricity_zones.json").write_text(json.dumps(zones, indent=2))
    print(f"WUE: {len(wue)} | Carbon: {len(carbon)-1} | GPU: {len(gpu)} | EM zones: {len(zones)}")


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(ROOT / "src"))
    main()
