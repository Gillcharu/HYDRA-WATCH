"""HydraWatch REST API + production static site server."""

from __future__ import annotations

import os
import json
import logging
import sys
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Setup structured logging
class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "logger": record.name
        }
        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_record)

log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
logger = logging.getLogger("hydrawatch")
logger.setLevel(log_level)
handler = logging.StreamHandler()
if os.environ.get("LOG_FORMAT", "").lower() == "json":
    formatter = JSONFormatter(datefmt="%Y-%m-%dT%H:%M:%SZ")
else:
    formatter = logging.Formatter("[%(asctime)s] %(levelname)s in %(module)s: %(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)

ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIST = ROOT / "frontend" / "dist"
sys.path.insert(0, str(ROOT / "src"))

from api.serialize import serialize_analysis  # noqa: E402
from hydrawatch.analysis import full_analysis, load_regions  # noqa: E402
from hydrawatch.constants import GPU_SPECS, MODEL_SPECS  # noqa: E402
from hydrawatch.explore import load_clusters  # noqa: E402
from hydrawatch.geo import REGION_COORDS  # noqa: E402
from hydrawatch.global_ranking import global_leaderboard  # noqa: E402
from hydrawatch.global_locations import all_location_names, locations_by_continent  # noqa: E402
from hydrawatch.providers import ALL_PROVIDERS, PROVIDER_LABELS  # noqa: E402
from hydrawatch.scoring import compute_sustainability_score  # noqa: E402
from hydrawatch.wue_data import get_wue  # noqa: E402

app = FastAPI(
    title="HydraWatch API",
    description="Sustainability analysis API for AI infrastructure — powers hydrawatch.com",
    version="3.0.0",
)

allowed_origins_str = os.environ.get("CORS_ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in allowed_origins_str.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    provider: str = Field(..., examples=["AWS"])
    region_code: str = Field(..., examples=["ap-south-1"])
    qps: float = Field(100, ge=1)
    avg_tokens: int = Field(1000, ge=1)
    gpu_type: str = Field("A100", examples=["A100", "H100", "V100", "T4"])
    model_name: str = Field("LLaMA-3-70B")
    user_location: str = Field("Mumbai, India")
    max_latency_ms: int = Field(150, ge=50, le=500)
    workload_mode: str = Field("inference")
    data_tb: float = Field(5.0, ge=0)
    quantization: str = Field("FP16")
    framework: str = Field("standard")
    live_telemetry: Optional[bool] = Field(False)


# ── API routes (registered before SPA catch-all) ─────────────────────────────

@app.get("/api")
def api_root():
    df = load_regions()
    return {
        "service": "HydraWatch",
        "version": "3.0.0",
        "regions_total": len(df),
        "providers": sorted(df["provider"].unique().tolist()),
        "docs": "/docs",
        "website": "/",
    }


@app.get("/api/meta")
def meta():
    from hydrawatch.scenarios import SCENARIOS
    return {
        "providers": [{"id": p, "label": PROVIDER_LABELS.get(p, p)} for p in ALL_PROVIDERS],
        "gpus": list(GPU_SPECS.keys()),
        "models": list(MODEL_SPECS.keys()),
        "scenarios": SCENARIOS,
    }


@app.get("/api/regions")
def list_regions(provider: Optional[str] = Query(None)):
    df = load_regions()
    if provider:
        provider_key = provider.strip().casefold()
        df = df[df["provider"].astype(str).str.casefold() == provider_key]
    return {"count": len(df), "regions": df.to_dict(orient="records")}


@app.get("/api/regions/map")
def regions_map():
    df = load_regions()
    points = []
    for _, r in df.iterrows():
        if pd_isna(r.get("water_stress_score")):
            continue
        rc = r["region_code"]
        coords = REGION_COORDS.get(rc)
        if not coords:
            continue
        lat, lon = coords
        score = compute_sustainability_score(
            float(r["water_stress_score"]),
            float(r.get("drought_risk", 2)),
            get_wue(rc),
            float(r["carbon_kg_per_kwh"]),
            50,
            200,
        )
        points.append({
            "region_code": rc,
            "region_name": r["region_name"],
            "provider": r["provider"],
            "country": r["country"],
            "lat": lat,
            "lon": lon,
            "score": round(score, 1),
            "carbon": float(r["carbon_kg_per_kwh"]),
            "water_stress": float(r["water_stress_score"]),
        })
    return {"count": len(points), "points": points}


def pd_isna(v) -> bool:
    import pandas as pd
    return v is None or (isinstance(v, float) and pd.isna(v))


@app.get("/api/locations")
def list_locations():
    return {"count": len(all_location_names()), "locations": all_location_names(), "by_continent": locations_by_continent()}


@app.get("/api/clusters")
def clusters():
    return load_clusters()


async def get_tenant_context(
    x_api_key: Optional[str] = Header(None),
    api_key: Optional[str] = Query(None)
):
    key = x_api_key or api_key
    if key:
        from hydrawatch.db import verify_api_key_db
        context = verify_api_key_db(key)
        if not context:
            raise HTTPException(status_code=401, detail="Invalid API Key credentials")
        return context
    return {"tenant_name": "Guest", "department": "Guest Operations"}


@app.post("/api/analyze")
async def analyze(
    req: AnalyzeRequest,
    top_n: int = Query(10, ge=1, le=121),
    tenant: dict = Depends(get_tenant_context),
):
    if not isinstance(tenant, dict):
        tenant = {"tenant_name": "Guest", "department": "Guest Operations"}
    logger.info(f"Analyze request for Tenant: {tenant['tenant_name']} (Dept: {tenant['department']})")
    try:
        result = await full_analysis(
            provider=req.provider.upper(),
            region_code=req.region_code,
            qps=req.qps,
            avg_tokens=req.avg_tokens,
            gpu_type=req.gpu_type,
            model_name=req.model_name,
            user_location=req.user_location,
            max_latency_ms=req.max_latency_ms,
            workload_mode=req.workload_mode,
            data_tb=req.data_tb,
            quantization=req.quantization,
            workload_framework=req.framework,
            live_telemetry=bool(req.live_telemetry),
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    limit = int(top_n) if isinstance(top_n, (int, float, str)) else 10
    payload = serialize_analysis(result)
    payload["multicloud"] = payload["multicloud"][:limit]
    payload["alternatives"] = payload["alternatives"][:limit]
    payload["tenant"] = tenant
    return payload


@app.get("/api/leaderboard")
def leaderboard(
    user_location: str = Query("Mumbai, India"),
    qps: float = Query(100, ge=1),
    avg_tokens: int = Query(1000, ge=1),
    gpu_type: str = Query("A100"),
    model_name: str = Query("LLaMA-3-70B"),
    max_latency_ms: int = Query(200, ge=50, le=500),
    top_n: int = Query(20, ge=1, le=121),
):
    board = global_leaderboard(
        load_regions(), user_location, qps=qps, avg_tokens=avg_tokens,
        gpu_type=gpu_type, model_name=model_name, max_latency_ms=max_latency_ms, top_n=top_n,
    )
    return {"count": len(board), "leaderboard": board}


@app.get("/api/validate/all")
def validate_all():
    from hydrawatch.auto_validation import validate_all_regions, validation_summary_line
    summary = validate_all_regions(load_regions())
    return {"summary": validation_summary_line(summary), **summary}


@app.post("/api/gate")
async def deploy_gate(
    provider: str = Query("AWS"),
    region_code: str = Query("ap-south-1"),
    min_score: float = Query(40.0),
    min_tier: str = Query("V0"),
    qps: float = Query(100, ge=1),
    live_telemetry: bool = Query(False),
    tenant: dict = Depends(get_tenant_context),
):
    if not isinstance(tenant, dict):
        tenant = {"tenant_name": "Guest", "department": "Guest Operations"}
    logger.info(f"Deploy gate request for Tenant: {tenant['tenant_name']} (Dept: {tenant['department']})")
    from hydrawatch.gate import run_deploy_gate
    gr = await run_deploy_gate(
        provider.upper(), region_code, min_score, min_tier, qps=qps,
        live_telemetry=live_telemetry
    )
    return {
        "passed": gr.passed,
        "score": gr.score,
        "footprint_tier": gr.footprint_tier,
        "message": gr.message,
        "recommendation": gr.recommendation,
        "tenant": tenant,
    }


@app.get("/api/case-study/india-nordic")
async def case_study():
    from hydrawatch.case_study import run_india_vs_nordic_case_study
    return await run_india_vs_nordic_case_study()


@app.get("/api/export/kubernetes")
def export_kubernetes(regions: str = Query(..., description="Comma-separated region names")):
    region_list = [r.strip() for r in regions.split(",") if r.strip()]
    if not region_list:
        raise HTTPException(400, "Must provide at least one valid region")
    from hydrawatch.export import generate_kubernetes_affinity_yaml
    return {"yaml": generate_kubernetes_affinity_yaml(region_list)}


@app.get("/api/export/terraform")
def export_terraform(
    provider: str = Query(..., examples=["AWS", "GCP"]),
    region: str = Query(..., examples=["us-east-1", "eu-north-1"]),
    score: float = Query(50.0),
):
    from hydrawatch.export import generate_terraform_provider_tf
    return {"tf": generate_terraform_provider_tf(provider, region, score)}


# Legacy routes (backward compatible)
@app.get("/locations")
def list_locations_legacy():
    return list_locations()


@app.post("/analyze")
async def analyze_legacy(req: AnalyzeRequest, top_n: int = Query(10, ge=1, le=121)):
    return await analyze(req, top_n)


@app.get("/validate/all")
def validate_all_legacy():
    return validate_all()


@app.post("/gate")
async def deploy_gate_legacy(
    provider: str = Query("AWS"),
    region_code: str = Query("ap-south-1"),
    min_score: float = Query(40.0),
    min_tier: str = Query("V0"),
    qps: float = Query(100, ge=1),
):
    return await deploy_gate(provider, region_code, min_score, min_tier, qps)


@app.get("/case-study/india-nordic")
async def case_study_legacy():
    return await case_study()


# ── Production SPA ─────────────────────────────────────────────────────────────

if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    async def spa_index():
        return FileResponse(FRONTEND_DIST / "index.html")

    @app.get("/{path:path}")
    async def spa_fallback(path: str):
        if path.startswith("api") or path in ("docs", "openapi.json", "redoc"):
            raise HTTPException(404)
        file = FRONTEND_DIST / path
        if file.is_file():
            return FileResponse(file)
        return FileResponse(FRONTEND_DIST / "index.html")
