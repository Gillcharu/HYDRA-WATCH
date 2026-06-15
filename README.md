# HydraWatch

**Sustainable AI infrastructure intelligence for cloud-region decisions.**

HydraWatch is a full-stack decision-support platform for estimating and comparing the environmental footprint of AI workloads across global cloud regions. It combines workload assumptions, cloud-region metadata, grid carbon factors, water-stress data, WUE/PUE assumptions, and latency-aware recommendations to help teams consider sustainability alongside cost and performance.

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com)

## What It Does

- Compares **121 cloud regions across 7 providers**
- Estimates workload **energy, carbon, water, cost, and latency**
- Recommends lower-impact deployment regions with explainable trade-offs
- Shows global cloud-region coverage with water-stress and carbon indicators
- Includes a personal AI-use estimator for single-query water/carbon ranges
- Provides methodology, verification tiers, and public-data provenance
- Supports SQLite locally and PostgreSQL-style deployment through `DATABASE_URL`

HydraWatch is a **modeled decision-support system**, not audited ESG/carbon accounting.

## Screens

- **Home:** product overview and case-study proof
- **Platform:** source-connected workload analysis and region recommendation
- **Regions:** provider filters, global map, and region table
- **Rankings:** sustainability leaderboard
- **Estimator:** individual AI prompt footprint ranges
- **Trust:** V0-V4 verification ladder and methodology notes

## Tech Stack

**Frontend**

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Framer Motion
- Recharts/custom visualization components

**Backend**

- Python
- FastAPI
- Pandas / NumPy / scikit-learn
- SQLAlchemy
- SQLite by default, PostgreSQL-compatible via `DATABASE_URL`

**Infrastructure**

- Docker
- Docker Compose
- GitHub Actions verification workflow

## Project Structure

```text
hydrawatch/
├── api/                 # FastAPI app and serializers
├── data/                # Region, WUE, carbon, benchmark, and cache datasets
├── frontend/            # React + TypeScript web app
├── scripts/             # Data generation, enrichment, verification helpers
├── src/hydrawatch/      # Core scoring, estimation, recommendation logic
├── tests/               # API and verification tests
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── run.py               # CLI entrypoint
```

## Quick Start

### 1. Install Backend Dependencies

```bash
cd ~/Projects/hydrawatch
python3 -m pip install -r requirements.txt
```

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 3. Run Frontend In Development

```bash
cd ~/Projects/hydrawatch/frontend
npm run dev
```

Vite runs at:

```text
http://localhost:5173
```

### 4. Run Backend API

In a second terminal:

```bash
cd ~/Projects/hydrawatch
python3 -m uvicorn api.main:app --reload --port 8080
```

API runs at:

```text
http://localhost:8080/api
```

### 5. Production-Style Local Run

Build the React app and serve it from FastAPI:

```bash
cd ~/Projects/hydrawatch/frontend
npm run build

cd ..
python3 -m uvicorn api.main:app --port 8080
```

Open:

```text
http://localhost:8080
```

## Docker

```bash
cd ~/Projects/hydrawatch
docker compose up --build
```

Then open:

```text
http://localhost:8080
```

## Configuration

Copy `.env.example` to `.env` if you want to configure optional services:

```bash
cp .env.example .env
```

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | SQLAlchemy connection string | `sqlite:///data/hydrawatch.db` |
| `ELECTRICITY_MAPS_API_KEY` | Optional live carbon-intensity lookup | Static regional fallback |
| `GOOGLE_MAPS_API_KEY` | Optional geocoding provider | OpenStreetMap/Nominatim fallback |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed frontend origins | `https://hydra-watch.onrender.com,http://localhost:5173,http://localhost:8080` |
| `LOG_LEVEL` | Backend logging level | `INFO` |
| `HYDRAWATCH_ENABLE_API_DOCS` | Enable `/docs`, `/redoc`, and `/openapi.json` | `false` |
| `REDIS_URL` | Optional Redis backend for distributed rate limiting | In-memory limiter |
| `ANALYZE_RATE_LIMIT_MAX` | Max `/api/analyze` requests per IP per minute | `5` |
| `HYDRAWATCH_REQUIRE_API_KEY` | Require `X-API-Key` for expensive endpoints | `false` |
| `HYDRAWATCH_API_KEYS` | Optional seeded keys as `key:tenant:department` entries | empty |
| `HYDRAWATCH_REQUIRE_TURNSTILE` | Require Cloudflare Turnstile on analysis requests | `false` |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile backend secret | empty |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile frontend site key | empty |

## API Highlights

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api` | `GET` | Service metadata and provider summary |
| `/api/meta` | `GET` | Models, GPUs, providers, scenarios |
| `/api/regions` | `GET` | Region list with water/carbon data |
| `/api/regions/map` | `GET` | Map points for the global region view |
| `/api/analyze` | `POST` | Workload footprint and recommendations |
| `/api/leaderboard` | `GET` | Ranked sustainable cloud regions |
| `/api/validate/all` | `GET` | Carbon-band validation summary |
| `/sitemap.xml` | `GET` | Dynamic sitemap |

Interactive API docs are disabled by default in production. For local/internal debugging, set:

```bash
export HYDRAWATCH_ENABLE_API_DOCS=true
```

Then API docs are available at:

```text
http://localhost:8080/docs
```

## CLI Examples

```bash
python3 run.py analyze --region ap-south-1 --qps 120 --avg-tokens 1000
python3 run.py gate --region eu-north-1 --min-score 50
python3 run.py validate-all
```

## Data And Methodology

HydraWatch uses public and modeled inputs, including:

- WRI Aqueduct-style water-stress indicators
- Regional carbon-intensity references from IEA/eGRID-style factors
- Cloud-region metadata across AWS, Azure, GCP, OCI, IBM, Alibaba, and DigitalOcean
- WUE/PUE assumptions based on public sustainability reporting
- GPU energy and throughput assumptions using benchmark-informed models

Because commercial AI infrastructure details are often proprietary, outputs are shown as modeled estimates and ranges. They are designed for comparison and planning, not audited reporting.

## Testing

```bash
cd ~/Projects/hydrawatch
python3 -m pytest tests/ -v
```

## Deployment Notes

Recommended simple deployment paths:

- Full stack on Render, Fly.io, or Railway using `Dockerfile`
- Frontend on Vercel/Netlify and API on Render/Fly.io
- Add `DATABASE_URL` for managed PostgreSQL in production
- Configure HTTPS and real domain metadata after domain purchase

## Security And Privacy

- Do not commit `.env` files or API keys.
- Connected-source cards are illustrative unless real credentials are configured.
- This project should use read-only cloud credentials for telemetry integrations.
- Public results should be treated as modeled decision support.

## License

MIT License. See [LICENSE](LICENSE).
