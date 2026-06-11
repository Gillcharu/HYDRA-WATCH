# HydraWatch

**Global AI infrastructure sustainability platform** — compare water, carbon, and cloud regions worldwide before you deploy.

## Website (production)

React + TypeScript frontend served by FastAPI at a single port.

```bash
cd ~/Projects/hydrawatch

# Backend
pip3 install -r requirements.txt
python3 -m uvicorn api.main:app --reload --port 8000

# Frontend (dev — proxies API)
cd frontend && npm install && npm run dev
# → http://localhost:3000
```

**Production build** (API serves the built site at `/`):

```bash
cd frontend && npm install && npm run build
cd .. && python3 -m uvicorn api.main:app --port 8000
# → http://localhost:8000
```

### Docker

```bash
docker compose up --build
# → http://localhost:8000
```

## Features

- **121 cloud regions** — AWS, GCP, Azure, OCI, IBM, Alibaba, DigitalOcean
- **React web app** — Home, Analyze, Regions map, Leaderboard, Verification, Case study
- **REST API** — `/api/*` + OpenAPI docs at `/docs`
- **V0–V4 verification** — MLPerf energy, IEA/eGRID carbon bands, CCFT upload path
- **CI/CD gates** — `python3 run.py gate` and `POST /api/gate`

## CLI

```bash
python3 run.py analyze --region ap-south-1
python3 run.py case-study
python3 run.py validate-all
python3 run.py gate --region eu-north-1 --min-score 50
```

## Data layer

Region data lives in `data/` as versioned CSV/JSON (121 regions, clusters, MLPerf benchmarks, audit chain). No separate database server required.

## Optional environment

```bash
export ELECTRICITY_MAPS_API_KEY=your_key   # live grid carbon
export AWS_ACCESS_KEY_ID=...               # CloudWatch telemetry
```

## License

MIT
