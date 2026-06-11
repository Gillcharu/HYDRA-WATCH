"""Anomaly detection on footprint and telemetry."""

from __future__ import annotations

from hydrawatch.db import load_footprint_history_db, record_footprint_db


def _load_history() -> list[dict]:
    return load_footprint_history_db()


def record_footprint(region_code: str, water: float, carbon: float, qps: float) -> None:
    record_footprint_db(region_code, water, carbon, qps)


def detect_anomalies(water: float, carbon: float, qps: float) -> list[dict]:
    """Flag spikes vs historical baseline (z-score)."""
    hist = _load_history()
    if len(hist) < 5:
        return [{"type": "info", "message": "Collecting baseline (need 5+ runs for anomaly detection)."}]

    alerts = []
    for metric, val, key in [("Water", water, "water"), ("Carbon", carbon, "carbon"), ("QPS", qps, "qps")]:
        vals = [h[key] for h in hist if key in h]
        if not vals:
            continue
        mean, std = np_mean_std(vals)
        if std < 1e-6:
            continue
        z = (val - mean) / std
        if abs(z) > 2.0:
            direction = "spike" if z > 0 else "drop"
            alerts.append({
                "type": "warning",
                "metric": metric,
                "message": f"{metric} {direction}: {val:,.0f} vs baseline {mean:,.0f} (z={z:.1f}).",
                "z_score": round(z, 2),
            })
    return alerts or [{"type": "ok", "message": "Footprint within normal range vs history."}]


def np_mean_std(vals: list[float]) -> tuple[float, float]:
    n = len(vals)
    mean = sum(vals) / n
    var = sum((x - mean) ** 2 for x in vals) / n
    return mean, var ** 0.5
