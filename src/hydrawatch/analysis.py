"""Full workload analysis orchestration."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from hydrawatch.anomaly import detect_anomalies, record_footprint
from hydrawatch.carbon_live import carbon_for_region
from hydrawatch.clustering import cluster_regions, save_clusters
from hydrawatch.constants import ESTIMATE_DISCLAIMER
from hydrawatch.estimation import estimate_footprint
from hydrawatch.forecasting import forecast_footprint
from hydrawatch.latency import estimate_latency_ms
from hydrawatch.multicloud import compare_all_providers
from hydrawatch.provenance import footprint_provenance
from hydrawatch.recommendations import top_alternatives
from hydrawatch.scoring import compute_sustainability_score, score_components, score_label
from hydrawatch.scope23 import scope23_report
from hydrawatch.validation import run_global_validation_checks, validate_footprint, validate_region
from hydrawatch.verify.bundle import build_verification_bundle
from hydrawatch.verify.ground_truth import GroundTruthReading, compare_ground_truth
from hydrawatch.wue_data import get_wue

DATA_DIR = Path(__file__).resolve().parents[2] / "data"


def load_regions() -> pd.DataFrame:
    enriched = DATA_DIR / "cloud_regions_enriched.csv"
    raw = DATA_DIR / "cloud_regions_with_water_stress.csv"
    path = enriched if enriched.exists() else raw
    return pd.read_csv(path)


async def full_analysis(
    provider: str,
    region_code: str,
    qps: float,
    avg_tokens: float,
    gpu_type: str,
    model_name: str = "LLaMA-3-8B",
    user_location: str = "India",
    max_latency_ms: int = 150,
    cost_tolerance_pct: float = 10.0,
    hours_per_day: float = 24,
    regions_df: pd.DataFrame | None = None,
    weights: dict[str, float] | None = None,
    workload_mode: str = "inference",
    data_tb: float = 5.0,
    growth_pct_month: float = 10.0,
    workload_source: str = "scenario_template",
    ground_truth_readings: list[GroundTruthReading] | None = None,
    record_history: bool = True,
    quantization: str = "FP16",
    workload_framework: str = "standard",
    live_telemetry: bool = False,
) -> dict:
    regions_df = regions_df if regions_df is not None else load_regions()

    row = regions_df[
        (regions_df["provider"] == provider) & (regions_df["region_code"] == region_code)
    ]
    if row.empty:
        raise ValueError(f"Region not found: {provider}/{region_code}")

    r = row.iloc[0]
    stress = float(r["water_stress_score"])
    drought = float(r.get("drought_risk", 2.0))
    static_carbon = float(r.get("carbon_kg_per_kwh", 0.40))
    carbon, carbon_source, carbon_mode, carbon_as_of = await carbon_for_region(region_code, static_carbon)
    
    # Live telemetry overrides
    live_pue, live_wue = None, None
    if live_telemetry:
        from hydrawatch.telemetry import get_live_telemetry
        tel = get_live_telemetry(region_code)
        live_pue = tel["pue"]
        live_wue = tel["wue"]
        wue = live_wue
    else:
        wue = get_wue(region_code)

    latency, latency_source = estimate_latency_ms(user_location, region_code)
    confidence = r.get("data_confidence", "medium")

    # Dynamic Scoring & Baseline Mapping
    curr_score = compute_sustainability_score(
        stress, drought, wue, carbon, latency, max_latency_ms, weights
    )
    components = score_components(stress, drought, wue, carbon, latency, max_latency_ms)

    fp = estimate_footprint(
        qps, avg_tokens, gpu_type, model_name, region_code, carbon, provider,
        hours_per_day, workload_mode=workload_mode,
        quantization=quantization, framework=workload_framework,
        live_pue=live_pue, live_wue=live_wue,
    )
    if not fp:
        raise ValueError(f"Unknown GPU type: {gpu_type}")

    if record_history:
        record_footprint(region_code, fp.water_month.mid, fp.carbon_month.mid, qps)
    anomalies = detect_anomalies(fp.water_month.mid, fp.carbon_month.mid, qps)
    forecast = forecast_footprint(fp.water_month.mid, fp.carbon_month.mid, qps, growth_pct_month)

    alts = top_alternatives(
        regions_df, provider, region_code, fp, stress, drought,
        qps, avg_tokens, gpu_type, model_name, user_location,
        max_latency_ms, cost_tolerance_pct, weights=weights,
        quantization=quantization, framework=workload_framework,
    )

    multicloud = compare_all_providers(
        regions_df, provider, region_code, fp, stress, drought,
        qps, avg_tokens, gpu_type, model_name, user_location,
        max_latency_ms, cost_tolerance_pct, weights,
        workload_mode=workload_mode, data_tb=data_tb,
        quantization=quantization, framework=workload_framework,
    )

    validation = validate_region(region_code, wue, carbon)
    validation += validate_footprint(region_code, fp.water_month.mid, fp.carbon_month.mid, fp.gpus_needed)

    gt_checks = []
    if ground_truth_readings:
        gt = compare_ground_truth(
            fp.carbon_month.mid, fp.water_month.mid,
            ground_truth_readings, provider, region_code,
        )
        if gt:
            validation.append(gt)
            gt_checks.append(gt)

    validation += run_global_validation_checks(regions_df)

    cluster_path = DATA_DIR / "region_clusters.json"
    if not cluster_path.exists():
        result = cluster_regions(regions_df)
        save_clusters(result, cluster_path)
    else:
        result = json.loads(cluster_path.read_text())

    current_cluster = result["assignments"].get(region_code, {})

    scope23 = scope23_report(
        {"water_L_month": {"mid": fp.water_month.mid}, "carbon_kg_month": {"mid": fp.carbon_month.mid}},
        {"carbon_factor": carbon, "carbon_source": carbon_source},
    )

    params = {
        "provider": provider, "region_code": region_code, "qps": qps,
        "tokens": avg_tokens, "gpu": gpu_type, "model": model_name,
        "workload_source": workload_source,
    }
    verification = build_verification_bundle(
        r.to_dict(), {}, fp, params, gt_checks  # current filled below
    )

    current = {
        "provider": provider,
        "region_code": region_code,
        "region_name": r["region_name"],
        "city": r["city"],
        "country": r["country"],
        "water_stress_score": round(stress, 2),
        "water_stress_label": r.get("water_stress_label", ""),
        "drought_risk": round(drought, 2),
        "wue": wue,
        "carbon_factor": carbon,
        "carbon_source": carbon_source,
        "carbon_mode": carbon_mode,
        "carbon_as_of": carbon_as_of,
        "latency_ms": latency,
        "latency_source": latency_source,
        "sustainability_score": curr_score,
        "score_components": components,
        "score_label": score_label(curr_score),
        "data_confidence": confidence,
        "cluster": current_cluster.get("cluster_label", "unknown"),
        "footprint": fp,
        "footprint_tier": verification["footprint_tier"],
    }
    verification = build_verification_bundle(r.to_dict(), current, fp, params, gt_checks)

    return {
        "disclaimer": ESTIMATE_DISCLAIMER,
        "current": current,
        "alternatives": alts,
        "multicloud": multicloud,
        "pareto_count": sum(1 for a in alts if a["pareto_improvement"]),
        "multicloud_pareto_count": sum(1 for a in multicloud if a["pareto_improvement"]),
        "validation": validation,
        "verification": verification,
        "anomalies": anomalies,
        "forecast": forecast,
        "scope23": scope23,
        "provenance": footprint_provenance({
            "water_stress_score": stress,
            "drought_risk": drought,
            "wue": wue,
            "carbon_factor": carbon,
            "carbon_source": carbon_source,
            "carbon_confidence": r.get("carbon_confidence", "medium"),
            "data_confidence": confidence,
            "latency_ms": latency,
        }),
    }


def print_analysis(result: dict) -> None:
    c = result["current"]
    fp = c["footprint"]
    print(f"\n{'=' * 60}")
    print(f"  {c['region_name']} ({c['region_code']}) — {c['provider']}")
    print(f"  Sustainability score: {c['sustainability_score']}/100 ({c['score_label']})")
    print(f"  Footprint tier: {result['verification']['footprint_tier']}")
    print(f"  Water:   {fp.water_month}")
    print(f"  Carbon:  {fp.carbon_month}")
    print(f"  Cost:    ${fp.cost_month_usd:,.0f}/month ({fp.gpus_needed} GPUs)")
    if result.get("multicloud"):
        best = result["multicloud"][0]
        print(f"\n  Best alternative: {best['provider']} {best['region_name']} "
              f"(saves {best.get('carbon_savings_pct', 0)}% carbon)")
    print(f"{'=' * 60}\n")
