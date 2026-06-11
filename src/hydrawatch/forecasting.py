"""Footprint time-series forecasting."""

from __future__ import annotations

import numpy as np


def forecast_footprint(
    water_month: float,
    carbon_month: float,
    qps: float,
    growth_pct_month: float = 10.0,
    months: int = 6,
) -> list[dict]:
    """Simple exponential growth forecast for planning."""
    g = 1 + growth_pct_month / 100
    out = []
    for m in range(months):
        factor = g ** m
        out.append({
            "month": m + 1,
            "qps": round(qps * factor, 1),
            "water_L": round(water_month * factor),
            "carbon_kg": round(carbon_month * factor),
        })
    return out


def forecast_chart_data(forecast: list[dict]) -> dict:
    return {
        "months": [f["month"] for f in forecast],
        "water": [f["water_L"] for f in forecast],
        "carbon": [f["carbon_kg"] for f in forecast],
    }
