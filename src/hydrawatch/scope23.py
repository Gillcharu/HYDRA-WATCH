"""GHG Protocol Scope 2/3 alignment metadata."""

from __future__ import annotations

SCOPE2_METHOD = "location-based grid emission factor"
SCOPE3_CATEGORIES = {
    "Cat 1": "Purchased goods and services (cloud compute)",
    "Cat 2": "Capital goods (GPU hardware amortization — not modeled)",
    "Cat 3": "Fuel- and energy-related activities (PUE overhead)",
    "Cat 11": "Use of sold products (inference serving — partial)",
}


def scope23_report(footprint: dict, region: dict) -> dict:
    """Structured Scope 2/3 narrative for ESG export."""
    fp = footprint
    return {
        "ghg_protocol_alignment": "Partial — location-based Scope 2; Scope 3 Cat 1/3 estimated",
        "scope2": {
            "method": SCOPE2_METHOD,
            "emissions_kg_co2e_month": fp.get("carbon_kg_month", {}).get("mid"),
            "grid_factor_kg_kwh": region.get("carbon_factor"),
            "grid_source": region.get("carbon_source", ""),
            "market_based_note": "Market-based (renewable PPAs) not available without provider contract data",
        },
        "scope3": {
            "categories_addressed": list(SCOPE3_CATEGORIES.keys()),
            "category_detail": SCOPE3_CATEGORIES,
            "water_withdrawal_L_month": fp.get("water_L_month", {}).get("mid"),
            "water_note": "Operational water withdrawal proxy via WUE × facility energy",
        },
        "limitations": [
            "Not a verified GHG inventory — requires metered facility data for assurance",
            "GPU embodied carbon (Scope 3 Cat 2) excluded",
            "Renewable energy certificates not applied without provider-specific data",
        ],
        "recommended_next_steps": [
            "Obtain provider carbon footprint tool export (AWS CCFT, GCP Carbon Footprint)",
            "Cross-validate grid factor with Electricity Maps live API",
            "Engage third-party assurance for published ESG disclosures",
        ],
    }
