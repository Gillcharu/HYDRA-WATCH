"""Plain-language traffic → QPS estimation."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class TrafficEstimate:
    daily_users: int
    requests_per_user_per_day: float
    avg_tokens: int
    peak_factor: float
    qps: float
    explanation: str


def estimate_qps(
    daily_users: int,
    requests_per_user_per_day: float = 12.0,
    avg_tokens: int = 1000,
    peak_hours: int = 8,
    peak_share: float = 0.65,
) -> TrafficEstimate:
    """
  Convert human-scale inputs to QPS.

  Example: 10,000 users × 12 req/day → 120k req/day.
  Peak: 65% of traffic in 8 hours → ~2.7 req/s average peak window.
    """
    total_daily = daily_users * requests_per_user_per_day
    seconds_peak = peak_hours * 3600
    peak_requests = total_daily * peak_share
    qps = max(1.0, peak_requests / seconds_peak)

    explanation = (
        f"{daily_users:,} users × {requests_per_user_per_day:.0f} req/day "
        f"= {total_daily:,.0f} requests/day. "
        f"Assuming {peak_share:.0%} in {peak_hours}h peak → **{qps:.1f} QPS**."
    )
    return TrafficEstimate(
        daily_users=daily_users,
        requests_per_user_per_day=requests_per_user_per_day,
        avg_tokens=avg_tokens,
        peak_factor=peak_share,
        qps=round(qps, 1),
        explanation=explanation,
    )
