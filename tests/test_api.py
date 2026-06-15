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

# Ensure dummy frontend/dist/index.html exists so FastAPI SPA routes are registered during testing
dist_dir = ROOT / "frontend" / "dist"
dist_dir.mkdir(parents=True, exist_ok=True)
dummy_index = dist_dir / "index.html"
if not dummy_index.exists():
    dummy_index.write_text("<!DOCTYPE html><html><body>Dummy</body></html>")

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


def test_exporters_reject_injection_payloads():
    r = client.get("/api/export/kubernetes", params={"regions": "eu-north-1\n        - injected"})
    assert r.status_code == 400

    r = client.get(
        "/api/export/terraform",
        params={
            "provider": 'aws"\nresource "null_resource" "pwned" {}',
            "region": "eu-north-1",
            "score": 80,
        },
    )
    assert r.status_code == 400


def test_api_geocode_and_estimates():
    # Test geocode caching
    r = client.get("/api/geocode?q=Mumbai")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert "lat" in data[0]
    assert "lon" in data[0]
    assert "display_name" in data[0]

    # Save a configuration estimate
    config = {
        "compare": True,
        "tool": "ChatGPT",
        "usage": 25,
        "type": "coding",
        "loc": "Mumbai, India",
        "lat": 19.07,
        "lon": 72.87
    }
    r = client.post("/api/estimates", json=config)
    assert r.status_code == 200
    res_save = r.json()
    assert "id" in res_save
    est_id = res_save["id"]

    # Retrieve the saved estimate
    r = client.get(f"/api/estimates/{est_id}")
    assert r.status_code == 200
    res_get = r.json()
    assert res_get["id"] == est_id
    assert res_get["config_data"]["tool"] == "ChatGPT"
    assert res_get["config_data"]["usage"] == 25

    # Get sitemap
    r = client.get("/sitemap.xml")
    assert r.status_code == 200
    assert "xml" in r.headers.get("content-type", "")
    assert f"/e/{est_id}" not in r.text

    huge_config = {
        "compare": False,
        "tool": "ChatGPT",
        "usage": 25,
        "type": "simple",
        "unexpected": "x" * 1000,
    }
    r = client.post("/api/estimates", json=huge_config)
    assert r.status_code == 422


def test_sitemap_uses_canonical_host_not_request_host():
    r = client.get("/sitemap.xml", headers={"host": "evil.example"})
    assert r.status_code == 200
    assert "evil.example" not in r.text
    assert "https://hydra-watch.onrender.com" in r.text


def test_api_key_query_parameter_is_ignored():
    r = client.post(
        "/api/analyze?api_key=anything",
        json={
            "provider": "AWS",
            "region_code": "ap-south-1",
            "qps": 10,
            "avg_tokens": 100,
            "gpu_type": "A100",
            "model_name": "LLaMA-3-70B",
            "user_location": "Mumbai, India",
            "max_latency_ms": 200,
        },
    )
    assert r.status_code == 200
    assert r.json()["tenant"]["tenant_name"] == "Guest"
