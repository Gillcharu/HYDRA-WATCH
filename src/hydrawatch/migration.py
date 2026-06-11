"""Cross-cloud migration cost, egress, and lock-in scoring."""

from __future__ import annotations

import json
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / "data"

# Known hyperscaler pairs (USD); unknown pairs use CROSS_CLOUD_DEFAULT
MIGRATION_BASE: dict[tuple[str, str], float] = {
    ("AWS", "GCP"): 15000, ("AWS", "Azure"): 12000,
    ("GCP", "AWS"): 15000, ("GCP", "Azure"): 10000,
    ("Azure", "AWS"): 12000, ("Azure", "GCP"): 10000,
}
CROSS_CLOUD_DEFAULT = 14000
SAME_PROVIDER = 0

EGRESS_PER_GB = {
    "AWS": 0.09, "GCP": 0.08, "Azure": 0.087, "OCI": 0.085,
    "IBM": 0.09, "Alibaba": 0.08, "DigitalOcean": 0.01, "DEFAULT": 0.09,
}
LOCK_IN_WEIGHT = {"same_provider": 0, "cross_cloud": 25}


def load_gpu_availability() -> dict:
    p = DATA / "gpu_availability.json"
    return json.loads(p.read_text()) if p.exists() else {}


def gpu_available(region_code: str, gpu_type: str) -> bool:
    avail = load_gpu_availability()
    entry = avail.get(region_code, {})
    return gpu_type in entry.get("gpus", ["A100", "H100", "V100", "T4"])


def migration_cost(
    from_provider: str,
    to_provider: str,
    data_tb: float = 5.0,
    team_size: int = 3,
) -> dict:
    """Estimate one-time migration + monthly egress delta."""
    if from_provider == to_provider:
        base = SAME_PROVIDER
    else:
        base = MIGRATION_BASE.get((from_provider, to_provider), CROSS_CLOUD_DEFAULT)
    eng_cost = team_size * 40 * 150  # 40h × $150/hr per engineer
    egress_gb = data_tb * 1024
    egress = egress_gb * EGRESS_PER_GB.get(from_provider, 0.09)
    cross = from_provider != to_provider
    return {
        "one_time_usd": round(base + (eng_cost if cross else 0)),
        "egress_usd": round(egress),
        "cross_cloud": cross,
        "lock_in_penalty": LOCK_IN_WEIGHT["cross_cloud"] if cross else 0,
        "note": "Includes engineering time for cross-cloud; same-provider region moves are near-zero.",
    }


def adjusted_score(base_score: float, migration: dict, gpu_ok: bool) -> float:
    penalty = migration["lock_in_penalty"]
    if not gpu_ok:
        penalty += 50
    return max(0, round(base_score - penalty, 1))
