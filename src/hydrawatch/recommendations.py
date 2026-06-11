"""Region alternatives with Pareto-improvement detection."""

from __future__ import annotations

import pandas as pd

from hydrawatch.wue_data import get_wue
from hydrawatch.latency import get_latency
from hydrawatch.estimation import FootprintEstimate, estimate_footprint
from hydrawatch.scoring import compute_sustainability_score, score_label


def is_pareto_improvement(
    alt_water: float,
    alt_carbon: float,
    alt_cost: float,
    alt_latency: int,
    cur_water: float,
    cur_carbon: float,
    cur_cost: float,
    cur_latency: int,
    max_latency_ms: int,
    cost_tolerance_pct: float = 10.0,
) -> bool:
    """Better on water AND carbon, no worse on cost/latency within tolerance."""
    cost_ok = alt_cost <= cur_cost * (1 + cost_tolerance_pct / 100)
    latency_ok = alt_latency <= max_latency_ms
    water_better = alt_water < cur_water
    carbon_better = alt_carbon < cur_carbon
    return water_better and carbon_better and cost_ok and latency_ok


def top_alternatives(
    regions_df: pd.DataFrame,
    provider: str,
    current_region_code: str,
    current_fp: FootprintEstimate,
    current_stress: float,
    current_drought: float,
    qps: float,
    avg_tokens: float,
    gpu_type: str,
    model_name: str,
    user_location: str,
    max_latency_ms: int,
    cost_tolerance_pct: float = 10.0,
    top_n: int = 5,
    weights: dict[str, float] | None = None,
    quantization: str = "FP16",
    framework: str = "standard",
) -> list[dict]:
    cur_water = current_fp.water_month.mid
    cur_carbon = current_fp.carbon_month.mid
    cur_cost = current_fp.cost_month_usd
    cur_latency = get_latency(user_location, current_region_code)
    cur_wue = current_fp.wue
    cur_carbon_factor = current_fp.carbon_factor

    alts = regions_df[
        (regions_df["provider"] == provider)
        & (regions_df["region_code"] != current_region_code)
        & (regions_df["water_stress_score"].notna())
    ].copy()

    alts["latency_ms"] = alts["region_code"].apply(
        lambda rc: get_latency(user_location, rc)
    )
    alts = alts[alts["latency_ms"] <= max_latency_ms]

    results = []
    for _, r in alts.iterrows():
        rc = r["region_code"]
        wue = get_wue(rc)
        carbon = float(r["carbon_kg_per_kwh"])
        stress = float(r["water_stress_score"])
        drought = float(r.get("drought_risk", 2.0))
        latency = int(r["latency_ms"])

        score = compute_sustainability_score(
            stress, drought, wue, carbon, latency, max_latency_ms, weights
        )

        fp = estimate_footprint(
            qps, avg_tokens, gpu_type, model_name, rc, carbon, provider,
            quantization=quantization, framework=framework,
        )
        if not fp:
            continue

        pareto = is_pareto_improvement(
            fp.water_month.mid,
            fp.carbon_month.mid,
            fp.cost_month_usd,
            latency,
            cur_water,
            cur_carbon,
            cur_cost,
            cur_latency,
            max_latency_ms,
            cost_tolerance_pct,
        )

        reasons = []
        if pareto:
            reasons.append("Pareto improvement: lower water + carbon within budget")
        if stress < current_stress:
            pct = round((current_stress - stress) / max(current_stress, 0.01) * 100)
            reasons.append(f"{pct}% lower water stress")
        if carbon < cur_carbon_factor:
            pct = round((cur_carbon_factor - carbon) / cur_carbon_factor * 100)
            reasons.append(f"{pct}% lower grid carbon intensity")
        if wue < cur_wue:
            pct = round((cur_wue - wue) / cur_wue * 100)
            reasons.append(f"{pct}% better WUE")
        if fp.cost_month_usd <= cur_cost * (1 + cost_tolerance_pct / 100):
            reasons.append(f"Cost within +{cost_tolerance_pct}% of current")
        if latency <= max_latency_ms:
            reasons.append(f"Latency {latency}ms (limit {max_latency_ms}ms)")

        results.append({
            "region_code": rc,
            "region_name": r["region_name"],
            "city": r["city"],
            "country": r["country"],
            "water_stress_score": round(stress, 2),
            "water_stress_label": r.get("water_stress_label", ""),
            "drought_risk": round(drought, 2),
            "wue": wue,
            "carbon_factor": carbon,
            "latency_ms": latency,
            "sustainability_score": score,
            "score_label": score_label(score),
            "water_month_L": fp.water_month.mid,
            "carbon_month_kg": fp.carbon_month.mid,
            "cost_month_usd": fp.cost_month_usd,
            "pareto_improvement": pareto,
            "data_confidence": r.get("data_confidence", "medium"),
            "reasons": reasons,
        })

    # Pareto wins first, then by sustainability score
    results.sort(key=lambda x: (not x["pareto_improvement"], -x["sustainability_score"]))
    for i, row in enumerate(results[:top_n]):
        row["rank"] = i + 1
    return results[:top_n]
