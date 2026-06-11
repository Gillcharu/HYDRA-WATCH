<div align="center">

# 💧 HydraWatch

### The Sustainability Decision Layer for Global AI Infrastructure

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**Analyze, optimize, and verify AI workload carbon emissions, power grids, and water stress intensity across 121 cloud regions worldwide before you deploy.**

[Explore Platform](#-core-features) • [Local Setup](#-quick-start) • [Docker Compose](#-docker-orchestration) • [API & CLI](#-developer-apis--cli)

</div>

---

## ⚡ Core Features

*   **🌍 Interactive 3D Globe**: Visually trace live grid carbon scores, regional water scarcity indices, and power-grid emissions directly on a dynamic Canvas sphere.
*   **📊 Personal AI Use Estimator**: Compute direct/indirect water cooling consumption (L), energy draw (Wh), and carbon footprint (g CO₂e) per query. Translate calculations to LED lightbulb hours, gas car distance driven, and running tap seconds.
*   **🔄 Side-by-Side A/B Comparison**: Evaluate and contrast different model configurations, daily query traffic, or datacenter locations with dynamic comparison chart tooltips and percentage delta counters.
*   **🔌 Automated Fallback Database**: Persisted geocoding caching and shared estimation configuration states via SQLAlchemy, defaulting to a local SQLite database and scaling to PostgreSQL in production environments.
*   **🛡️ Production-Grade Middleware**: Client-side IP sliding-window rate limiting (100 requests/minute) protecting backend endpoints from automated query loops.
*   **🤖 CI/CD Sustainability Gates**: Integrate deployment gates checking threshold criteria in release processes using custom scripts and CLI rules.

---

## 🚀 Quick Start

### 1. Local Development (SQLite)

Ensure Python 3.9+ and Node.js 18+ are configured locally.

#### Start Backend API
```bash
# Install dependencies
pip3 install -r requirements.txt

# Start local FastAPI web server
uvicorn api.main:app --reload --port 8080
```
> [!NOTE]
> On startup, HydraWatch checks for a `DATABASE_URL` env variable. If not found, it automatically initializes and seeds tables in a local SQLite file: `data/hydrawatch.db`.

#### Start Frontend UI
```bash
cd frontend

# Install node dependencies
npm install

# Launch Vite dev server with Hot Module Replacement (HMR)
npm run dev
```
*   Dev server running at: **`http://localhost:5173`** (proxies `/api` queries to port `8080` backend).

---

### 2. Standalone Production Mode
Serve the compiled React static files directly from the FastAPI server:

```bash
# 1. Compile frontend distribution files
npm --prefix frontend run build

# 2. Run backend (FastAPI serves static app files from frontend/dist)
uvicorn api.main:app --port 8080
```
*   Access the standalone portal at: **`http://localhost:8080`**

---

## 🐳 Docker Orchestration

Launch the fully containerized application mapped to a PostgreSQL persistent volume in a single command:

```bash
docker compose up --build
```
*   Web application running at: **`http://localhost:8080`**
*   PostgreSQL running internally on port `5432` with shared docker volume persistence.

---

## ⚙️ Configuration Variables

Add variables in your local `.env` file or cloud configuration panel:

| Environment Variable | Description | Fallback Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | SQLAlchemy connection string (e.g. `postgresql://...`) | `sqlite:///data/hydrawatch.db` |
| `GOOGLE_MAPS_API_KEY` | Optional. Key to resolve geocoding coordinates. | Fallback to OpenStreetMap Nominatim |
| `ELECTRICITY_MAPS_API_KEY` | Optional. Key to query live regional grid carbon metrics. | Fallback to static grid models (2023) |
| `CORS_ALLOWED_ORIGINS` | Permitted origins for REST queries (comma-separated list). | `*` (All origins allowed) |
| `LOG_LEVEL` | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`). | `INFO` |

---

## 🛠️ Developer APIs & CLI

<details>
<summary><b>📖 Click to expand REST API Endpoints</b></summary>

| Route | Method | Payload / Params | Response Description |
| :--- | :--- | :--- | :--- |
| `/api` | `GET` | None | API health status, version index, and provider lists. |
| `/api/meta` | `GET` | None | Lists configurations (models, scenario guidelines, and GPU specs). |
| `/api/regions` | `GET` | `?provider=AWS` (optional) | Returns cloud datacenters with sustainability stress stats. |
| `/api/regions/map` | `GET` | None | Map points for globe positioning with scores and carbon bands. |
| `/api/geocode` | `GET` | `?q=Mumbai` | Geocoding lookup coordinates (cached in database). |
| `/api/analyze` | `POST` | `AnalyzeRequest` (JSON) | Footprint computation for multi-cloud alternatives. |
| `/api/estimates` | `POST` | Config state (JSON) | Saves estimator configuration. Returns a short UUID token. |
| `/api/estimates/{id}` | `GET` | Estimate ID (path) | Retrieves a saved estimator state. |
| `/sitemap.xml` | `GET` | None | Dynamic XML sitemap linking all pages and shared estimates. |
| `/api/gate` | `POST` | Deployment threshold | CI/CD sustainability gating validator. |

</details>

<details>
<summary><b>💻 Click to expand CLI Commands</b></summary>

Execute sustainability queries directly inside terminal environments:

```bash
# 1. CI/CD Gating Validation (fails build if threshold scoring not met)
python3 run.py gate --region eu-north-1 --min-score 50

# 2. Workload Footprint Analysis
python3 run.py analyze --region ap-south-1 --qps 120 --avg-tokens 1000

# 3. Model Accuracy Data Validation
python3 run.py validate-all
```

</details>

---

## ☁️ Deployment Guide (Render)

To host your app globally with auto-synchronized database tables:

1.  Create a **PostgreSQL Database** on Render. Copy the **Internal Database URL**.
2.  Create a new **Web Service** on Render and connect your repository (`Gillcharu/HYDRA-WATCH`).
3.  Set the following properties:
    *   **Runtime**: `Docker`
    *   **Dockerfile Path**: `Dockerfile` (default)
4.  Add the environment variables in your environment panel:
    *   `DATABASE_URL` = (Paste your PostgreSQL connection string)
5.  Click **Deploy Web Service**. Render compiles the frontend, initializes database schemas, and deploys to a public HTTPS url (e.g. `https://hydrawatch.onrender.com`).

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
