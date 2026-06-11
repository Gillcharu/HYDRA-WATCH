"""Data lineage and methodology metadata for trust/compliance."""

from __future__ import annotations

METHODOLOGY_VERSION = "2.1.0"
DATASET_VERSION = "2024.06-enriched-121"

PROVENANCE = {
    "water_stress": {
        "source": "WRI Aqueduct 4.0",
        "url": "https://www.wri.org/aqueduct",
        "year": 2023,
        "granularity": "Sub-national basin",
        "confidence": "high when basin-matched, medium when country-imputed",
    },
    "drought_risk": {
        "source": "WRI Aqueduct drought indicators",
        "year": 2023,
        "granularity": "Basin",
    },
    "wue": {
        "source": "AWS, GCP, Azure sustainability reports",
        "year": "2022-2023",
        "granularity": "Regional average (provider disclosure)",
        "note": "Facility-level WUE; not per-workload",
    },
    "carbon_intensity": {
        "source": "eGRID (US), IEA national grids, ENTSO-E patterns (EU)",
        "year": 2023,
        "granularity": "Grid zone / country",
        "live_api": "Electricity Maps (ELECTRICITY_MAPS_API_KEY)",
    },
    "energy": {
        "source": "GPU TDP × utilization × PUE",
        "year": 2024,
        "note": "Modeled IT draw — not metered telemetry",
    },
    "latency": {
        "source": "Published RTT benchmarks + haversine fallback",
        "granularity": "User location → region",
    },
}


def footprint_provenance(region_row: dict) -> list[dict]:
    """Per-metric lineage for a region result."""
    items = [
        {"metric": "Water stress", **PROVENANCE["water_stress"],
         "value": region_row.get("water_stress_score"),
         "field_confidence": region_row.get("data_confidence", "medium")},
        {"metric": "Drought risk", **PROVENANCE["drought_risk"],
         "value": region_row.get("drought_risk")},
        {"metric": "WUE", **PROVENANCE["wue"],
         "value": region_row.get("wue")},
        {"metric": "Carbon intensity", **PROVENANCE["carbon_intensity"],
         "value": region_row.get("carbon_factor"),
         "source_detail": region_row.get("carbon_source", ""),
         "field_confidence": region_row.get("carbon_confidence", "medium")},
        {"metric": "Energy model", **PROVENANCE["energy"]},
        {"metric": "Latency", **PROVENANCE["latency"],
         "value": region_row.get("latency_ms")},
    ]
    return items
