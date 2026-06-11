"""Worldwide region sustainability leaderboard."""

from __future__ import annotations

import pandas as pd

from hydrawatch.estimation import estimate_footprint
from hydrawatch.latency import get_latency
from hydrawatch.scoring import compute_sustainability_score, score_label
from hydrawatch.wue_data import get_wue


def global_leaderboard(
    regions_df: pd.DataFrame,
    user_location: str,
    qps: float = 100,
    avg_tokens: int = 1000,
    gpu_type: str = "A100",
    model_name: str = "LLaMA-3-70B",
    max_latency_ms: int = 200,
    top_n: int = 15,
) -> list[dict]:
    """Top sustainable regions worldwide for a workload."""
    rows = []
    for _, r in regions_df.iterrows():
        if pd.isna(r.get("water_stress_score")):
            continue
        rc = r["region_code"]
        provider = r["provider"]
        latency = get_latency(user_location, rc)
        if latency > max_latency_ms:
            continue
        carbon = float(r["carbon_kg_per_kwh"])
        stress = float(r["water_stress_score"])
        drought = float(r.get("drought_risk", 2.0))
        wue = get_wue(rc)
        score = compute_sustainability_score(stress, drought, wue, carbon, latency, max_latency_ms)
        fp = estimate_footprint(qps, avg_tokens, gpu_type, model_name, rc, carbon, provider)
        if not fp:
            continue
        rows.append({
            "provider": provider,
            "region_code": rc,
            "region_name": r["region_name"],
            "country": r["country"],
            "continent": _continent(r["country"]),
            "sustainability_score": score,
            "score_label": score_label(score),
            "carbon_month_kg": fp.carbon_month.mid,
            "water_month_L": fp.water_month.mid,
            "latency_ms": latency,
            "carbon_intensity": carbon,
        })
    rows.sort(key=lambda x: -x["sustainability_score"])
    for i, row in enumerate(rows[:top_n]):
        row["rank"] = i + 1
    return rows[:top_n]


def _continent(country: str) -> str:
    mapping = {
        "India": "Asia", "Singapore": "Asia", "Japan": "Asia", "South Korea": "Asia",
        "Australia": "Oceania", "United States": "Americas", "Brazil": "Americas",
        "Canada": "Americas", "Germany": "Europe", "United Kingdom": "Europe",
        "France": "Europe", "Sweden": "Europe", "Norway": "Europe", "Finland": "Europe",
        "Ireland": "Europe", "Netherlands": "Europe", "Belgium": "Europe",
        "Switzerland": "Europe", "Italy": "Europe", "South Africa": "Africa",
        "Bahrain": "Middle East", "Hong Kong": "Asia", "Taiwan": "Asia",
    }
    return mapping.get(country, "Global")
