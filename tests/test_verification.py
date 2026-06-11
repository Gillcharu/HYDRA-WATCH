#!/usr/bin/env python3
"""CI verification suite — run: python3 -m pytest tests/ -v"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from hydrawatch.analysis import load_regions
from hydrawatch.validation import CASE_STUDIES, run_global_validation_checks, validate_region
from hydrawatch.verify.ground_truth import parse_aws_ccft_csv
from hydrawatch.verify.tiers import TIER_ORDER, min_tier
from hydrawatch.wue_data import get_wue


def test_all_regions_have_carbon():
    df = load_regions()
    assert len(df) >= 100
    assert df["carbon_kg_per_kwh"].notna().all()


def test_case_study_count():
    assert len(CASE_STUDIES) >= 20


def test_india_carbon_validation():
    checks = validate_region("ap-south-1", get_wue("ap-south-1"), 0.71)
    carbon_checks = [c for c in checks if c.get("metric") == "Carbon (kg/kWh)"]
    assert carbon_checks and carbon_checks[0]["pass"]


def test_sweden_lower_than_india():
    df = load_regions()
    tests = run_global_validation_checks(df)
    assert all(t["pass"] for t in tests)


def test_tier_ordering():
    assert min_tier("V3", "V1", "V2") == "V1"


def test_ccft_parser():
    csv = "Region,Emissions (kg CO2e)\nap-south-1,1850\n"
    readings = parse_aws_ccft_csv(csv)
    assert len(readings) == 1
    assert readings[0].carbon_kg_month == 1850
    assert readings[0].tier == "V4"


def test_every_provider_has_regions():
    df = load_regions()
    for prov in ["AWS", "GCP", "Azure", "OCI", "IBM", "Alibaba", "DigitalOcean"]:
        assert len(df[df["provider"] == prov]) > 0, prov


def test_benchmark_energy_v2():
    from hydrawatch.estimation import estimate_footprint
    fp = estimate_footprint(150, 1000, "A100", "LLaMA-3-70B", "ap-south-1", 0.71, "AWS")
    assert fp is not None
    assert fp.energy_tier == "V2"
    assert "MLPerf" in fp.energy_basis or "benchmark" in fp.energy_basis.lower()


def test_auto_validation_pass_rate():
    from hydrawatch.auto_validation import validate_all_regions
    summary = validate_all_regions(load_regions())
    assert summary["pass_rate_pct"] >= 95


def test_case_study_direction():
    import asyncio
    from hydrawatch.case_study import run_india_vs_nordic_case_study
    cs = asyncio.run(run_india_vs_nordic_case_study())
    assert cs["findings"]["directionally_correct"]
    assert cs["findings"]["carbon_ratio_mumbai_to_stockholm"] > 3


def test_deploy_gate_green_region():
    import asyncio
    from hydrawatch.gate import run_deploy_gate
    gr = asyncio.run(run_deploy_gate("AWS", "eu-north-1", min_score=50))
    assert gr.passed


def test_quantization_reduces_gpus_needed():
    from hydrawatch.estimation import estimate_footprint
    fp_fp16 = estimate_footprint(150, 1000, "A100", "LLaMA-3-70B", "ap-south-1", 0.71, "AWS", quantization="FP16")
    fp_int4 = estimate_footprint(150, 1000, "A100", "LLaMA-3-70B", "ap-south-1", 0.71, "AWS", quantization="INT4")
    assert fp_int4.gpus_needed <= fp_fp16.gpus_needed


def test_embodied_carbon_calculation():
    from hydrawatch.estimation import estimate_footprint
    fp = estimate_footprint(150, 1000, "A100", "LLaMA-3-70B", "ap-south-1", 0.71, "AWS")
    assert fp.embodied_carbon_month.mid > 0
    assert abs(fp.total_carbon_month.mid - (fp.carbon_month.mid + fp.embodied_carbon_month.mid)) < 1e-4
    assert fp.offset_cost_usd_month > 0
    assert fp.tree_absorption_months > 0


def test_embodied_water_calculation():
    from hydrawatch.estimation import estimate_footprint
    fp = estimate_footprint(150, 1000, "A100", "LLaMA-3-70B", "ap-south-1", 0.71, "AWS")
    assert fp.embodied_water_month.mid > 0
    assert abs(fp.total_water_month.mid - (fp.water_month.mid + fp.embodied_water_month.mid)) < 1e-4


def test_export_configuration():
    from hydrawatch.export import generate_kubernetes_affinity_yaml, generate_terraform_provider_tf
    k8s = generate_kubernetes_affinity_yaml(["eu-north-1", "europe-north1"])
    assert "eu-north-1" in k8s
    assert "nodeAffinity" in k8s
    
    tf = generate_terraform_provider_tf("AWS", "eu-north-1", 85.5)
    assert "eu-north-1" in tf
    assert "aws" in tf
    assert "85.5" in tf


def test_api_key_auth_verification():
    from hydrawatch.db import verify_api_key_db
    cx = verify_api_key_db("hw_cx_key")
    assert cx is not None
    assert cx["department"] == "Customer Experience"
    
    missing = verify_api_key_db("hw_invalid_key")
    assert missing is None


def test_live_telemetry_variation():
    from hydrawatch.telemetry import get_live_telemetry
    tel1 = get_live_telemetry("ap-south-1")
    assert tel1["pue"] > 1.0
    assert tel1["wue"] > 0.0
