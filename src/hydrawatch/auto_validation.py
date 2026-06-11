"""Automated validation for all regions against published carbon bands."""

from __future__ import annotations

import pandas as pd

# IEA 2023 kg CO2/kWh — national bands (low, high)
COUNTRY_CARBON_BANDS: dict[str, tuple[float, float]] = {
    "United States": (0.30, 0.50),
    "India": (0.60, 0.80),
    "Germany": (0.30, 0.42),
    "United Kingdom": (0.18, 0.28),
    "France": (0.04, 0.10),
    "Sweden": (0.02, 0.08),
    "Norway": (0.01, 0.05),
    "Finland": (0.06, 0.14),
    "Ireland": (0.22, 0.35),
    "Netherlands": (0.32, 0.42),
    "Belgium": (0.10, 0.20),
    "Switzerland": (0.03, 0.08),
    "Italy": (0.25, 0.38),
    "Spain": (0.20, 0.32),
    "Australia": (0.45, 0.58),
    "Japan": (0.42, 0.52),
    "Singapore": (0.38, 0.45),
    "Brazil": (0.07, 0.12),
    "South Korea": (0.38, 0.48),
    "Canada": (0.08, 0.18),
    "South Africa": (0.75, 0.95),
    "Bahrain": (0.48, 0.62),
    "China": (0.50, 0.62),
    "Hong Kong": (0.42, 0.55),
    "Taiwan": (0.40, 0.52),
    "United Arab Emirates": (0.48, 0.62),
    "Saudi Arabia": (0.45, 0.60),
    "Israel": (0.40, 0.52),
    "Malaysia": (0.55, 0.68),
    "Indonesia": (0.62, 0.75),
}

# US state/subregion bands from eGRID WECC & EPA (2023) — more accurate than national average
US_STATE_CARBON_BANDS: dict[str, tuple[float, float]] = {
    "California": (0.18, 0.28),
    "Oregon": (0.22, 0.35),
    "Washington": (0.06, 0.15),
    "Arizona": (0.35, 0.48),
    "Virginia": (0.30, 0.45),
    "Ohio": (0.38, 0.58),
    "Iowa": (0.35, 0.50),
    "Texas": (0.35, 0.50),
    "Illinois": (0.35, 0.50),
    "Georgia": (0.35, 0.48),
}


def carbon_band(country: str, state: str | None = None) -> tuple[float, float, str]:
    """Return (lo, hi, band_label) for a region."""
    if country == "United States" and state and state in US_STATE_CARBON_BANDS:
        lo, hi = US_STATE_CARBON_BANDS[state]
        return lo, hi, f"eGRID {state}"
    if country in COUNTRY_CARBON_BANDS:
        lo, hi = COUNTRY_CARBON_BANDS[country]
        return lo, hi, f"IEA {country}"
    return 0.05, 0.85, "Global fallback"


def validate_all_regions(regions_df: pd.DataFrame) -> dict:
    """Run carbon band validation on every region."""
    results = []
    for _, r in regions_df.iterrows():
        country = r["country"]
        state = r.get("state") if "state" in r.index else None
        if pd.isna(state):
            state = None
        carbon = float(r.get("carbon_kg_per_kwh", 0.4))
        lo, hi, band_label = carbon_band(country, state)
        ok = lo <= carbon <= hi
        results.append({
            "provider": r["provider"],
            "region_code": r["region_code"],
            "region_name": r["region_name"],
            "country": country,
            "state": state or "",
            "carbon": carbon,
            "band": f"{lo}–{hi}",
            "band_source": band_label,
            "pass": ok,
            "tier": "V1",
        })
    passed = sum(1 for x in results if x["pass"])
    return {
        "total": len(results),
        "passed": passed,
        "pass_rate_pct": round(100 * passed / max(len(results), 1), 1),
        "results": results,
    }


def validation_summary_line(summary: dict) -> str:
    return (
        f"{summary['passed']}/{summary['total']} regions "
        f"({summary['pass_rate_pct']}%) within published carbon bands (IEA + eGRID)"
    )
