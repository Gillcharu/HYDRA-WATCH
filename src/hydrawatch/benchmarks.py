"""MLPerf / published inference benchmarks — V2 energy basis."""

from __future__ import annotations

import json
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / "data" / "mlperf_benchmarks.json"


def load_benchmarks() -> dict:
    if DATA.exists():
        return json.loads(DATA.read_text()).get("benchmarks", {})
    return {}


def get_benchmark(model_name: str, gpu_type: str) -> dict | None:
    b = load_benchmarks().get(model_name, {}).get(gpu_type)
    if b:
        return {**b, "citation": json.loads(DATA.read_text()).get("_citation", "")}
    return None


def benchmark_tokens_per_sec(model_name: str, gpu_type: str, fallback: float) -> tuple[float, str]:
    b = get_benchmark(model_name, gpu_type)
    if b:
        return float(b["tokens_per_sec"]), b.get("source", "MLPerf")
    return fallback, "TDP heuristic"


def _tdp_watts(tdp: float, utilization: float) -> float:
    return tdp * (0.35 + 0.65 * utilization)


def benchmark_power_watts(model_name: str, gpu_type: str, tdp: float, utilization: float) -> tuple[float, str]:
    b = get_benchmark(model_name, gpu_type)
    if b:
        return float(b["avg_power_watts"]), b.get("source", "MLPerf measured power")
    return _tdp_watts(tdp, utilization), "GPU TDP model"
