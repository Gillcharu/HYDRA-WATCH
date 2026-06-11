"""Serialize analysis results for JSON API responses."""

from __future__ import annotations

from dataclasses import asdict, is_dataclass

from hydrawatch.estimation import FootprintEstimate, MetricRange


def _metric_range(m: MetricRange) -> dict:
    return {"low": m.low, "mid": m.mid, "high": m.high, "unit": m.unit}


def serialize_footprint(fp: FootprintEstimate) -> dict:
    return {
        "water_L_month": _metric_range(fp.water_month),
        "carbon_kg_month": _metric_range(fp.carbon_month),
        "cost_usd_month": fp.cost_month_usd,
        "gpus": fp.gpus_needed,
        "pue": fp.pue,
        "wue": fp.wue,
        "utilization": fp.utilization,
        "energy_tier": getattr(fp, "energy_tier", "V0"),
        "energy_basis": getattr(fp, "energy_basis", ""),
        "assumptions": fp.assumptions,
        "embodied_carbon_kg_month": _metric_range(fp.embodied_carbon_month) if getattr(fp, "embodied_carbon_month", None) else None,
        "total_carbon_kg_month": _metric_range(fp.total_carbon_month) if getattr(fp, "total_carbon_month", None) else None,
        "embodied_water_L_month": _metric_range(fp.embodied_water_month) if getattr(fp, "embodied_water_month", None) else None,
        "total_water_L_month": _metric_range(fp.total_water_month) if getattr(fp, "total_water_month", None) else None,
        "offset_cost_usd_month": getattr(fp, "offset_cost_usd_month", 0.0),
        "tree_absorption_months": getattr(fp, "tree_absorption_months", 0.0),
        "quantization": getattr(fp, "quantization", "FP16"),
        "framework": getattr(fp, "framework", "standard"),
    }


def serialize_analysis(result: dict) -> dict:
    c = result["current"]
    fp = c["footprint"]
    return {
        "disclaimer": result.get("disclaimer"),
        "current": {
            "provider": c["provider"],
            "region_code": c["region_code"],
            "region_name": c["region_name"],
            "country": c.get("country"),
            "sustainability_score": c["sustainability_score"],
            "score_label": c["score_label"],
            "score_components": c.get("score_components", {}),
            "carbon_mode": c.get("carbon_mode"),
            "carbon_source": c.get("carbon_source"),
            "latency_ms": c.get("latency_ms"),
            "cluster": c.get("cluster"),
            "water_stress_score": c.get("water_stress_score"),
            "water_stress_label": c.get("water_stress_label"),
            "drought_risk": c.get("drought_risk"),
            "footprint": serialize_footprint(fp),
        },
        "multicloud": result.get("multicloud", []),
        "alternatives": result.get("alternatives", []),
        "validation": result.get("validation", []),
        "verification": result.get("verification", {}),
        "provenance": result.get("provenance", {}),
    }
