"""HydraWatch REST API + production static site server."""

from __future__ import annotations

import os
import json
import logging
import sys
import hashlib
import copy
from html import escape
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Header, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import time
import httpx

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
from sqlalchemy.orm import Session  # noqa: E402
from hydrawatch.database import init_db, get_db, GeocodeCache, SavedEstimate  # noqa: E402

app = FastAPI(
    title="HydraWatch API",
    description="Sustainability analysis API for AI infrastructure — powers hydrawatch.com",
    version="3.0.0",
)

@app.on_event("startup")
def startup_event():
    logger.info("Initializing database tables...")
    try:
        init_db()
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")

allowed_origins_str = os.environ.get("CORS_ALLOWED_ORIGINS", "https://hydra-watch.onrender.com,http://localhost:5173,http://localhost:8080")
allowed_origins = [o.strip() for o in allowed_origins_str.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Simple sliding window rate limit database (client_ip -> list of request timestamps)
RATE_LIMITS = {}
RATE_LIMIT_MAX = 100  # maximum requests per client IP per minute
RATE_LIMIT_WINDOW = 60  # time window in seconds
RATE_LIMIT_SWEEP_INTERVAL = 60
RATE_LIMIT_LAST_SWEEP = 0.0

ANALYZE_RATE_LIMITS = {}
ANALYZE_LIMIT_MAX = int(os.environ.get("ANALYZE_RATE_LIMIT_MAX", "5"))
ENDPOINT_RATE_LIMITS = {
    "/api/analyze": ANALYZE_LIMIT_MAX,
    "/api/gate": int(os.environ.get("GATE_RATE_LIMIT_MAX", "10")),
    "/api/geocode": int(os.environ.get("GEOCODE_RATE_LIMIT_MAX", "20")),
    "/api/export/kubernetes": int(os.environ.get("EXPORT_RATE_LIMIT_MAX", "10")),
    "/api/export/terraform": int(os.environ.get("EXPORT_RATE_LIMIT_MAX", "10")),
}
REDIS_URL = os.environ.get("REDIS_URL", "").strip()
REQUIRE_API_KEY_FOR_EXPENSIVE = os.environ.get("HYDRAWATCH_REQUIRE_API_KEY", "false").lower() in {"1", "true", "yes"}
REQUIRE_TURNSTILE = os.environ.get("HYDRAWATCH_REQUIRE_TURNSTILE", "false").lower() in {"1", "true", "yes"}
TURNSTILE_SECRET_KEY = os.environ.get("TURNSTILE_SECRET_KEY", "").strip()
ANALYZE_CACHE_TTL = int(os.environ.get("ANALYZE_CACHE_TTL_SECONDS", "300"))
ANALYZE_CACHE: dict[str, tuple[float, dict]] = {}
_REDIS_CLIENT = None


def _get_redis_client():
    global _REDIS_CLIENT
    if not REDIS_URL:
        return None
    if _REDIS_CLIENT is not None:
        return _REDIS_CLIENT
    try:
        import redis  # type: ignore
        _REDIS_CLIENT = redis.Redis.from_url(REDIS_URL, decode_responses=True)
        _REDIS_CLIENT.ping()
        return _REDIS_CLIENT
    except Exception as e:
        logger.warning(f"Redis rate limiter unavailable, falling back to in-memory limits: {e}")
        _REDIS_CLIENT = False
        return None


def _sweep_rate_limits(now: float) -> None:
    global RATE_LIMIT_LAST_SWEEP
    if now - RATE_LIMIT_LAST_SWEEP < RATE_LIMIT_SWEEP_INTERVAL:
        return
    for bucket in (RATE_LIMITS, ANALYZE_RATE_LIMITS):
        stale_keys = []
        for client_ip, history in bucket.items():
            fresh = [t for t in history if now - t < RATE_LIMIT_WINDOW]
            if fresh:
                bucket[client_ip] = fresh
            else:
                stale_keys.append(client_ip)
        for key in stale_keys:
            del bucket[key]
    RATE_LIMIT_LAST_SWEEP = now

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Only rate limit API requests
    if request.url.path.startswith("/api/"):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        _sweep_rate_limits(now)

        endpoint_limit = ENDPOINT_RATE_LIMITS.get(request.url.path)
        if endpoint_limit:
            redis_client = _get_redis_client()
            if redis_client:
                key = f"rl:{request.url.path}:{client_ip}:{int(now // RATE_LIMIT_WINDOW)}"
                try:
                    count = redis_client.incr(key)
                    if count == 1:
                        redis_client.expire(key, RATE_LIMIT_WINDOW + 5)
                    if count > endpoint_limit:
                        return JSONResponse(
                            status_code=429,
                            content={"detail": f"Rate limit exceeded. Max {endpoint_limit} requests per minute for this endpoint."},
                        )
                except Exception as e:
                    logger.warning(f"Redis rate limit check failed, using in-memory fallback: {e}")
            else:
                endpoint_key = f"{request.url.path}:{client_ip}"
                endpoint_history = ANALYZE_RATE_LIMITS.get(endpoint_key, [])
                endpoint_history = [t for t in endpoint_history if now - t < RATE_LIMIT_WINDOW]
                if len(endpoint_history) >= endpoint_limit:
                    return JSONResponse(
                        status_code=429,
                        content={"detail": f"Rate limit exceeded. Max {endpoint_limit} requests per minute for this endpoint."},
                    )
                endpoint_history.append(now)
                ANALYZE_RATE_LIMITS[endpoint_key] = endpoint_history
        
        # 1. Stricter check for resource-intensive /api/analyze endpoint (max 10 req/min)
        if request.url.path == "/api/analyze":
            analyze_history = ANALYZE_RATE_LIMITS.get(client_ip, [])
            analyze_history = [t for t in analyze_history if now - t < RATE_LIMIT_WINDOW]
            if len(analyze_history) >= ANALYZE_LIMIT_MAX:
                logger.warning(f"Analyze endpoint rate limit exceeded for client IP: {client_ip}")
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded for analyze endpoint. Max 10 requests per minute."},
                )
            analyze_history.append(now)
            ANALYZE_RATE_LIMITS[client_ip] = analyze_history
            
        # 2. General check for all other /api/* endpoints
        history = RATE_LIMITS.get(client_ip, [])
        history = [t for t in history if now - t < RATE_LIMIT_WINDOW]
        
        if len(history) >= RATE_LIMIT_MAX:
            logger.warning(f"Rate limit exceeded for client IP: {client_ip} on path: {request.url.path}")
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Rate limit exceeded."},
            )
            
        history.append(now)
        RATE_LIMITS[client_ip] = history

    response = await call_next(request)
    return response


# Path to geocode cache file
GEOCODE_CACHE_PATH = ROOT / "data" / "geocode_cache.json"


async def enforce_expensive_endpoint_key(x_api_key: Optional[str] = Header(None)) -> None:
    if not REQUIRE_API_KEY_FOR_EXPENSIVE:
        return
    if not x_api_key:
        raise HTTPException(status_code=401, detail="X-API-Key header required for this endpoint")
    from hydrawatch.db import verify_api_key_db
    if not verify_api_key_db(x_api_key):
        raise HTTPException(status_code=401, detail="Invalid API Key credentials")


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
    turnstile_token: Optional[str] = Field(None, exclude=True)


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


@app.get("/api/geocode")
async def geocode(
    q: str = Query(..., min_length=2),
    db: Session = Depends(get_db),
    _: None = Depends(enforce_expensive_endpoint_key),
):
    key = q.strip().casefold()
    
    # 1. Check database cache
    try:
        cached = db.query(GeocodeCache).filter(GeocodeCache.query == key).first()
        if cached:
            logger.info(f"Database geocode cache hit for query: {q}")
            return [{
                "place_id": 0,
                "lat": str(cached.lat),
                "lon": str(cached.lon),
                "display_name": cached.display_name
            }]
    except Exception as e:
        logger.error(f"Error checking database geocode cache: {e}")

    # 2. Check legacy file cache
    cache = {}
    if GEOCODE_CACHE_PATH.exists():
        try:
            with open(GEOCODE_CACHE_PATH, "r", encoding="utf-8") as f:
                cache = json.load(f)
        except Exception as e:
            logger.error(f"Error reading legacy geocode cache file: {e}")

    if key in cache:
        logger.info(f"Legacy geocode cache hit for query: {q}")
        # Sync to DB cache so future runs hit DB
        try:
            val = cache[key]
            if isinstance(val, list) and len(val) > 0:
                first = val[0]
                existing = db.query(GeocodeCache).filter(GeocodeCache.query == key).first()
                if not existing:
                    db.add(GeocodeCache(
                        query=key,
                        lat=float(first.get("lat", 0.0)),
                        lon=float(first.get("lon", 0.0)),
                        display_name=first.get("display_name", "")
                    ))
                    db.commit()
        except Exception as db_err:
            logger.error(f"Failed to sync legacy cache to DB: {db_err}")
            db.rollback()
        return cache[key]

    # 3. Cache miss - fetch live
    google_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    results = []
    
    if google_key:
        logger.info(f"Using Google Maps Geocoding API for query: {q}")
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {"address": q, "key": google_key}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, params=params)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("status") == "OK" and data.get("results"):
                        for idx, r in enumerate(data["results"]):
                            lat = r["geometry"]["location"]["lat"]
                            lon = r["geometry"]["location"]["lng"]
                            display_name = r["formatted_address"]
                            place_id = r.get("place_id") or f"g_{idx}"
                            results.append({
                                "place_id": place_id,
                                "lat": str(lat),
                                "lon": str(lon),
                                "display_name": display_name
                            })
                    else:
                        logger.warning(f"Google Maps API returned non-OK status: {data.get('status')}")
                else:
                    logger.error(f"Google Maps API status {response.status_code} for query: {q}")
        except Exception as e:
            logger.error(f"Error calling Google Maps API: {e}")
            
    if not results:
        # Fallback to OSM Nominatim
        logger.info(f"Using OpenStreetMap Nominatim for query: {q}")
        url = "https://nominatim.openstreetmap.org/search"
        headers = {"User-Agent": "HydraWatch/3.0.0 (sustainability-tool; contact: contact@hydrawatch.com)"}
        params = {"format": "json", "q": q, "limit": 5}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, params=params, headers=headers)
                if response.status_code == 200:
                    results = response.json()
                else:
                    logger.error(f"Nominatim status {response.status_code} for query: {q}")
        except Exception as e:
            logger.error(f"Error calling Nominatim API: {e}")

    # Write back to both DB and legacy cache file
    if results:
        try:
            first = results[0]
            existing = db.query(GeocodeCache).filter(GeocodeCache.query == key).first()
            if not existing:
                db.add(GeocodeCache(
                    query=key,
                    lat=float(first["lat"]),
                    lon=float(first["lon"]),
                    display_name=first["display_name"]
                ))
                db.commit()
                logger.info(f"Saved cache entry to database for query: {q}")
        except Exception as db_err:
            logger.error(f"Error saving geocode cache to DB: {db_err}")
            db.rollback()

        # Update legacy file cache
        try:
            cache[key] = results
            with open(GEOCODE_CACHE_PATH, "w", encoding="utf-8") as f:
                json.dump(cache, f, indent=2, ensure_ascii=False)
        except Exception as file_err:
            logger.error(f"Error writing geocode cache file: {file_err}")

    return results


@app.get("/api/clusters")
def clusters():
    return load_clusters()


async def get_tenant_context(
    x_api_key: Optional[str] = Header(None),
):
    key = x_api_key
    if key:
        from hydrawatch.db import verify_api_key_db
        context = verify_api_key_db(key)
        if not context:
            raise HTTPException(status_code=401, detail="Invalid API Key credentials")
        return context
    return {"tenant_name": "Guest", "department": "Guest Operations"}


async def get_required_tenant_context(x_api_key: Optional[str] = Header(None)):
    tenant = await get_tenant_context(x_api_key)
    if tenant.get("department") == "Guest Operations":
        raise HTTPException(status_code=401, detail="X-API-Key header required for this endpoint")
    return tenant


async def verify_turnstile(token: Optional[str], remote_ip: str | None = None) -> None:
    if not REQUIRE_TURNSTILE:
        return
    if not TURNSTILE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Turnstile verification is enabled but not configured")
    if not token:
        raise HTTPException(status_code=403, detail="Human verification required")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                data={
                    "secret": TURNSTILE_SECRET_KEY,
                    "response": token,
                    "remoteip": remote_ip or "",
                },
            )
        data = response.json()
    except Exception as e:
        logger.warning(f"Turnstile verification failed: {e}")
        raise HTTPException(status_code=403, detail="Human verification failed")
    if not data.get("success"):
        raise HTTPException(status_code=403, detail="Human verification failed")


def _analyze_cache_key(req: AnalyzeRequest, top_n: int) -> str:
    payload = req.model_dump(exclude={"turnstile_token"}, mode="json")
    payload["top_n"] = top_n
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _get_analyze_cache(key: str) -> dict | None:
    if ANALYZE_CACHE_TTL <= 0:
        return None
    item = ANALYZE_CACHE.get(key)
    if not item:
        return None
    expires_at, payload = item
    if time.time() >= expires_at:
        ANALYZE_CACHE.pop(key, None)
        return None
    cached = copy.deepcopy(payload)
    cached["cached"] = True
    return cached


def _set_analyze_cache(key: str, payload: dict) -> None:
    if ANALYZE_CACHE_TTL <= 0:
        return
    ANALYZE_CACHE[key] = (time.time() + ANALYZE_CACHE_TTL, copy.deepcopy(payload))
    if len(ANALYZE_CACHE) > 256:
        now = time.time()
        stale = [k for k, (exp, _) in ANALYZE_CACHE.items() if exp <= now]
        for k in stale:
            ANALYZE_CACHE.pop(k, None)
        while len(ANALYZE_CACHE) > 256:
            ANALYZE_CACHE.pop(next(iter(ANALYZE_CACHE)))


@app.post("/api/analyze")
async def analyze(
    req: AnalyzeRequest,
    top_n: int = Query(10, ge=1, le=121),
    tenant: dict = Depends(get_tenant_context),
    request: Request = None,
):
    if REQUIRE_API_KEY_FOR_EXPENSIVE and tenant.get("department") == "Guest Operations":
        raise HTTPException(status_code=401, detail="X-API-Key header required for analysis")
    await verify_turnstile(req.turnstile_token, request.client.host if request and request.client else None)
    if not isinstance(tenant, dict):
        tenant = {"tenant_name": "Guest", "department": "Guest Operations"}
    logger.info(f"Analyze request for Tenant: {tenant['tenant_name']} (Dept: {tenant['department']})")
    cache_key = _analyze_cache_key(req, int(top_n))
    cached = _get_analyze_cache(cache_key)
    if cached:
        cached["tenant"] = tenant
        return cached
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
    _set_analyze_cache(cache_key, payload)
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
    if REQUIRE_API_KEY_FOR_EXPENSIVE and tenant.get("department") == "Guest Operations":
        raise HTTPException(status_code=401, detail="X-API-Key header required for deploy gate")
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
def export_kubernetes(
    regions: str = Query(..., description="Comma-separated region names"),
    _: None = Depends(enforce_expensive_endpoint_key),
):
    region_list = [r.strip() for r in regions.split(",") if r.strip()]
    if not region_list:
        raise HTTPException(400, "Must provide at least one valid region")
    from hydrawatch.export import generate_kubernetes_affinity_yaml
    try:
        return {"yaml": generate_kubernetes_affinity_yaml(region_list)}
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/api/export/terraform")
def export_terraform(
    provider: str = Query(..., examples=["AWS", "GCP"]),
    region: str = Query(..., examples=["us-east-1", "eu-north-1"]),
    score: float = Query(50.0),
    _: None = Depends(enforce_expensive_endpoint_key),
):
    from hydrawatch.export import generate_terraform_provider_tf
    try:
        return {"tf": generate_terraform_provider_tf(provider, region, score)}
    except ValueError as e:
        raise HTTPException(400, str(e))


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


# ── Saved Estimates & Sitemap ──────────────────────────────────────────────────

class SavedEstimateResponse(BaseModel):
    id: str
    config_data: dict

@app.post("/api/estimates", response_model=SavedEstimateResponse)
def create_saved_estimate(payload: dict, db: Session = Depends(get_db)):
    import uuid
    est_id = str(uuid.uuid4())
    db_est = SavedEstimate(id=est_id, config_data=payload)
    try:
        db.add(db_est)
        db.commit()
        db.refresh(db_est)
        logger.info(f"Saved estimate with id: {est_id}")
        return SavedEstimateResponse(id=db_est.id, config_data=db_est.config_data)
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save estimate: {e}")
        raise HTTPException(status_code=500, detail="Database write failure")

@app.get("/api/estimates/{estimate_id}", response_model=SavedEstimateResponse)
def get_saved_estimate(estimate_id: str, db: Session = Depends(get_db)):
    try:
        db_est = db.query(SavedEstimate).filter(SavedEstimate.id == estimate_id).first()
        if not db_est:
            raise HTTPException(status_code=404, detail="Saved estimate not found")
        return SavedEstimateResponse(id=db_est.id, config_data=db_est.config_data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving saved estimate: {e}")
        raise HTTPException(status_code=500, detail="Database read failure")

from fastapi.responses import Response

@app.get("/sitemap.xml")
def sitemap(request: Request, db: Session = Depends(get_db)):
    base_url = os.environ.get("PUBLIC_BASE_URL", "https://hydra-watch.onrender.com").rstrip("/")
    static_routes = [
        "",
        "/platform",
        "/regions",
        "/leaderboard",
        "/trust",
        "/personal-estimator"
    ]
    
    xml_entries = []
    for route in static_routes:
        url = f"{base_url}{route}"
        xml_entries.append(
            f"  <url>\n"
            f"    <loc>{escape(url)}</loc>\n"
            f"    <changefreq>weekly</changefreq>\n"
            f"    <priority>0.8</priority>\n"
            f"  </url>"
        )
        
    try:
        estimates = db.query(SavedEstimate).order_by(SavedEstimate.created_at.desc()).limit(200).all()
        for est in estimates:
            url = f"{base_url}/e/{est.id}"
            xml_entries.append(
                f"  <url>\n"
                f"    <loc>{escape(url)}</loc>\n"
                f"    <changefreq>monthly</changefreq>\n"
                f"    <priority>0.6</priority>\n"
                f"  </url>"
            )
    except Exception as e:
        logger.error(f"Error querying saved estimates for sitemap: {e}")

    xml_content = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(xml_entries)
        + "\n</urlset>"
    )
    return Response(content=xml_content, media_type="application/xml")


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
