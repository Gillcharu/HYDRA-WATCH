# Contributing To HydraWatch

Thanks for taking a look at HydraWatch.

## Local Setup

```bash
python3 -m pip install -r requirements.txt
cd frontend
npm install
```

Run the backend:

```bash
python3 -m uvicorn api.main:app --reload --port 8080
```

Run the frontend:

```bash
cd frontend
npm run dev
```

## Checks

Before opening a pull request:

```bash
python3 -m pytest tests/ -v
cd frontend
npm run build
```

## Data And Claims

HydraWatch uses modeled estimates. Please avoid adding exact-sounding sustainability claims unless they are supported by documented methodology, source links, and uncertainty handling.

## Pull Request Guidance

- Keep changes focused.
- Update README/docs when behavior changes.
- Do not commit secrets, API keys, local databases, build outputs, or dependency folders.
