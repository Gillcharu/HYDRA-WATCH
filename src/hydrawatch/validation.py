"""Validation case studies vs published references — expanded coverage."""

from __future__ import annotations

# Constant-level checks: WUE and/or grid carbon vs published
CASE_STUDIES = [
    {"id": "aws_mumbai_wue", "title": "AWS Asia Pacific WUE", "region": "ap-south-1",
     "reference": "AWS Sustainability Report 2023", "published_wue_range": (1.8, 2.5),
     "published_note": "India evaporative cooling context."},
    {"id": "sweden_grid", "title": "Sweden grid carbon", "region": "eu-north-1",
     "reference": "IEA Sweden 2023", "published_carbon_kg_kwh": 0.04,
     "published_note": "Nordic low-carbon grid."},
    {"id": "india_grid", "title": "India grid carbon", "region": "ap-south-1",
     "reference": "IEA India / CEIA 2023", "published_carbon_kg_kwh": 0.71,
     "published_note": "Coal-heavy national grid."},
    {"id": "google_finland", "title": "GCP Finland WUE", "region": "europe-north1",
     "reference": "Google Environmental Report 2023", "published_wue_range": (0.6, 0.9),
     "published_note": "Seawater cooling, cold climate."},
    {"id": "virginia_grid", "title": "US Virginia grid carbon", "region": "us-east-1",
     "reference": "eGRID SERC Virginia 2023", "published_carbon_kg_kwh": 0.35,
     "published_note": "PJM/Virginia zone."},
    {"id": "oregon_grid", "title": "US Oregon grid carbon", "region": "us-west-2",
     "reference": "eGRID WECC Oregon 2023", "published_carbon_kg_kwh": 0.28,
     "published_note": "Hydro-influenced West."},
    {"id": "france_grid", "title": "France grid carbon", "region": "eu-west-3",
     "reference": "IEA France 2023", "published_carbon_kg_kwh": 0.06,
     "published_note": "Nuclear-heavy grid."},
    {"id": "germany_grid", "title": "Germany grid carbon", "region": "eu-central-1",
     "reference": "IEA Germany 2023", "published_carbon_kg_kwh": 0.35,
     "published_note": "Mixed renewable + fossil."},
    {"id": "uk_grid", "title": "UK grid carbon", "region": "eu-west-2",
     "reference": "UK DESNZ 2023", "published_carbon_kg_kwh": 0.23,
     "published_note": "Declining coal/gas share."},
    {"id": "singapore_grid", "title": "Singapore grid carbon", "region": "ap-southeast-1",
     "reference": "EMA Singapore 2023", "published_carbon_kg_kwh": 0.41,
     "published_note": "Gas-dominated grid."},
    {"id": "australia_grid", "title": "Australia NEM carbon", "region": "ap-southeast-2",
     "reference": "Australia NEM 2023", "published_carbon_kg_kwh": 0.51,
     "published_note": "Coal + renewables mix."},
    {"id": "japan_grid", "title": "Japan grid carbon", "region": "ap-northeast-1",
     "reference": "IEA Japan 2023", "published_carbon_kg_kwh": 0.47,
     "published_note": "Fossil + nuclear restart."},
    {"id": "brazil_grid", "title": "Brazil grid carbon", "region": "sa-east-1",
     "reference": "IEA Brazil 2023", "published_carbon_kg_kwh": 0.09,
     "published_note": "Hydro-heavy."},
    {"id": "canada_quebec", "title": "Quebec grid carbon", "region": "ca-central-1",
     "reference": "Canada NEB 2023", "published_carbon_kg_kwh": 0.12,
     "published_note": "Hydro-dominated."},
    {"id": "azure_washington", "title": "Washington hydro grid", "region": "westus2",
     "reference": "eGRID WECC Washington 2023", "published_carbon_kg_kwh": 0.09,
     "published_note": "Low-carbon US West."},
    {"id": "gcp_iowa", "title": "Iowa grid carbon", "region": "us-central1",
     "reference": "eGRID MRO Iowa 2023", "published_carbon_kg_kwh": 0.38,
     "published_note": "US Midwest mix."},
    {"id": "oci_mumbai", "title": "India grid (OCI Mumbai)", "region": "ap-mumbai-1",
     "reference": "IEA India 2023", "published_carbon_kg_kwh": 0.71,
     "published_note": "Same national grid as AWS Mumbai."},
    {"id": "oci_zurich", "title": "Switzerland grid (OCI)", "region": "eu-zurich-1",
     "reference": "IEA Switzerland 2023", "published_carbon_kg_kwh": 0.05,
     "published_note": "Low-carbon Alpine grid."},
    {"id": "alibaba_hangzhou", "title": "China East grid", "region": "cn-hangzhou",
     "reference": "IEA China 2023", "published_carbon_kg_kwh": 0.55,
     "published_note": "National average proxy."},
    {"id": "ibm_frankfurt", "title": "Germany grid (IBM)", "region": "eu-de",
     "reference": "IEA Germany 2023", "published_carbon_kg_kwh": 0.35,
     "published_note": "Frankfurt zone."},
]

FOOTPRINT_BENCHMARKS = [
    {"region": "ap-south-1", "title": "AWS Mumbai A100 inference (order-of-magnitude)",
     "reference": "AWS Sustainability + ML specs 2023",
     "published_carbon_kg_month_range": (800, 2500), "published_water_L_month_range": (50000, 200000),
     "workload": "Single A100 moderate inference"},
    {"region": "eu-north-1", "title": "AWS Stockholm low-carbon baseline",
     "reference": "IEA Sweden + AWS Nordics 2023",
     "published_carbon_kg_month_range": (50, 400), "published_water_L_month_range": (5000, 40000),
     "workload": "Single A100 moderate inference"},
    {"region": "us-east-1", "title": "US East inference baseline",
     "reference": "eGRID + instance power models",
     "published_carbon_kg_month_range": (400, 1800), "published_water_L_month_range": (30000, 120000),
     "workload": "Single A100 moderate inference"},
    {"region": "europe-north1", "title": "GCP Finland low-carbon",
     "reference": "Google Environmental Report 2023",
     "published_carbon_kg_month_range": (40, 350), "published_water_L_month_range": (3000, 25000),
     "workload": "Single A100 moderate inference"},
]


def validate_region(region_code: str, wue: float, carbon: float) -> list[dict]:
    checks = []
    for cs in CASE_STUDIES:
        if cs["region"] != region_code:
            continue
        entry = {
            "title": cs["title"], "reference": cs["reference"],
            "note": cs["published_note"], "tier": "V1",
        }
        if "published_wue_range" in cs:
            lo, hi = cs["published_wue_range"]
            entry["metric"] = "WUE (L/kWh)"
            entry["published"] = f"{lo}–{hi}"
            entry["modeled"] = wue
            entry["pass"] = lo <= wue <= hi
        if "published_carbon_kg_kwh" in cs:
            pub = cs["published_carbon_kg_kwh"]
            entry["metric"] = "Carbon (kg/kWh)"
            entry["published"] = pub
            entry["modeled"] = carbon
            entry["pass"] = abs(carbon - pub) < 0.08
        checks.append(entry)
    return checks


def validate_footprint(region_code: str, water_mid: float, carbon_mid: float, gpus: float) -> list[dict]:
    checks = []
    for bm in FOOTPRINT_BENCHMARKS:
        if bm["region"] != region_code:
            continue
        scale = max(gpus, 1.0)
        w_lo, w_hi = [x * scale for x in bm["published_water_L_month_range"]]
        c_lo, c_hi = [x * scale for x in bm["published_carbon_kg_month_range"]]
        checks.append({
            "title": bm["title"], "reference": bm["reference"],
            "metric": "Full footprint", "tier": "V1",
            "published_water": f"{w_lo:,.0f}–{w_hi:,.0f} L/mo",
            "published_carbon": f"{c_lo:,.0f}–{c_hi:,.0f} kg/mo",
            "modeled_water": round(water_mid), "modeled_carbon": round(carbon_mid),
            "pass": w_lo <= water_mid <= w_hi * 1.5 and c_lo <= carbon_mid <= c_hi * 1.5,
            "note": bm["workload"],
        })
    return checks


def validate_ranking_order(carbon_a: float, carbon_b: float, expect_a_higher: bool = True) -> dict:
    """Property test: carbon ordering matches expectation."""
    ok = (carbon_a > carbon_b) if expect_a_higher else (carbon_a < carbon_b)
    return {
        "title": "Directional carbon ranking",
        "metric": "kg CO2/kWh",
        "published": "higher" if expect_a_higher else "lower",
        "modeled": f"{carbon_a} vs {carbon_b}",
        "pass": ok,
        "tier": "V1",
        "reference": "IEA/eGRID published grid ordering",
    }


def run_global_validation_checks(regions_df) -> list[dict]:
    """CI suite: property tests on known grid orderings."""
    def carbon(rc, prov):
        row = regions_df[(regions_df["region_code"] == rc) & (regions_df["provider"] == prov)]
        return float(row.iloc[0]["carbon_kg_per_kwh"]) if not row.empty else None

    tests = []
    pairs = [
        ("ap-south-1", "AWS", "eu-north-1", "AWS", True),
        ("us-east-1", "AWS", "eu-west-3", "AWS", True),
        ("ap-south-1", "AWS", "ca-central-1", "AWS", True),
    ]
    for rc_a, p_a, rc_b, p_b, higher in pairs:
        ca, cb = carbon(rc_a, p_a), carbon(rc_b, p_b)
        if ca is not None and cb is not None:
            tests.append(validate_ranking_order(ca, cb, higher))
    return tests
