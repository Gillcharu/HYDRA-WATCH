"""Cross-provider region comparison with migration economics."""

from __future__ import annotations

import pandas as pd

from hydrawatch.estimation import estimate_footprint
from hydrawatch.latency import get_latency
from hydrawatch.migration import adjusted_score, gpu_available, migration_cost
from hydrawatch.recommendations import is_pareto_improvement
from hydrawatch.scoring import compute_sustainability_score, score_label
from hydrawatch.wue_data import get_wue


def compare_all_providers(
    regions_df: pd.DataFrame,
    current_provider: str,
    current_region_code: str,
    current_fp,
    current_stress: float,
    current_drought: float,
    qps: float,
    avg_tokens: float,
    gpu_type: str,
    model_name: str,
    user_location: str,
    max_latency_ms: int,
    cost_tolerance_pct: float = 10.0,
    weights: dict[str, float] | None = None,
    top_n: int = 8,
    workload_mode: str = "inference",
    data_tb: float = 5.0,
    quantization: str = "FP16",
    framework: str = "standard",
) -> list[dict]:
    cur_water = current_fp.water_month.mid
    cur_carbon = current_fp.carbon_month.mid
    cur_cost = current_fp.cost_month_usd
    cur_latency = get_latency(user_location, current_region_code)

    results = []
    for _, r in regions_df.iterrows():
        if pd.isna(r.get("water_stress_score")):
            continue
        rc = r["region_code"]
        provider = r["provider"]
        if rc == current_region_code and provider == current_provider:
            continue

        latency = get_latency(user_location, rc)
        if latency > max_latency_ms:
            continue

        if not gpu_available(rc, gpu_type):
            continue

        wue = get_wue(rc)
        carbon = float(r["carbon_kg_per_kwh"])
        stress = float(r["water_stress_score"])
        drought = float(r.get("drought_risk", 2.0))

        fp = estimate_footprint(
            qps, avg_tokens, gpu_type, model_name, rc, carbon, provider,
            workload_mode=workload_mode,
            quantization=quantization, framework=framework,
        )
        if not fp:
            continue

        mig = migration_cost(current_provider, provider, data_tb=data_tb)
        total_cost = fp.cost_month_usd + (mig["one_time_usd"] / 12)

        score = compute_sustainability_score(
            stress, drought, wue, carbon, latency, max_latency_ms, weights
        )
        adj = adjusted_score(score, mig, gpu_ok=True)
        cross_cloud = provider != current_provider
        pareto = is_pareto_improvement(
            fp.water_month.mid, fp.carbon_month.mid, total_cost, latency,
            cur_water, cur_carbon, cur_cost, cur_latency, max_latency_ms, cost_tolerance_pct,
        )

        water_pct = round((cur_water - fp.water_month.mid) / max(cur_water, 1) * 100)
        carbon_pct = round((cur_carbon - fp.carbon_month.mid) / max(cur_carbon, 1) * 100)

        results.append({
            "provider": provider,
            "region_code": rc,
            "region_name": r["region_name"],
            "country": r["country"],
            "cross_cloud": cross_cloud,
            "sustainability_score": score,
            "adjusted_score": adj,
            "score_label": score_label(score),
            "water_month_L": fp.water_month.mid,
            "carbon_month_kg": fp.carbon_month.mid,
            "cost_month_usd": fp.cost_month_usd,
            "migration_cost_usd": mig["one_time_usd"],
            "latency_ms": latency,
            "water_savings_pct": water_pct,
            "carbon_savings_pct": carbon_pct,
            "pareto_improvement": pareto,
            "data_confidence": r.get("data_confidence", "medium"),
            "gpu_available": True,
        })

    results.sort(key=lambda x: (
        not x["pareto_improvement"], -x["adjusted_score"], not x["cross_cloud"]
    ))
    for i, row in enumerate(results[:top_n]):
        row["rank"] = i + 1
    return results[:top_n]
