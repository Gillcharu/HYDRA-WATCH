"""Assign verification tier per input metric for a region."""

from __future__ import annotations

from hydrawatch.constants import WUE as DISCLOSED_WUE
from hydrawatch.providers import ALL_PROVIDERS
from hydrawatch.verify.tiers import VerifiedField, now_iso

AQUEDUCT_URL = "https://www.wri.org/aqueduct"
BIG3 = {"AWS", "GCP", "Azure"}


def water_stress_field(score: float, confidence: str, label: str) -> VerifiedField:
    tier = "V1" if confidence in ("high", "medium") else "V0"
    return VerifiedField(
        name="water_stress",
        value=score,
        tier=tier,
        source="WRI Aqueduct 4.0",
        source_url=AQUEDUCT_URL,
        as_of="2023",
        unit="/5",
        note=label or "",
    )


def wue_field(region_code: str, provider: str, wue: float) -> VerifiedField:
    disclosed = region_code in DISCLOSED_WUE and DISCLOSED_WUE.get(region_code) != DISCLOSED_WUE.get("DEFAULT")
    if provider in BIG3 and disclosed:
        tier, src = "V2", f"{provider} sustainability report 2022-2023"
        url = {
            "AWS": "https://sustainability.aboutamazon.com/",
            "GCP": "https://cloud.google.com/sustainability",
            "Azure": "https://azure.microsoft.com/en-us/explore/global-infrastructure/sustainability",
        }.get(provider, "")
    else:
        tier, src, url = "V0", "Country climate heuristic (not facility disclosure)", ""
    return VerifiedField(
        name="wue", value=wue, tier=tier, source=src, source_url=url, unit="L/kWh",
        note="Facility average; not per-workload" if tier == "V2" else "Imputed — validate before disclosure",
    )


def carbon_field(
    carbon: float, source: str, carbon_mode: str,
    carbon_confidence: str, region_code: str,
) -> VerifiedField:
    if carbon_mode == "live":
        tier = "V3"
        url = "https://www.electricitymaps.com/"
    elif carbon_confidence == "high":
        tier = "V1"
        url = "https://www.epa.gov/egrid" if "egrid" in source.lower() else "https://www.iea.org/"
    else:
        tier = "V1"
        url = "https://www.iea.org/"
    return VerifiedField(
        name="carbon_intensity", value=carbon, tier=tier, source=source,
        source_url=url, as_of=now_iso()[:10] if tier == "V3" else "2023",
        unit="kg CO2/kWh", note=f"region {region_code}",
    )


def latency_field(latency_ms: int, source: str) -> VerifiedField:
    if source == "measured_rtt_table":
        tier, note = "V2", "Published RTT benchmark"
    else:
        tier, note = "V0", "Geographic model — run synthetic probes for V3"
    return VerifiedField(
        name="latency", value=latency_ms, tier=tier,
        source=source, unit="ms", note=note,
    )


def workload_field(qps: float, source: str, tokens: int) -> VerifiedField:
    tiers = {
        "ccft": "V4", "gcp_carbon_export": "V4", "cloudwatch": "V3",
        "access_log": "V2", "billing_csv": "V2", "workload_csv": "V2",
    }
    tier = tiers.get(source, "V0")
    return VerifiedField(
        name="workload_qps", value=qps, tier=tier,
        source=source or "scenario_template",
        note=f"~{tokens} tokens/req",
    )


def energy_model_field(gpu_type: str, utilization: float, gpus: float, energy_tier: str = "V0", basis: str = "") -> VerifiedField:
    tier = energy_tier if energy_tier in ("V2", "V3", "V4") else "V0"
    src = basis or "GPU TDP × utilization × PUE"
    return VerifiedField(
        name="energy_model", value=f"{gpus}×{gpu_type}@{utilization:.0%}",
        tier=tier,
        source=src,
        source_url="https://mlcommons.org/en/inference-benchmarks/" if tier == "V2" else "",
        note="MLPerf-based when available; CCFT/CloudWatch for V4",
    )
