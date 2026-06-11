"""CI/CD deploy gate — block high-carbon deployments."""

from __future__ import annotations

from dataclasses import dataclass

from hydrawatch.analysis import full_analysis, load_regions


@dataclass
class GateResult:
    passed: bool
    score: float
    footprint_tier: str
    message: str
    recommendation: str | None = None


async def run_deploy_gate(
    provider: str,
    region_code: str,
    min_score: float = 40.0,
    min_tier: str = "V0",
    qps: float = 100,
    avg_tokens: int = 1000,
    gpu_type: str = "A100",
    model_name: str = "LLaMA-3-70B",
    user_location: str = "Mumbai, India",
    max_latency_ms: int = 200,
    live_telemetry: bool = False,
) -> GateResult:
    from hydrawatch.verify.tiers import TIER_ORDER

    result = await full_analysis(
        provider, region_code, qps, avg_tokens, gpu_type, model_name,
        user_location, max_latency_ms, regions_df=load_regions(),
        record_history=False, live_telemetry=live_telemetry,
    )
    c = result["current"]
    score = c["sustainability_score"]
    tier = result["verification"]["footprint_tier"]
    tier_ok = TIER_ORDER.index(tier) >= TIER_ORDER.index(min_tier)
    score_ok = score >= min_score

    best = (result.get("multicloud") or [None])[0]
    rec = None
    if best and not (score_ok and tier_ok):
        rec = f"{best['provider']} {best['region_name']} (saves {best.get('carbon_savings_pct', 0)}% carbon)"

    passed = score_ok
    if min_tier != "V0":
        passed = passed and tier_ok

    msg = f"Score {score}/100 (min {min_score}), tier {tier} (min {min_tier})"
    return GateResult(passed=passed, score=score, footprint_tier=tier, message=msg, recommendation=rec)
