from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
import json
import os
import subprocess
import sys
import uuid
from urllib.parse import parse_qs, unquote, urlparse

current_dir = os.path.dirname(__file__)
project_dir = os.path.dirname(current_dir)
if current_dir not in sys.path:
    sys.path.append(current_dir)
if project_dir not in sys.path:
    sys.path.append(project_dir)

from _auth import is_authorized, send_unauthorized
from test_runner.constants import SUPPORTED_SUITES
from test_runner.storage import (
    artifact_content_type,
    create_run,
    list_runs,
    read_status,
    resolve_artifact_path,
    run_record,
    tail_logs,
    update_status,
)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _active_run() -> dict | None:
    for run in list_runs(limit=500):
        if run.get("status") in {"queued", "running"}:
            return run
    return None


def _start_background_run(run_id: str, suite: str, base_url: str | None) -> None:
    command = [sys.executable, "-m", "test_runner.local_runner", run_id, suite]
    if base_url:
        command.append(base_url)

    kwargs = {
        "cwd": project_dir,
        "stdout": subprocess.DEVNULL,
        "stderr": subprocess.DEVNULL,
    }
    if os.name != "nt":
        kwargs["start_new_session"] = True

    subprocess.Popen(command, **kwargs)


class handler(BaseHTTPRequestHandler):
    def _send_json(self, payload, status_code=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, file_path):
        data = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", artifact_content_type(file_path))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Disposition", f'attachment; filename="{file_path.name}"')
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path.rstrip("/") != "/api/test-runs":
            self._send_json({"error": "Not found"}, status_code=404)
            return

        try:
            if not is_authorized(self.headers):
                send_unauthorized(self)
                return

            content_length = int(self.headers.get("Content-Length", 0))
            raw_body = self.rfile.read(content_length).decode("utf-8") if content_length else "{}"
            payload = json.loads(raw_body or "{}")

            suite = payload.get("suite")
            base_url = payload.get("baseUrl")
            if not suite:
                self._send_json({"error": "suite is required"}, status_code=400)
                return
            if suite not in SUPPORTED_SUITES:
                supported = ", ".join(sorted(SUPPORTED_SUITES))
                self._send_json(
                    {"error": f"Unsupported suite '{suite}'. Supported suites: {supported}"},
                    status_code=400,
                )
                return

            active = _active_run()
            if active:
                self._send_json(
                    {
                        "error": "A test run is already active",
                        "message": f"Run {active['run_id']} is currently {active['status']}",
                        "active_run_id": active["run_id"],
                    },
                    status_code=409,
                )
                return

            run_id = str(uuid.uuid4())
            create_run(run_id=run_id, suite=suite, base_url=base_url)
            _start_background_run(run_id, suite, base_url)

            self._send_json({"run_id": run_id, "status": "queued"}, status_code=200)
        except json.JSONDecodeError:
            self._send_json({"error": "Invalid JSON body"}, status_code=400)
        except Exception as exc:
            run_id = locals().get("run_id")
            if run_id:
                update_status(
                    run_id,
                    status="failed",
                    finished_at=_utc_now_iso(),
                    message=f"Failed to start run: {exc}",
                )
            self._send_json({"error": str(exc)}, status_code=500)

    def do_GET(self):
        try:
            if not is_authorized(self.headers):
                send_unauthorized(self)
                return

            parsed = urlparse(self.path)
            query = parse_qs(parsed.query or "")
            parts = [part for part in parsed.path.split("/") if part]

            if len(parts) < 2 or parts[0] != "api" or parts[1] != "test-runs":
                self._send_json({"error": "Not found"}, status_code=404)
                return

            if len(parts) == 2:
                limit_raw = query.get("limit", ["10"])[0]
                try:
                    limit = max(1, min(100, int(limit_raw)))
                except Exception:
                    limit = 10
                self._send_json(list_runs(limit=limit), status_code=200)
                return

            run_id = parts[2]
            status_payload = read_status(run_id)
            if not status_payload:
                raise FileNotFoundError(f"Run {run_id} bestaat niet")

            if len(parts) == 3:
                self._send_json(run_record(run_id, include_details=True), status_code=200)
                return

            if len(parts) == 4 and parts[3] == "logs":
                lines_raw = query.get("lines", ["300"])[0]
                try:
                    lines = max(1, min(2000, int(lines_raw)))
                except Exception:
                    lines = 300
                self._send_json({"run_id": run_id, "logs": tail_logs(run_id, lines=lines)}, status_code=200)
                return

            if len(parts) >= 5 and parts[3] == "artifacts":
                relative_path = unquote("/".join(parts[4:]))
                artifact = resolve_artifact_path(run_id, relative_path)
                self._send_file(artifact)
                return

            self._send_json({"error": "Not found"}, status_code=404)
        except FileNotFoundError as exc:
            self._send_json({"error": str(exc)}, status_code=404)
        except ValueError as exc:
            self._send_json({"error": str(exc)}, status_code=400)
        except Exception as exc:
            self._send_json({"error": str(exc)}, status_code=500)
