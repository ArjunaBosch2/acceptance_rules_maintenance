# Insurance Acceptance Rules

## Running the Test Runner

### 1) Start Redis

```bash
docker compose up -d redis
```

### 2) Install Python dependencies + Playwright browser

```bash
python -m pip install -r requirements.txt
python -m playwright install chromium
```

### 3) Start backend API

```bash
npm run backend:dev
```

### 4) Start RQ worker

```bash
npm run worker
```

### 5) Start frontend

```bash
npm run dev
```

Frontend runs on Vite, backend is expected on `http://localhost:8000` (already configured in `vite.config.js`).

### Optional environment variables

Set these when the internal app shows a login screen:

```bash
# PowerShell
$env:TOOLBOX_TEST_USERNAME="your-username"
$env:TOOLBOX_TEST_PASSWORD="your-password"
```

Optional overrides:

```bash
$env:REDIS_URL="redis://localhost:6379/0"
$env:TEST_RUNS_DIR="C:\path\to\runs"
$env:TOOLBOX_TEST_HEADLESS="1"
```

### API contract

- `POST /api/test-runs`
  - body: `{ "suite": "avp_scenario", "baseUrl": "optional" }`
  - response: `{ "run_id": "<uuid>", "status": "queued" }`
- `GET /api/test-runs?limit=10`
- `GET /api/test-runs/{run_id}`
- `GET /api/test-runs/{run_id}/logs`
- `GET /api/test-runs/{run_id}/artifacts/{path}`

Artifacts and status are stored under:

```text
runs/<run_id>/
  status.json
  summary.json
  report.html
  trace.zip
  videos/
  screenshots/
  logs.txt
```

### Full stack via Docker compose

```bash
docker compose up --build backend worker redis
```
