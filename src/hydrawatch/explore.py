"""Bulk region comparison and exploration for the web UI."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from hydrawatch.wue_data import get_wue
from hydrawatch.estimation import estimate_footprint
from hydrawatch.geo import REGION_COORDS
from hydrawatch.latency import get_latency
from hydrawatch.scoring import compute_sustainability_score, score_components

DATA_DIR = Path(__file__).resolve().parents[2] / "data"


def load_clusters() -> dict:
    path = DATA_DIR / "region_clusters.json"
    if path.exists():
        return json.loads(path.read_text())
    return {"assignments": {}, "summary": {}}


def compare_provider_regions(
    regions_df: pd.DataFrame,
    provider: str,
    qps: float,
    avg_tokens: float,
    gpu_type: str,
    model_name: str,
    user_location: str,
    max_latency_ms: int,
    weights: dict[str, float] | None = None,
) -> pd.DataFrame:
    """Score every region for a provider under the current workload."""
    clusters = load_clusters()
    rows = []
    subset = regions_df[regions_df["provider"] == provider]

    for _, r in subset.iterrows():
        if pd.isna(r.get("water_stress_score")):
            continue
        rc = r["region_code"]
        latency = get_latency(user_location, rc)
        if latency > max_latency_ms:
            continue

        carbon = float(r["carbon_kg_per_kwh"])
        stress = float(r["water_stress_score"])
        drought = float(r.get("drought_risk", 2.0))
        wue = get_wue(rc)

        fp = estimate_footprint(
            qps, avg_tokens, gpu_type, model_name, rc, carbon, provider
        )
        if not fp:
            continue

        score = compute_sustainability_score(
            stress, drought, wue, carbon, latency, max_latency_ms, weights
        )
        cluster = clusters.get("assignments", {}).get(rc, {})
        lat, lon = REGION_COORDS.get(rc, (None, None))

        rows.append({
            "provider": provider,
            "region_code": rc,
            "region_name": r["region_name"],
            "city": r["city"],
            "country": r["country"],
            "lat": lat,
            "lon": lon,
            "sustainability_score": score,
            "water_stress": stress,
            "drought_risk": drought,
            "wue": wue,
            "carbon_intensity": carbon,
            "latency_ms": latency,
            "water_month_L": fp.water_month.mid,
            "water_low": fp.water_month.low,
            "water_high": fp.water_month.high,
            "carbon_month_kg": fp.carbon_month.mid,
            "carbon_low": fp.carbon_month.low,
            "carbon_high": fp.carbon_month.high,
            "cost_month_usd": fp.cost_month_usd,
            "gpus_needed": fp.gpus_needed,
            "cluster_label": cluster.get("cluster_label", "Unknown"),
            "data_confidence": r.get("data_confidence", "medium"),
        })

    return pd.DataFrame(rows)


def build_comparison_frame(
    current: dict,
    alternatives: list[dict],
    label: str = "Current",
) -> pd.DataFrame:
    """Build a dataframe for radar / bar charts."""
    rows = [{
        "name": f"{label}: {current['region_name']}",
        "region_code": current["region_code"],
        "water_month_L": current["footprint"].water_month.mid,
        "carbon_month_kg": current["footprint"].carbon_month.mid,
        "cost_month_usd": current["footprint"].cost_month_usd,
        "score": current["sustainability_score"],
        "is_current": True,
        "pareto": False,
    }]
    for alt in alternatives:
        rows.append({
            "name": f"#{alt['rank']} {alt['region_name']}",
            "region_code": alt["region_code"],
            "water_month_L": alt["water_month_L"],
            "carbon_month_kg": alt["carbon_month_kg"],
            "cost_month_usd": alt["cost_month_usd"],
            "score": alt["sustainability_score"],
            "is_current": False,
            "pareto": alt.get("pareto_improvement", False),
        })
    return pd.DataFrame(rows)
