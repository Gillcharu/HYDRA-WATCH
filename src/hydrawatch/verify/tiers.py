"""Verification tier definitions — V0 (heuristic) through V4 (metered/audited)."""

from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone

TIER_LABELS: dict[str, str] = {
    "V0": "Heuristic / imputed — not suitable for disclosure",
    "V1": "Public static dataset (documented source)",
    "V2": "Provider disclosure or measured telemetry",
    "V3": "Live API with timestamp",
    "V4": "Metered / provider carbon tool export",
}

# Uncertainty half-width as fraction of midpoint
TIER_UNCERTAINTY: dict[str, float] = {
    "V0": 0.40,
    "V1": 0.25,
    "V2": 0.18,
    "V3": 0.12,
    "V4": 0.08,
}

TIER_ORDER = ["V0", "V1", "V2", "V3", "V4"]


@dataclass
class VerifiedField:
    name: str
    value: float | str | None
    tier: str
    source: str
    source_url: str = ""
    as_of: str = ""
    unit: str = ""
    note: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    @property
    def uncertainty_pct(self) -> float:
        return tier_uncertainty(self.tier)


def tier_uncertainty(tier: str) -> float:
    return TIER_UNCERTAINTY.get(tier, 0.40)


def min_tier(*tiers: str) -> str:
    """Weakest tier dominates footprint confidence."""
    valid = [t for t in tiers if t in TIER_ORDER]
    if not valid:
        return "V0"
    return min(valid, key=lambda t: TIER_ORDER.index(t))


def aggregate_footprint_tier(*tiers: str) -> str:
    return min_tier(*tiers)


def format_tier_badge(tier: str) -> str:
    return f"{tier} — {TIER_LABELS.get(tier, tier)}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def display_value(field: VerifiedField, numeric: float | None = None) -> str:
    """Format for UI — ranges emphasized when tier < V2."""
    val = numeric if numeric is not None else field.value
    if val is None:
        return "N/A"
    if isinstance(val, float):
        if field.tier in ("V0", "V1"):
            u = field.uncertainty_pct
            lo, hi = val * (1 - u), val * (1 + u)
            return f"~{val:,.0f} (est. {lo:,.0f}–{hi:,.0f})"
        return f"{val:,.0f}"
    return str(val)
