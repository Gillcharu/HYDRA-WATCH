"""Live and cached grid carbon intensity — global zone coverage."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

import httpx
from hydrawatch.db import get_cached_carbon, set_cached_carbon

DATA = Path(__file__).resolve().parents[2] / "data"

_FALLBACK_ZONES = {
    "eu-north-1": "SE", "europe-north1": "FI", "swedencentral": "SE",
    "norwayeast": "NO", "eu-west-3": "FR", "ap-south-1": "IN",
    "us-east-1": "US-MIDA-PJM", "us-west-2": "US-NW-PACW",
}


def _load_zones() -> dict[str, str]:
    p = DATA / "electricity_zones.json"
    if p.exists():
        return {**_FALLBACK_ZONES, **json.loads(p.read_text())}
    return _FALLBACK_ZONES


def _load_patterns() -> dict:
    p = DATA / "carbon_hourly_patterns.json"
    return json.loads(p.read_text()) if p.exists() else {}


def _cache_get(zone: str) -> dict | None:
    return get_cached_carbon(zone)


def _cache_set(zone: str, carbon: float, source: str) -> None:
    set_cached_carbon(zone, carbon, source)


async def fetch_live_carbon(zone: str) -> tuple[float | None, str]:
    api_key = os.environ.get("ELECTRICITY_MAPS_API_KEY")
    if not api_key:
        return None, "static_pattern"
    cached = _cache_get(zone)
    if cached:
        return cached["carbon_kg_kwh"], f"live_cached ({cached['source']})"
    try:
        url = f"https://api.electricitymap.org/v3/carbon-intensity/latest?zone={zone}"
        async with httpx.AsyncClient() as client:
            r = await client.get(url, headers={"auth-token": api_key}, timeout=8.0)
            r.raise_for_status()
            body = r.json()
        carbon = body.get("carbonIntensity", body.get("carbon_intensity"))
        if carbon is None:
            return None, "static_pattern"
        carbon_kg = float(carbon) / 1000.0
        _cache_set(zone, carbon_kg, "Electricity Maps API")
        return carbon_kg, "Electricity Maps (live)"
    except Exception:
        return None, "static_pattern"


async def carbon_for_region(region_code: str, static_avg: float) -> tuple[float, str, str, str]:
    """Return (carbon_kg_kwh, source_label, data_mode, as_of)."""
    zones = _load_zones()
    zone = zones.get(region_code)
    if zone:
        live, src = await fetch_live_carbon(zone)
        if live is not None:
            cached = _cache_get(zone)
            ts = cached["fetched_at"] if cached else datetime.now(timezone.utc).isoformat()
            return live, src, "live", ts
    return static_avg, "grid average (2023)", "static", "2023-01-01"


async def hourly_carbon_profile(region_code: str) -> tuple[list[dict] | None, str]:
    patterns = _load_patterns()
    p = patterns.get(region_code)
    if not p or not isinstance(p, dict) or "hourly_factor" not in p:
        return None, "unavailable"
    static_avg = p["annual_avg"]
    carbon, source, mode, _ts = await carbon_for_region(region_code, static_avg)
    profile = [
        {"hour": h, "carbon_kg_kwh": round(carbon * f / (sum(p["hourly_factor"]) / 24), 4),
         "relative": round(f, 3)}
        for h, f in enumerate(p["hourly_factor"])
    ]
    return profile, f"{source} ({mode})"
