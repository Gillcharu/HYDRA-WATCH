"""V4 ground truth — provider carbon tool exports (CCFT, GCP Carbon Footprint)."""

from __future__ import annotations

import csv
import io
import json
from dataclasses import dataclass


@dataclass
class GroundTruthReading:
    provider: str
    region_code: str
    carbon_kg_month: float
    source: str
    tier: str = "V4"


def parse_aws_ccft_csv(text: str) -> list[GroundTruthReading]:
    """Parse AWS Customer Carbon Footprint Tool CSV export."""
    reader = csv.DictReader(io.StringIO(text))
    out = []
    for row in reader:
        region = (
            row.get("Region") or row.get("region") or row.get("AWS Region") or ""
        ).strip()
        emissions = (
            row.get("Total Emissions (MT CO2e)")
            or row.get("Emissions (kg CO2e)")
            or row.get("carbon_kg")
            or row.get("Total CO2e (kg)")
            or "0"
        )
        try:
            val = float(str(emissions).replace(",", ""))
            if "MT" in str(row.get("Total Emissions (MT CO2e)", "")) or val < 1000:
                val *= 1000  # MT → kg if small
        except ValueError:
            continue
        if region and val > 0:
            out.append(GroundTruthReading("AWS", region, val, "aws_ccft"))
    return out


def parse_gcp_carbon_json(text: str) -> list[GroundTruthReading]:
    """Parse GCP Carbon Footprint JSON/CSV export."""
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return _parse_gcp_carbon_csv(text)
    rows = data if isinstance(data, list) else data.get("rows", data.get("data", []))
    out = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        region = row.get("region", row.get("location", ""))
        carbon = row.get("carbon_footprint_kg", row.get("emissions_kg", row.get("co2e_kg", 0)))
        try:
            val = float(carbon)
        except (TypeError, ValueError):
            continue
        if region and val > 0:
            out.append(GroundTruthReading("GCP", region, val, "gcp_carbon_footprint"))
    return out


def _parse_gcp_carbon_csv(text: str) -> list[GroundTruthReading]:
    reader = csv.DictReader(io.StringIO(text))
    out = []
    for row in reader:
        region = (row.get("region") or row.get("Region") or row.get("location") or "").strip()
        for key in ("carbon_footprint_kg", "emissions_kg", "CO2e (kg)", "co2e_kg"):
            if key in row:
                try:
                    val = float(str(row[key]).replace(",", ""))
                    if region and val > 0:
                        out.append(GroundTruthReading("GCP", region, val, "gcp_carbon_footprint"))
                except ValueError:
                    pass
                break
    return out


def parse_azure_emissions_csv(text: str) -> list[GroundTruthReading]:
    reader = csv.DictReader(io.StringIO(text))
    out = []
    for row in reader:
        region = (row.get("Region") or row.get("Azure Region") or row.get("region") or "").strip()
        for key in ("Emissions (kg CO2e)", "TotalEmissions", "carbon_kg", "CO2eKg"):
            if key in row:
                try:
                    val = float(str(row[key]).replace(",", ""))
                    if region and val > 0:
                        out.append(GroundTruthReading("Azure", region, val, "azure_emissions_dashboard"))
                except ValueError:
                    pass
                break
    return out


def parse_provider_carbon_export(filename: str, content: bytes) -> list[GroundTruthReading]:
    text = content.decode("utf-8", errors="replace")
    lower = filename.lower()
    if "gcp" in lower or filename.endswith(".json"):
        r = parse_gcp_carbon_json(text)
        if r:
            return r
    if "azure" in lower:
        return parse_azure_emissions_csv(text)
    return parse_aws_ccft_csv(text)


def compare_ground_truth(
    modeled_carbon_kg: float,
    modeled_water_l: float,
    readings: list[GroundTruthReading],
    provider: str,
    region_code: str,
) -> dict | None:
    match = next(
        (r for r in readings if r.provider == provider and r.region_code == region_code),
        None,
    )
    if not match:
        return None
    delta_pct = round((modeled_carbon_kg - match.carbon_kg_month) / max(match.carbon_kg_month, 1) * 100, 1)
    return {
        "metric": "carbon_kg_month",
        "modeled": round(modeled_carbon_kg),
        "reported_v4": round(match.carbon_kg_month),
        "delta_pct": delta_pct,
        "pass": abs(delta_pct) <= 35,
        "tier": "V4",
        "source": match.source,
        "title": f"V4 validation vs {match.source}",
        "reference": "Provider carbon tool export (user upload)",
        "note": "Within 35% considered aligned for modeled vs market-based accounting differences",
    }
