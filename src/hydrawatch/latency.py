"""Latency estimation — measured table + global haversine model."""

from __future__ import annotations

import math

from hydrawatch.constants import LATENCY_MS
from hydrawatch.geo import REGION_COORDS
from hydrawatch.global_locations import coords, resolve_location

# Re-export for backward compatibility
USER_LOCATIONS: dict[str, tuple[float, float]] = {}


def _user_coords(user_location: str) -> tuple[float, float] | None:
    resolved = resolve_location(user_location)
    c = coords(resolved)
    if c:
        return c
    # Legacy constants fallback
    legacy = {
        "India": (20.59, 78.96), "United States": (39.83, -98.58),
        "Europe": (50.11, 8.68), "Singapore": (1.35, 103.82),
        "Australia": (-25.27, 133.78), "Japan": (36.20, 138.25),
        "Brazil": (-14.24, -51.93),
    }
    return legacy.get(user_location)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def estimate_latency_ms(user_location: str, region_code: str) -> tuple[int, str]:
    """Return (latency_ms, source)."""
    resolved = resolve_location(user_location)
    key = (resolved, region_code)
    if key not in LATENCY_MS:
        key = (user_location, region_code)
    if key in LATENCY_MS:
        return LATENCY_MS[key], "measured_rtt_table"

    user = _user_coords(user_location)
    region = REGION_COORDS.get(region_code)
    if user and region:
        km = haversine_km(user[0], user[1], region[0], region[1])
        # Improved global model: base RTT + distance + intercontinental penalty
        base = 12
        distance_ms = km * 0.008
        penalty = 25 if km > 8000 else (10 if km > 4000 else 0)
        ms = int(base + distance_ms + penalty)
        return min(ms, 450), "global_haversine_v2"

    return 999, "unknown"


def get_latency(user_location: str, region_code: str) -> int:
    return estimate_latency_ms(user_location, region_code)[0]
