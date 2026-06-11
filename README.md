# 💧 HydraWatch

**Global AI Infrastructure Sustainability Platform** — Analyze, optimize, and verify AI workload carbon emissions, power grids, and water stress intensity across 121 cloud regions worldwide before deployment.

---

## 🌟 Key Features

*   **Multi-Cloud Coverage**: 121 global data center regions spanning AWS, Google Cloud, Microsoft Azure, Oracle Cloud (OCI), Alibaba Cloud, IBM Cloud, and DigitalOcean.
*   **3D Interactive Globe**: Rich Canvas-based interactive sphere showcasing live grid sustainability scores, water scarcity stress index, and carbon bands.
*   **Personal AI Use Estimator**: Modeled calculation engine detailing energy consumption (Wh), direct/indirect water use (L), and carbon footprint (g CO₂e) per query with standard LED bulb, distance driven, and running tap equivalencies.
*   **A/B Comparison Mode**: Side-by-side calculation comparator with dynamic Recharts visualization tooltips and percentage difference calculators.
*   **Database Persistence**: Fully persisted geocoding cache tables and saved configuration short links (`/e/:id`) using SQLAlchemy (supporting auto-provisioned PostgreSQL in production and local SQLite fallback out-of-the-box).
*   **API Security & Infrastructure**: Client IP sliding window rate limiting (100 req/min) protecting backend resources, Google Maps Geocoding API compatibility, and dynamic search engine indexable `/sitemap.xml` SEO generation.
*   **Sustainability Gates**: Custom CLI commands and POST endpoints to evaluate environment sustainability score thresholds in CI/CD deployment workflows.

---

## 🏗️ Architecture Stack

*   **Frontend**: React (TypeScript) + Vite + TailwindCSS + Recharts + Framer Motion.
*   **Backend**: FastAPI (Python) + Uvicorn + SQLAlchemy.
*   **Database**: PostgreSQL (Production) / SQLite `data/hydrawatch.db` (Local Fallback).
*   **Containerization**: Multi-stage `Dockerfile` (React build + Python serve) and `docker-compose.yml`.

---

## 🚀 Getting Started

### 1. Local Development (SQLite Database)

Ensure Python 3.9+ and Node.js 18+ are installed.

#### Start the Backend Server:
```bash
# Install dependencies
pip3 install -r requirements.txt

# Run the Uvicorn application (defaults to SQLite data/hydrawatch.db)
uvicorn api.main:app --reload --port 8080
```
*   API Docs will be available at: **`http://localhost:8080/docs`**

#### Start the Frontend Web App:
```bash
cd frontend

# Install packages
npm install

# Start Vite dev server with Hot Module Replacement (HMR)
npm run dev
```
*   Vite dev server runs at: **`http://localhost:5173`** (automatically proxies `/api` calls to port `8080`).

---

### 2. Running the Production Build Locally
To verify the final compiled bundles exactly as they are served in production:

```bash
# 1. Compile frontend assets into static files
npm --prefix frontend run build

# 2. Start Uvicorn backend (FastAPI mounts and serves static files from frontend/dist)
uvicorn api.main:app --port 8080
```
*   Visit: **`http://localhost:8080`**

---

### 3. Running with Docker Compose
Launches the web application container linked to a dedicated PostgreSQL database container with mapped data volumes.

```bash
# Build images and run services
docker compose up --build
```
*   Web server runs on: **`http://localhost:8080`**
*   PostgreSQL service runs internally on port `5432` with automatic credentials mapping.

---

## 🛠️ Configuration & Environment Variables

Create a `.env` file in the root directory or declare variables directly in your deployment provider:

| Variable | Description | Default / Fallback |
| :--- | :--- | :--- |
| `DATABASE_URL` | SQLAlchemy connection string (PostgreSQL or connection string) | SQLite (`sqlite:///data/hydrawatch.db`) |
| `GOOGLE_MAPS_API_KEY` | Optional key to query Google Geocoding services | Nominatim OpenStreetMap API |
| `ELECTRICITY_MAPS_API_KEY` | Optional key to query live grid carbon intensity APIs | Static regional grid patterns |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of browser origins permitted to query the API | `*` (All) |
| `LOG_LEVEL` | Level of logging output (`DEBUG`, `INFO`, `WARNING`, `ERROR`) | `INFO` |

---

## 📈 REST API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api` | `GET` | Health check, services, version info. |
| `/api/meta` | `GET` | Retrieve allowed providers, scenarios, GPUs, and models. |
| `/api/regions` | `GET` | List data center metrics (optionally filter by `?provider=AWS`). |
| `/api/regions/map` | `GET` | Fetch coordinates, carbon metrics, and scores for globe rendering. |
| `/api/geocode?q={query}` | `GET` | Geocoding resolution (cached in database). |
| `/api/analyze` | `POST` | Core sustainability footprint analyzer for multi-cloud alternatives. |
| `/api/estimates` | `POST` | Save a specific Personal Estimator configuration. Returns a unique short ID. |
| `/api/estimates/{id}` | `GET` | Retrieve a saved personal estimator state configuration. |
| `/sitemap.xml` | `GET` | Dynamic XML sitemap containing all site views and shared database URLs. |
| `/api/gate` | `POST` | Sustainability evaluation gateway for CI/CD gates. |

---

## 🤖 Command Line Interface (CLI)

Evaluate sustainability targets directly in your build shell:

```bash
# 1. Run local sustainability gate check
python3 run.py gate --region eu-north-1 --min-score 50

# 2. View specific regional footprint calculations
python3 run.py analyze --region ap-south-1 --qps 100

# 3. Output structural validation stats
python3 run.py validate-all
```

---

## ☁️ Production Deployment (e.g., Render)

To launch the application globally using [Render](https://render.com):

1.  Log in to Render and create a new **PostgreSQL Database** resource. Copy its **Internal Database URL**.
2.  Click **New > Web Service** and connect your GitHub repository.
3.  Set the following configuration:
    *   **Runtime**: `Docker`
    *   **Dockerfile Path**: `Dockerfile` (root folder)
4.  Add the **Environment Variables**:
    *   `DATABASE_URL` = (Paste your Render PostgreSQL connection string)
    *   `GOOGLE_MAPS_API_KEY` = (Your API key, optional)
    *   `ELECTRICITY_MAPS_API_KEY` = (Your API key, optional)
5.  Click **Deploy Web Service**. Render will build the container, start the database engine, and provision a public HTTPS URL.

---

## 📄 License

This project is licensed under the MIT License.
