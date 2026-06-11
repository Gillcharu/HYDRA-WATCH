"""Workload → energy → water → carbon estimation with benchmark-based energy (V2)."""

from __future__ import annotations

from dataclasses import dataclass

from hydrawatch.benchmarks import benchmark_power_watts, benchmark_tokens_per_sec
from hydrawatch.constants import (
    ESTIMATE_TIER,
    GPU_COST_PER_HOUR,
    GPU_SPECS,
    MODEL_SPECS,
    PUE,
    TOKENS_PER_SEC_PER_GPU,
)
from hydrawatch.providers import DEFAULT_GPU_COST
from hydrawatch.verify.tiers import tier_uncertainty
from hydrawatch.wue_data import get_wue

WORKLOAD_MODES = {
    "inference": {"utilization": 0.65, "hours_per_day": 24, "label": "24/7 inference serving"},
    "training": {"utilization": 0.90, "hours_per_day": 8, "label": "8h/day training burst"},
    "batch": {"utilization": 0.75, "hours_per_day": 4, "label": "4h/day batch jobs"},
}

GPU_EMBODIED_CARBON = {
    "A100": 1500.0,
    "H100": 2000.0,
    "V100": 1200.0,
    "T4": 300.0,
    "DEFAULT": 1000.0,
}
BASE_CHASSIS_EMBODIED_CARBON = 500.0
LIFECYCLE_MONTHS = 36.0

GPU_EMBODIED_WATER = {
    "A100": 5000.0,
    "H100": 8000.0,
    "V100": 4000.0,
    "T4": 1000.0,
    "DEFAULT": 3000.0,
}
BASE_CHASSIS_EMBODIED_WATER = 2000.0

QUANTIZATION_MULTIPLIERS = {
    "FP16": {"throughput": 1.0, "power": 1.0},
    "FP8": {"throughput": 1.8, "power": 0.85},
    "INT4": {"throughput": 2.8, "power": 0.75},
}

FRAMEWORK_MULTIPLIERS = {
    "standard": 1.0,
    "vllm": 2.0,
    "tensorrt": 2.5,
}


@dataclass
class MetricRange:
    low: float
    mid: float
    high: float
    unit: str

    def __str__(self) -> str:
        return f"{self.mid:,.1f} {self.unit} (range: {self.low:,.1f} – {self.high:,.1f})"


@dataclass
class FootprintEstimate:
    tier: str
    model_name: str
    gpus_needed: float
    utilization: float
    pue: float
    wue: float
    carbon_factor: float
    it_energy_kwh_day: float
    facility_energy_kwh_day: float
    water_month: MetricRange
    carbon_month: MetricRange
    cost_month_usd: float
    assumptions: list[str]
    workload_mode: str = "inference"
    hours_per_day: float = 24
    energy_basis: str = "TDP"
    energy_tier: str = "V0"
    embodied_carbon_month: MetricRange | None = None
    total_carbon_month: MetricRange | None = None
    embodied_water_month: MetricRange | None = None
    total_water_month: MetricRange | None = None
    offset_cost_usd_month: float = 0.0
    tree_absorption_months: float = 0.0
    quantization: str = "FP16"
    framework: str = "standard"


def _range(mid: float, pct: float, unit: str) -> MetricRange:
    return MetricRange(low=mid * (1 - pct), mid=mid, high=mid * (1 + pct), unit=unit)


def estimate_footprint(
    qps: float,
    avg_tokens: float,
    gpu_type: str,
    model_name: str,
    region_code: str,
    carbon_kg_per_kwh: float,
    provider: str,
    hours_per_day: float | None = None,
    utilization: float | None = None,
    workload_mode: str = "inference",
    footprint_tier_hint: str = "V1",
    quantization: str = "FP16",
    framework: str = "standard",
    live_pue: float | None = None,
    live_wue: float | None = None,
) -> FootprintEstimate | None:
    if gpu_type not in GPU_SPECS:
        return None
    if model_name not in MODEL_SPECS:
        model_name = "Custom/Unknown"

    mode = WORKLOAD_MODES.get(workload_mode, WORKLOAD_MODES["inference"])
    if hours_per_day is None:
        hours_per_day = mode["hours_per_day"]
    if utilization is None:
        utilization = mode["utilization"]

    # Apply framework and quantization modifiers
    q_mult = QUANTIZATION_MULTIPLIERS.get(quantization.upper(), QUANTIZATION_MULTIPLIERS["FP16"])
    f_mult = FRAMEWORK_MULTIPLIERS.get(framework.lower(), FRAMEWORK_MULTIPLIERS["standard"])

    multiplier = MODEL_SPECS[model_name]["compute_multiplier"]
    fallback_tps = TOKENS_PER_SEC_PER_GPU[gpu_type] / multiplier
    tps, tps_source = benchmark_tokens_per_sec(model_name, gpu_type, fallback_tps)
    
    # Scale throughput
    tps = tps * q_mult["throughput"] * f_mult
    tps_source = f"{tps_source} (optimizations: {framework}, {quantization})"
    
    gpus_needed = max(1.0, (qps * avg_tokens) / tps)

    tdp = GPU_SPECS[gpu_type]["tdp_watts"]
    # Adjust TDP based on quantization power efficiency
    adjusted_tdp = tdp * q_mult["power"]
    
    watts, power_source = benchmark_power_watts(model_name, gpu_type, adjusted_tdp, utilization)
    energy_tier = "V2" if "MLPerf" in power_source or "benchmark" in power_source.lower() else "V0"
    energy_basis = power_source

    it_energy_day = (watts * gpus_needed * hours_per_day) / 1000
    pue = live_pue if live_pue is not None else PUE.get(region_code, PUE["DEFAULT"])
    facility_energy_day = it_energy_day * pue
    wue = live_wue if live_wue is not None else get_wue(region_code)
    cost_per_hour = GPU_COST_PER_HOUR.get(gpu_type, {}).get(provider, DEFAULT_GPU_COST.get(provider, 3.50))

    water_mid = facility_energy_day * wue * 30
    carbon_mid = facility_energy_day * carbon_kg_per_kwh * 30
    cost_month = gpus_needed * cost_per_hour * hours_per_day * 30

    # Scope 3 Embodied carbon calculation (manufacturing)
    gpu_emb = GPU_EMBODIED_CARBON.get(gpu_type, GPU_EMBODIED_CARBON["DEFAULT"])
    total_emb = gpus_needed * (gpu_emb + BASE_CHASSIS_EMBODIED_CARBON)
    emb_month_mid = total_emb / LIFECYCLE_MONTHS

    # Scope 3 Embodied water calculation (manufacturing)
    gpu_water_emb = GPU_EMBODIED_WATER.get(gpu_type, GPU_EMBODIED_WATER["DEFAULT"])
    total_water_emb = gpus_needed * (gpu_water_emb + BASE_CHASSIS_EMBODIED_WATER)
    water_emb_month_mid = total_water_emb / LIFECYCLE_MONTHS

    unc = tier_uncertainty(footprint_tier_hint)

    # Offsets & Tree absorptions
    offset_cost = (carbon_mid + emb_month_mid) * 0.60
    tree_months = (carbon_mid + emb_month_mid) / 1.83

    assumptions = [
        f"Tier {ESTIMATE_TIER}: {mode['label']}",
        f"Energy ({energy_tier}): {watts:.0f}W × {gpus_needed:.1f} GPUs via {energy_basis}",
        f"Throughput: {tps:,.0f} tok/s/GPU ({tps_source})",
        f"Water: facility energy × WUE {wue} L/kWh",
        f"Carbon (Scope 2): facility energy × {carbon_kg_per_kwh} kg/kWh",
        f"Embodied Carbon (Scope 3): Amortized {gpu_emb:.0f}kg GPU + {BASE_CHASSIS_EMBODIED_CARBON:.0f}kg server chassis over {LIFECYCLE_MONTHS:.0f}mo",
        f"Embodied Water (Scope 3): Amortized {gpu_water_emb:.0f}L GPU + {BASE_CHASSIS_EMBODIED_WATER:.0f}L server chassis over {LIFECYCLE_MONTHS:.0f}mo",
    ]

    return FootprintEstimate(
        tier=ESTIMATE_TIER,
        model_name=model_name,
        gpus_needed=round(gpus_needed, 1),
        utilization=utilization,
        pue=pue,
        wue=wue,
        carbon_factor=carbon_kg_per_kwh,
        it_energy_kwh_day=round(it_energy_day, 2),
        facility_energy_kwh_day=round(facility_energy_day, 2),
        water_month=_range(water_mid, unc, "L"),
        carbon_month=_range(carbon_mid, unc, "kg CO2"),
        cost_month_usd=round(cost_month, 2),
        assumptions=assumptions,
        workload_mode=workload_mode,
        hours_per_day=hours_per_day,
        energy_basis=energy_basis,
        energy_tier=energy_tier,
        embodied_carbon_month=_range(emb_month_mid, unc, "kg CO2 (embodied)"),
        total_carbon_month=_range(carbon_mid + emb_month_mid, unc, "kg CO2 (total)"),
        embodied_water_month=_range(water_emb_month_mid, unc, "L (embodied)"),
        total_water_month=_range(water_mid + water_emb_month_mid, unc, "L (total)"),
        offset_cost_usd_month=round(offset_cost, 2),
        tree_absorption_months=round(tree_months, 1),
        quantization=quantization,
        framework=framework,
    )
