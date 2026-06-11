#!/usr/bin/env python3
"""API integration tests."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))

from api.main import app  # noqa: E402

client = TestClient(app)


def test_api_meta():
    r = client.get("/api/meta")
    assert r.status_code == 200
    data = r.json()
    assert len(data["scenarios"]) == 4
    assert len(data["providers"]) == 7


def test_api_regions():
    r = client.get("/api/regions")
    assert r.status_code == 200
    assert r.json()["count"] >= 121


def test_api_analyze():
    r = client.post(
        "/api/analyze",
        json={
            "provider": "AWS",
            "region_code": "ap-south-1",
            "qps": 150,
            "avg_tokens": 1000,
            "gpu_type": "A100",
            "model_name": "LLaMA-3-70B",
            "user_location": "Mumbai, India",
            "max_latency_ms": 200,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["current"]["sustainability_score"] > 0
    assert data["current"]["provider"] == "AWS"


def test_api_validate_all():
    r = client.get("/api/validate/all")
    assert r.status_code == 200
    assert r.json()["pass_rate_pct"] >= 99


def test_spa_index():
    r = client.get("/")
    assert r.status_code == 200
    assert "text/html" in r.headers.get("content-type", "")


def test_api_exporters():
    r = client.get("/api/export/kubernetes?regions=ap-south-1,eu-north-1")
    assert r.status_code == 200
    assert "yaml" in r.json()
    assert "nodeAffinity" in r.json()["yaml"]
    
    r = client.get("/api/export/terraform?provider=AWS&region=eu-north-1&score=85.5")
    assert r.status_code == 200
    assert "tf" in r.json()
    assert "aws" in r.json()["tf"]
