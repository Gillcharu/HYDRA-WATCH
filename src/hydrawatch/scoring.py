"""Sustainability scoring with drought-adjusted water risk."""

from __future__ import annotations


def normalize_drought(drought_risk: float, max_drought: float = 5.0) -> float:
    return min(max(drought_risk, 0.0), max_drought) / max_drought


def adjusted_water_stress(water_stress: float, drought_risk: float) -> float:
    """Amplify water stress in drought-prone basins."""
    return water_stress * (1 + 0.2 * normalize_drought(drought_risk))


DEFAULT_WEIGHTS = {"water": 0.35, "wue": 0.25, "carbon": 0.25, "latency": 0.15}


def score_components(
    water_stress_score: float,
    drought_risk: float,
    wue: float,
    carbon_factor: float,
    latency_ms: int,
    max_latency_ms: int,
) -> dict[str, float]:
    """Per-dimension scores on 0–100 scale (100 = best)."""
    effective_stress = adjusted_water_stress(water_stress_score, drought_risk)
    return {
        "Water & basin risk": round((1 - min(effective_stress, 5) / 5) * 100, 1),
        "Cooling efficiency (WUE)": round((1 - min(wue, 3.0) / 3.0) * 100, 1),
        "Grid carbon": round((1 - min(carbon_factor, 0.9) / 0.9) * 100, 1),
        "Latency fit": round(
            (1 - min(latency_ms, max_latency_ms) / max_latency_ms) * 100, 1
        ) if latency_ms < 999 else 0.0,
    }


def compute_sustainability_score(
    water_stress_score: float,
    drought_risk: float,
    wue: float,
    carbon_factor: float,
    latency_ms: int,
    max_latency_ms: int,
    weights: dict[str, float] | None = None,
) -> float:
    """
    Hydra Sustainability Score — 0 (worst) to 100 (best).

    Default weights: water+risk 35%, WUE 25%, carbon 25%, latency 15%.
    """
    w = weights or DEFAULT_WEIGHTS
    comps = score_components(
        water_stress_score, drought_risk, wue, carbon_factor, latency_ms, max_latency_ms
    )
    keys = ["Water & basin risk", "Cooling efficiency (WUE)", "Grid carbon", "Latency fit"]
    weight_keys = ["water", "wue", "carbon", "latency"]
    total_w = sum(w.get(k, 0) for k in weight_keys) or 1.0
    weighted = sum(
        (comps[label] / 100) * (w.get(wk, 0) / total_w)
        for label, wk in zip(keys, weight_keys)
    )
    return round(weighted * 100, 1)


def score_label(score: float) -> str:
    if score >= 80:
        return "Excellent"
    if score >= 60:
        return "Good"
    if score >= 40:
        return "Moderate"
    return "Poor"
