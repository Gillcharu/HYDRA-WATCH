"""Build full verification bundle for an analysis run."""

from __future__ import annotations

from hydrawatch.provenance import DATASET_VERSION, METHODOLOGY_VERSION
from hydrawatch.verify.region_tiers import (
    carbon_field,
    energy_model_field,
    latency_field,
    water_stress_field,
    workload_field,
    wue_field,
)
from hydrawatch.verify.tiers import (
    VerifiedField,
    aggregate_footprint_tier,
    tier_uncertainty,
)


def build_verification_bundle(
    region_row: dict,
    current: dict,
    footprint,
    params: dict,
    ground_truth_checks: list[dict] | None = None,
) -> dict:
    provider = params.get("provider", "")
    rc = params.get("region_code", "")
    workload_src = params.get("workload_source", "scenario_template")

    fields: list[VerifiedField] = [
        water_stress_field(
            current.get("water_stress_score", 0),
            str(region_row.get("data_confidence", "medium")),
            current.get("water_stress_label", ""),
        ),
        wue_field(rc, provider, current.get("wue", 0)),
        carbon_field(
            current.get("carbon_factor", 0),
            current.get("carbon_source", ""),
            current.get("carbon_mode", "static"),
            str(region_row.get("carbon_confidence", "medium")),
            rc,
        ),
        latency_field(current.get("latency_ms", 0), current.get("latency_source", "")),
        workload_field(params.get("qps", 0), workload_src, params.get("tokens", 0)),
        energy_model_field(
            params.get("gpu", "A100"),
            footprint.utilization,
            footprint.gpus_needed,
            getattr(footprint, "energy_tier", "V0"),
            getattr(footprint, "energy_basis", ""),
        ),
    ]

    input_tiers = [f.tier for f in fields]
    footprint_tier = aggregate_footprint_tier(*input_tiers)
    if ground_truth_checks and any(g.get("pass") for g in ground_truth_checks):
        footprint_tier = "V4"

    unc = tier_uncertainty(footprint_tier)
    water_mid = footprint.water_month.mid
    carbon_mid = footprint.carbon_month.mid

    return {
        "methodology_version": METHODOLOGY_VERSION,
        "dataset_version": DATASET_VERSION,
        "footprint_tier": footprint_tier,
        "footprint_uncertainty_pct": unc,
        "fields": [f.to_dict() for f in fields],
        "footprint_verified": {
            "water_L_month": {
                "mid": water_mid,
                "low": round(water_mid * (1 - unc)),
                "high": round(water_mid * (1 + unc)),
                "tier": footprint_tier,
                "disclosure_safe": footprint_tier in ("V3", "V4"),
            },
            "carbon_kg_month": {
                "mid": carbon_mid,
                "low": round(carbon_mid * (1 - unc)),
                "high": round(carbon_mid * (1 + unc)),
                "tier": footprint_tier,
                "disclosure_safe": footprint_tier in ("V3", "V4"),
            },
        },
        "ground_truth": ground_truth_checks or [],
        "rules": {
            "V0": "Comparative exploration only",
            "V1": "Cite public source; use ranges not point values",
            "V2": "Suitable for internal planning",
            "V3": "Current grid conditions; cite timestamp",
            "V4": "Suitable for ESG appendix with provider export",
        },
    }
