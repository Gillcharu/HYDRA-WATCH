#!/usr/bin/env python3
"""Fill missing water-stress values and add carbon-zone + confidence metadata."""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

# Map cloud CSV state names → Aqueduct region names in water_stress_clean.csv
STATE_ALIASES: dict[tuple[str, str], list[str]] = {
    ("Germany", "Hesse"): ["Hessen"],
    ("France", "Ile-de-France"): ["Île-de-France", "Ile-de-France"],
    ("Italy", "Lombardy"): ["Lombardia"],
    ("Switzerland", "Zurich"): ["Zürich", "Zurich"],
    ("Finland", "Kymenlaakso"): ["Kymenlaakso"],
    ("Sweden", "Gavleborg"): ["Gävleborg", "Gavleborg"],
    ("Netherlands", "North Holland"): ["Noord-Holland", "North Holland"],
    ("Netherlands", "Groningen"): ["Groningen"],
    ("Canada", "Quebec"): ["Quebec", "Québec"],
    ("Brazil", "Sao Paulo"): ["São Paulo", "Sao Paulo"],
    ("Ireland", "Leinster"): ["Dublin", "Leinster"],
    ("Belgium", "Hainaut"): ["Hainaut", "Wallonie"],
    ("India", "NCT of Delhi"): ["Delhi", "NCT of Delhi"],
    ("India", "Telangana"): ["Telangana"],
    ("India", "Tamil Nadu"): ["Tamil Nadu"],
    ("United States", "Iowa"): ["Iowa"],
    ("United States", "Virginia"): ["Virginia"],
}

# Region-level grid carbon intensity (kg CO2/kWh) — finer than country averages
CARBON_BY_REGION: dict[str, tuple[float, str, int, str]] = {
    # AWS
    "us-east-1": (0.35, "eGRID SERC Virginia", 2023, "high"),
    "us-east-2": (0.42, "eGRID RFC Ohio", 2023, "high"),
    "us-west-1": (0.22, "eGRID WECC California", 2023, "high"),
    "us-west-2": (0.28, "eGRID WECC Oregon", 2023, "high"),
    "ap-south-1": (0.71, "India national grid", 2023, "medium"),
    "ap-south-2": (0.71, "India national grid", 2023, "medium"),
    "ap-southeast-1": (0.41, "Singapore grid", 2023, "high"),
    "ap-southeast-2": (0.51, "Australia NEM", 2023, "medium"),
    "ap-northeast-1": (0.47, "Japan grid", 2023, "medium"),
    "ap-northeast-2": (0.42, "South Korea grid", 2023, "medium"),
    "ap-northeast-3": (0.47, "Japan grid", 2023, "medium"),
    "eu-west-1": (0.28, "Ireland grid", 2023, "high"),
    "eu-west-2": (0.23, "UK grid", 2023, "high"),
    "eu-west-3": (0.06, "France grid", 2023, "high"),
    "eu-central-1": (0.35, "Germany grid", 2023, "high"),
    "eu-central-2": (0.05, "Switzerland grid", 2023, "high"),
    "eu-north-1": (0.04, "Sweden grid", 2023, "high"),
    "eu-south-1": (0.30, "Italy grid", 2023, "medium"),
    "sa-east-1": (0.09, "Brazil grid", 2023, "medium"),
    "ca-central-1": (0.12, "Quebec hydro-heavy grid", 2023, "high"),
    "me-south-1": (0.55, "Bahrain grid", 2023, "medium"),
    "af-south-1": (0.85, "South Africa grid", 2023, "medium"),
    # GCP
    "us-central1": (0.38, "eGRID MRO Iowa", 2023, "high"),
    "us-east1": (0.32, "eGRID SERC South Carolina", 2023, "high"),
    "us-east4": (0.35, "eGRID SERC Virginia", 2023, "high"),
    "us-west1": (0.28, "eGRID WECC Oregon", 2023, "high"),
    "us-west2": (0.22, "eGRID WECC California", 2023, "high"),
    "us-west3": (0.45, "eGRID WECC Utah", 2023, "high"),
    "us-west4": (0.40, "eGRID WECC Nevada", 2023, "high"),
    "asia-south1": (0.71, "India national grid", 2023, "medium"),
    "asia-south2": (0.71, "India national grid", 2023, "medium"),
    "asia-southeast1": (0.41, "Singapore grid", 2023, "high"),
    "asia-east1": (0.45, "Taiwan grid", 2023, "medium"),
    "asia-northeast1": (0.47, "Japan grid", 2023, "medium"),
    "europe-west1": (0.14, "Belgium grid", 2023, "high"),
    "europe-west2": (0.23, "UK grid", 2023, "high"),
    "europe-west3": (0.35, "Germany grid", 2023, "high"),
    "europe-west4": (0.37, "Netherlands grid", 2023, "high"),
    "europe-north1": (0.09, "Finland grid", 2023, "high"),
    "southamerica-east1": (0.09, "Brazil grid", 2023, "medium"),
    "australia-southeast1": (0.51, "Australia NEM", 2023, "medium"),
    # Azure
    "eastus": (0.35, "eGRID SERC Virginia", 2023, "high"),
    "eastus2": (0.35, "eGRID SERC Virginia", 2023, "high"),
    "westus": (0.22, "eGRID WECC California", 2023, "high"),
    "westus2": (0.09, "eGRID WECC Washington hydro", 2023, "high"),
    "westus3": (0.40, "eGRID WECC Arizona", 2023, "high"),
    "centralus": (0.38, "eGRID MRO Iowa", 2023, "high"),
    "southcentralus": (0.42, "eGRID ERCOT Texas", 2023, "high"),
    "northcentralus": (0.45, "eGRID RFC Illinois", 2023, "high"),
    "centralindia": (0.71, "India national grid", 2023, "medium"),
    "southindia": (0.71, "India national grid", 2023, "medium"),
    "westindia": (0.71, "India national grid", 2023, "medium"),
    "eastasia": (0.48, "Hong Kong grid", 2023, "medium"),
    "southeastasia": (0.41, "Singapore grid", 2023, "high"),
    "japaneast": (0.47, "Japan grid", 2023, "medium"),
    "japanwest": (0.47, "Japan grid", 2023, "medium"),
    "northeurope": (0.28, "Ireland grid", 2023, "high"),
    "westeurope": (0.37, "Netherlands grid", 2023, "high"),
    "germanywestcentral": (0.35, "Germany grid", 2023, "high"),
    "norwayeast": (0.02, "Norway grid", 2023, "high"),
    "swedencentral": (0.04, "Sweden grid", 2023, "high"),
    "brazilsouth": (0.09, "Brazil grid", 2023, "medium"),
    "australiaeast": (0.51, "Australia NEM", 2023, "medium"),
    "southafricanorth": (0.85, "South Africa grid", 2023, "medium"),
    # OCI
    "us-ashburn-1": (0.35, "eGRID SERC Virginia", 2023, "high"),
    "us-phoenix-1": (0.40, "eGRID WECC Arizona", 2023, "high"),
    "us-sanjose-1": (0.22, "eGRID WECC California", 2023, "high"),
    "us-chicago-1": (0.45, "eGRID RFC Illinois", 2023, "high"),
    "ca-montreal-1": (0.12, "Quebec hydro grid", 2023, "high"),
    "sa-saopaulo-1": (0.09, "Brazil grid", 2023, "medium"),
    "uk-london-1": (0.23, "UK grid", 2023, "high"),
    "eu-frankfurt-1": (0.35, "Germany grid", 2023, "high"),
    "eu-amsterdam-1": (0.37, "Netherlands grid", 2023, "high"),
    "eu-zurich-1": (0.05, "Switzerland grid", 2023, "high"),
    "eu-marseille-1": (0.06, "France grid", 2023, "high"),
    "ap-tokyo-1": (0.47, "Japan grid", 2023, "medium"),
    "ap-seoul-1": (0.42, "South Korea grid", 2023, "medium"),
    "ap-singapore-1": (0.41, "Singapore grid", 2023, "high"),
    "ap-sydney-1": (0.51, "Australia NEM", 2023, "medium"),
    "ap-mumbai-1": (0.71, "India national grid", 2023, "medium"),
    "ap-hyderabad-1": (0.71, "India national grid", 2023, "medium"),
    # IBM
    "us-east": (0.42, "eGRID ERCOT Texas", 2023, "high"),
    "us-south": (0.42, "eGRID ERCOT Texas", 2023, "high"),
    "eu-de": (0.35, "Germany grid", 2023, "high"),
    "eu-gb": (0.23, "UK grid", 2023, "high"),
    "eu-es": (0.25, "Spain grid", 2023, "medium"),
    "jp-tok": (0.47, "Japan grid", 2023, "medium"),
    "jp-osa": (0.47, "Japan grid", 2023, "medium"),
    "au-syd": (0.51, "Australia NEM", 2023, "medium"),
    "ca-tor": (0.12, "Ontario grid", 2023, "medium"),
    "br-sao": (0.09, "Brazil grid", 2023, "medium"),
    "in-che": (0.71, "India national grid", 2023, "medium"),
    # Alibaba (shared codes use country fallback when not listed)
    "cn-hangzhou": (0.55, "China East grid", 2023, "medium"),
    "cn-shanghai": (0.55, "China East grid", 2023, "medium"),
    "cn-beijing": (0.58, "China North grid", 2023, "medium"),
    "cn-shenzhen": (0.52, "China South grid", 2023, "medium"),
    "cn-hongkong": (0.48, "Hong Kong grid", 2023, "medium"),
    "ap-south-1": (0.71, "India national grid", 2023, "medium"),
    "me-east-1": (0.55, "UAE grid", 2023, "medium"),
    # DigitalOcean
    "nyc1": (0.35, "eGRID SERC New York", 2023, "high"),
    "nyc3": (0.35, "eGRID SERC New York", 2023, "high"),
    "sfo3": (0.22, "eGRID WECC California", 2023, "high"),
    "ams3": (0.37, "Netherlands grid", 2023, "high"),
    "lon1": (0.23, "UK grid", 2023, "high"),
    "fra1": (0.35, "Germany grid", 2023, "high"),
    "sgp1": (0.41, "Singapore grid", 2023, "high"),
    "tor1": (0.12, "Ontario grid", 2023, "medium"),
    "blr1": (0.71, "India national grid", 2023, "medium"),
    "syd1": (0.51, "Australia NEM", 2023, "medium"),
}

COUNTRY_CARBON_FALLBACK: dict[str, float] = {
    "India": 0.71, "United States": 0.39, "Germany": 0.35,
    "United Kingdom": 0.23, "France": 0.06, "Sweden": 0.04,
    "Norway": 0.02, "Finland": 0.09, "Ireland": 0.28,
    "Netherlands": 0.37, "Australia": 0.51, "Japan": 0.47,
    "Singapore": 0.41, "Brazil": 0.09, "South Korea": 0.42,
    "South Africa": 0.85, "Switzerland": 0.05, "Italy": 0.30,
    "Canada": 0.12, "Bahrain": 0.55, "Belgium": 0.14,
    "Hong Kong": 0.48, "Taiwan": 0.45, "China": 0.55,
    "United Arab Emirates": 0.55, "Saudi Arabia": 0.52, "Israel": 0.45,
    "Malaysia": 0.62, "Indonesia": 0.68, "Spain": 0.25,
    "DEFAULT": 0.40,
}


def _label_from_score(score: float) -> str:
    if score >= 4.0:
        return "Extremely High (>80%)"
    if score >= 3.0:
        return "High (40-80%)"
    if score >= 2.0:
        return "Medium - High (20-40%)"
    if score >= 1.0:
        return "Low - Medium (10-20%)"
    return "Low (<10%)"


def lookup_water_stress(
    water_df: pd.DataFrame, country: str, state: str
) -> tuple[float | None, str | None, float | None, str]:
    """Return (score, label, drought, confidence)."""
    country_rows = water_df[water_df["country"] == country]
    if country_rows.empty:
        return None, None, None, "low"

    candidates = STATE_ALIASES.get((country, state), [state])
    for name in candidates:
        match = country_rows[country_rows["region"].str.lower() == name.lower()]
        if not match.empty:
            row = match.iloc[0]
            score = float(row["water_stress_score"])
            drought = (
                float(row["drought_risk"])
                if pd.notna(row.get("drought_risk"))
                else None
            )
            label = row["water_stress_label"] if pd.notna(row["water_stress_label"]) else _label_from_score(score)
            return score, label, drought, "high"

    # Country average fallback
    scores = country_rows["water_stress_score"].dropna()
    if scores.empty:
        return None, None, None, "low"
    score = float(scores.mean())
    droughts = country_rows["drought_risk"].dropna()
    drought = float(droughts.mean()) if not droughts.empty else None
    return score, _label_from_score(score), drought, "medium"


def enrich() -> pd.DataFrame:
    regions_path = DATA / "cloud_regions_with_water_stress.csv"
    water_path = DATA / "water_stress_clean.csv"
    if not regions_path.exists():
        raise FileNotFoundError(f"Missing {regions_path}")

    regions = pd.read_csv(regions_path)
    water_df = pd.read_csv(water_path) if water_path.exists() else pd.DataFrame()

    rows = []
    for _, r in regions.iterrows():
        row = r.to_dict()
        rc = row["region_code"]
        country = row["country"]
        state = row.get("state", "")

        if pd.isna(row.get("water_stress_score")) or row.get("water_stress_score") == "":
            if not water_df.empty:
                score, label, drought, conf = lookup_water_stress(water_df, country, state)
                if score is not None:
                    row["water_stress_score"] = score
                    row["water_stress_label"] = label
                    row["data_confidence"] = conf
                    if drought is not None and (pd.isna(row.get("drought_risk")) or row.get("drought_risk") == ""):
                        row["drought_risk"] = drought
                else:
                    row["data_confidence"] = "low"
            else:
                row["data_confidence"] = "low"
        else:
            row["data_confidence"] = "high"

        if pd.isna(row.get("drought_risk")) or row.get("drought_risk") == "":
            row["drought_risk"] = 2.0  # neutral default when unknown
            if row.get("data_confidence") == "high":
                row["data_confidence"] = "medium"

        carbon = CARBON_BY_REGION.get(rc)
        if carbon:
            row["carbon_kg_per_kwh"] = carbon[0]
            row["carbon_source"] = carbon[1]
            row["carbon_year"] = carbon[2]
            row["carbon_confidence"] = carbon[3]
        else:
            fallback = COUNTRY_CARBON_FALLBACK.get(country, COUNTRY_CARBON_FALLBACK["DEFAULT"])
            row["carbon_kg_per_kwh"] = fallback
            row["carbon_source"] = f"{country} national average"
            row["carbon_year"] = 2023
            row["carbon_confidence"] = "medium"

        rows.append(row)

    out = pd.DataFrame(rows)
    out_path = DATA / "cloud_regions_enriched.csv"
    out.to_csv(out_path, index=False)
    filled = out["water_stress_score"].notna().sum()
    print(f"Wrote {len(out)} regions to {out_path}")
    print(f"Water stress coverage: {filled}/{len(out)} ({100*filled/len(out):.0f}%)")
    missing = out[out["water_stress_score"].isna()]["region_code"].tolist()
    if missing:
        print(f"Still missing: {missing}")
    return out


if __name__ == "__main__":
    enrich()
