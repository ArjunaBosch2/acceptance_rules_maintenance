# Insurance Acceptance Rules

## Running the Test Runner (Simple Mode)

Simple mode starts tests directly as a background process from the backend.
No Redis or external worker is required.

### 1) Install dependencies

```bash
python -m pip install -r requirements.txt
python -m pip install -r requirements-worker.txt
python -m playwright install chromium
```

### 2) Start backend API

```bash
npm run backend:dev
```

### 3) Start frontend

```bash
npm run dev
```

Frontend runs on Vite, backend is expected on `http://localhost:8000` (configured in `vite.config.js`).

### Optional environment variables

Set these when the internal app shows a login screen:

```bash
# PowerShell
$env:TOOLBOX_TEST_USERNAME="your-username"
$env:TOOLBOX_TEST_PASSWORD="your-password"
```

Optional overrides:

```bash
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

## Notes

- Concurrency limit is still enforced: max 1 active run (`queued`/`running`) at a time.
- Vercel serverless is not recommended for this simple mode because background test processes are not reliable in serverless runtime.
- Recommended deployment for simple mode: one persistent backend host (VM/container).
