#!/usr/bin/env python3
"""Add OCI, IBM, Alibaba, DigitalOcean regions and regenerate datasets."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
sys.path.insert(0, str(ROOT / "src"))

# provider, region_code, region_name, city, state, country
EXTRA_REGIONS = [
    # Oracle Cloud (OCI)
    ("OCI", "us-ashburn-1", "US East (Ashburn)", "Ashburn", "Virginia", "United States"),
    ("OCI", "us-phoenix-1", "US West (Phoenix)", "Phoenix", "Arizona", "United States"),
    ("OCI", "us-sanjose-1", "US West (San Jose)", "San Jose", "California", "United States"),
    ("OCI", "us-chicago-1", "US Midwest (Chicago)", "Chicago", "Illinois", "United States"),
    ("OCI", "ca-montreal-1", "Canada Southeast (Montreal)", "Montreal", "Quebec", "Canada"),
    ("OCI", "sa-saopaulo-1", "Brazil East (Sao Paulo)", "Sao Paulo", "Sao Paulo", "Brazil"),
    ("OCI", "uk-london-1", "UK South (London)", "London", "England", "United Kingdom"),
    ("OCI", "eu-frankfurt-1", "Germany Central (Frankfurt)", "Frankfurt", "Hesse", "Germany"),
    ("OCI", "eu-amsterdam-1", "Netherlands Northwest (Amsterdam)", "Amsterdam", "North Holland", "Netherlands"),
    ("OCI", "eu-zurich-1", "Switzerland North (Zurich)", "Zurich", "Zurich", "Switzerland"),
    ("OCI", "eu-marseille-1", "France South (Marseille)", "Marseille", "Provence", "France"),
    ("OCI", "me-jeddah-1", "Saudi Arabia West (Jeddah)", "Jeddah", "Makkah", "Saudi Arabia"),
    ("OCI", "me-dubai-1", "UAE East (Dubai)", "Dubai", "Dubai", "United Arab Emirates"),
    ("OCI", "il-jerusalem-1", "Israel Central (Jerusalem)", "Jerusalem", "Jerusalem", "Israel"),
    ("OCI", "ap-tokyo-1", "Japan East (Tokyo)", "Tokyo", "Tokyo", "Japan"),
    ("OCI", "ap-seoul-1", "South Korea Central (Seoul)", "Seoul", "Seoul", "South Korea"),
    ("OCI", "ap-singapore-1", "Singapore", "Singapore", "Singapore", "Singapore"),
    ("OCI", "ap-sydney-1", "Australia Southeast (Sydney)", "Sydney", "New South Wales", "Australia"),
    ("OCI", "ap-mumbai-1", "India West (Mumbai)", "Mumbai", "Maharashtra", "India"),
    ("OCI", "ap-hyderabad-1", "India South (Hyderabad)", "Hyderabad", "Telangana", "India"),
    # IBM Cloud
    ("IBM", "us-east", "Dallas", "Dallas", "Texas", "United States"),
    ("IBM", "us-south", "Houston", "Houston", "Texas", "United States"),
    ("IBM", "us-east-1", "Washington DC", "Washington", "District of Columbia", "United States"),
    ("IBM", "eu-de", "Frankfurt", "Frankfurt", "Hesse", "Germany"),
    ("IBM", "eu-gb", "London", "London", "England", "United Kingdom"),
    ("IBM", "eu-es", "Madrid", "Madrid", "Madrid", "Spain"),
    ("IBM", "jp-tok", "Tokyo", "Tokyo", "Tokyo", "Japan"),
    ("IBM", "jp-osa", "Osaka", "Osaka", "Osaka", "Japan"),
    ("IBM", "au-syd", "Sydney", "Sydney", "New South Wales", "Australia"),
    ("IBM", "ca-tor", "Toronto", "Toronto", "Ontario", "Canada"),
    ("IBM", "br-sao", "Sao Paulo", "Sao Paulo", "Sao Paulo", "Brazil"),
    ("IBM", "in-che", "Chennai", "Chennai", "Tamil Nadu", "India"),
    # Alibaba Cloud
    ("Alibaba", "cn-hangzhou", "China East 1 (Hangzhou)", "Hangzhou", "Zhejiang", "China"),
    ("Alibaba", "cn-shanghai", "China East 2 (Shanghai)", "Shanghai", "Shanghai", "China"),
    ("Alibaba", "cn-beijing", "China North 2 (Beijing)", "Beijing", "Beijing", "China"),
    ("Alibaba", "cn-shenzhen", "China South 1 (Shenzhen)", "Shenzhen", "Guangdong", "China"),
    ("Alibaba", "cn-hongkong", "China Hong Kong", "Hong Kong", "Hong Kong", "Hong Kong"),
    ("Alibaba", "ap-southeast-1", "Singapore", "Singapore", "Singapore", "Singapore"),
    ("Alibaba", "ap-southeast-2", "Australia (Sydney)", "Sydney", "New South Wales", "Australia"),
    ("Alibaba", "ap-southeast-3", "Malaysia (Kuala Lumpur)", "Kuala Lumpur", "Kuala Lumpur", "Malaysia"),
    ("Alibaba", "ap-southeast-5", "Indonesia (Jakarta)", "Jakarta", "Jakarta", "Indonesia"),
    ("Alibaba", "ap-northeast-1", "Japan (Tokyo)", "Tokyo", "Tokyo", "Japan"),
    ("Alibaba", "ap-south-1", "India (Mumbai)", "Mumbai", "Maharashtra", "India"),
    ("Alibaba", "us-west-1", "US West 1 (Silicon Valley)", "San Jose", "California", "United States"),
    ("Alibaba", "us-east-1", "US East 1 (Virginia)", "Ashburn", "Virginia", "United States"),
    ("Alibaba", "eu-central-1", "Germany (Frankfurt)", "Frankfurt", "Hesse", "Germany"),
    ("Alibaba", "me-east-1", "UAE (Dubai)", "Dubai", "Dubai", "United Arab Emirates"),
    # DigitalOcean
    ("DigitalOcean", "nyc1", "New York 1", "New York", "New York", "United States"),
    ("DigitalOcean", "nyc3", "New York 3", "New York", "New York", "United States"),
    ("DigitalOcean", "sfo3", "San Francisco 3", "San Francisco", "California", "United States"),
    ("DigitalOcean", "ams3", "Amsterdam 3", "Amsterdam", "North Holland", "Netherlands"),
    ("DigitalOcean", "lon1", "London 1", "London", "England", "United Kingdom"),
    ("DigitalOcean", "fra1", "Frankfurt 1", "Frankfurt", "Hesse", "Germany"),
    ("DigitalOcean", "sgp1", "Singapore 1", "Singapore", "Singapore", "Singapore"),
    ("DigitalOcean", "tor1", "Toronto 1", "Toronto", "Ontario", "Canada"),
    ("DigitalOcean", "blr1", "Bangalore 1", "Bangalore", "Karnataka", "India"),
    ("DigitalOcean", "syd1", "Sydney 1", "Sydney", "New South Wales", "Australia"),
]


def merge_regions() -> pd.DataFrame:
    base_path = DATA / "cloud_regions_with_water_stress.csv"
    base = pd.read_csv(base_path)
    extra = pd.DataFrame(EXTRA_REGIONS, columns=[
        "provider", "region_code", "region_name", "city", "state", "country",
    ])
    extra["water_stress_score"] = None
    extra["water_stress_label"] = None
    extra["drought_risk"] = None

    # Drop if re-running
    base = base[~base["provider"].isin(["OCI", "IBM", "Alibaba", "DigitalOcean"])]
    merged = pd.concat([base, extra], ignore_index=True)
    merged.to_csv(base_path, index=False)
    print(f"Merged {len(extra)} extra regions → {len(merged)} total")
    return merged


def main() -> None:
    merge_regions()
    subprocess.run([sys.executable, str(ROOT / "scripts" / "enrich_regions.py")], check=True)
    subprocess.run([sys.executable, str(ROOT / "scripts" / "generate_region_data.py")], check=True)
    subprocess.run([sys.executable, str(ROOT / "scripts" / "run_clustering.py")], check=True)
    df = pd.read_csv(DATA / "cloud_regions_enriched.csv")
    print("Providers:", sorted(df["provider"].unique()))
    print("Total regions:", len(df))


if __name__ == "__main__":
    main()
