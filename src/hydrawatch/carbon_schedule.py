"""Time-of-day carbon scheduling — live API + per-region patterns."""

from __future__ import annotations

from hydrawatch.carbon_live import hourly_carbon_profile


async def hourly_carbon(region_code: str) -> tuple[list[dict] | None, str]:
    return await hourly_carbon_profile(region_code)


async def best_hours(region_code: str, n: int = 4) -> tuple[list[int], str]:
    profile, source = await hourly_carbon(region_code)
    if not profile:
        return [], source
    sorted_h = sorted(profile, key=lambda x: x["carbon_kg_kwh"])
    return [h["hour"] for h in sorted_h[:n]], source
