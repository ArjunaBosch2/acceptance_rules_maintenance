import json
import mimetypes
import os
import tempfile
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .constants import DEFAULT_LOG_TAIL_LINES, RUNS_DIR_ENV, project_root


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def runs_root() -> Path:
    configured = os.getenv(RUNS_DIR_ENV)
    if configured:
        root = Path(configured).expanduser().resolve()
    else:
        # Vercel/serverless file systems are read-only except temp dirs.
        if os.getenv("VERCEL") == "1":
            root = Path(tempfile.gettempdir()).resolve() / "runs"
        else:
            root = (project_root() / "runs").resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def run_dir(run_id: str) -> Path:
    return runs_root() / run_id


def status_path(run_id: str) -> Path:
    return run_dir(run_id) / "status.json"


def summary_path(run_id: str) -> Path:
    return run_dir(run_id) / "summary.json"


def logs_path(run_id: str) -> Path:
    return run_dir(run_id) / "logs.txt"


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    tmp.replace(path)


def _read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def create_run(run_id: str, suite: str, base_url: str | None) -> dict[str, Any]:
    directory = run_dir(run_id)
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "videos").mkdir(exist_ok=True)
    (directory / "screenshots").mkdir(exist_ok=True)
    logs_path(run_id).touch(exist_ok=True)

    status = {
        "run_id": run_id,
        "suite": suite,
        "base_url": base_url,
        "status": "queued",
        "queued_at": utc_now_iso(),
        "started_at": None,
        "finished_at": None,
        "message": None,
    }
    _write_json(status_path(run_id), status)
    _write_json(
        summary_path(run_id),
        {
            "run_id": run_id,
            "total": 0,
            "passed": 0,
            "failed": 0,
            "skipped": 0,
        },
    )
    return status


def update_status(run_id: str, **updates: Any) -> dict[str, Any]:
    current = _read_json(status_path(run_id))
    current.update(updates)
    current.setdefault("run_id", run_id)
    _write_json(status_path(run_id), current)
    return current


def write_summary(run_id: str, summary: dict[str, Any]) -> dict[str, Any]:
    current = _read_json(summary_path(run_id))
    current.update(summary)
    current.setdefault("run_id", run_id)
    _write_json(summary_path(run_id), current)
    return current


def read_status(run_id: str) -> dict[str, Any]:
    return _read_json(status_path(run_id))


def read_summary(run_id: str) -> dict[str, Any]:
    return _read_json(summary_path(run_id))


def is_terminal_status(status: str | None) -> bool:
    return status in {"succeeded", "failed"}


def artifact_manifest(run_id: str) -> list[dict[str, str]]:
    directory = run_dir(run_id)
    if not directory.exists():
        return []

    artifacts: list[dict[str, str]] = []
    for path in sorted(directory.rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(directory).as_posix()
        if relative in {"status.json", "summary.json", "logs.txt", "junit.xml"}:
            continue
        artifacts.append(
            {
                "name": path.name,
                "path": relative,
                "download_url": f"/api/test-runs/{run_id}/artifacts/{relative}",
            }
        )
    return artifacts


def run_record(run_id: str, include_details: bool = False) -> dict[str, Any]:
    status = read_status(run_id)
    summary = read_summary(run_id)
    record = {
        "run_id": run_id,
        "suite": status.get("suite"),
        "base_url": status.get("base_url"),
        "status": status.get("status", "queued"),
        "queued_at": status.get("queued_at"),
        "started_at": status.get("started_at"),
        "finished_at": status.get("finished_at"),
        "message": status.get("message"),
        "total": summary.get("total", 0),
        "passed": summary.get("passed", 0),
        "failed": summary.get("failed", 0),
        "skipped": summary.get("skipped", 0),
    }
    if include_details:
        record["summary"] = summary
    record["artifacts"] = artifact_manifest(run_id)
    return record


def _sort_key(run: dict[str, Any]) -> tuple[str, str]:
    primary = run.get("started_at") or run.get("queued_at") or ""
    secondary = run.get("run_id") or ""
    return primary, secondary


def list_runs(limit: int = 10) -> list[dict[str, Any]]:
    root = runs_root()
    results: list[dict[str, Any]] = []
    for directory in root.iterdir():
        if not directory.is_dir():
            continue
        status_file = directory / "status.json"
        if not status_file.exists():
            continue
        results.append(run_record(directory.name, include_details=False))

    results.sort(key=_sort_key, reverse=True)
    return results[: max(1, limit)]


def ensure_run_exists(run_id: str) -> Path:
    directory = run_dir(run_id)
    if not directory.exists():
        raise FileNotFoundError(f"Run {run_id} bestaat niet")
    return directory


def tail_logs(run_id: str, lines: int = DEFAULT_LOG_TAIL_LINES) -> str:
    path = logs_path(run_id)
    if not path.exists():
        return ""
    buffer = deque(maxlen=max(1, lines))
    with path.open("r", encoding="utf-8", errors="replace") as handle:
        for line in handle:
            buffer.append(line)
    return "".join(buffer)


def resolve_artifact_path(run_id: str, relative_path: str) -> Path:
    requested = Path(relative_path)
    if requested.is_absolute() or ".." in requested.parts:
        raise ValueError("Invalid artifact path")

    directory = ensure_run_exists(run_id).resolve()
    candidate = (directory / relative_path).resolve()
    if directory != candidate and directory not in candidate.parents:
        raise ValueError("Invalid artifact path")
    if not candidate.is_file():
        raise FileNotFoundError("Artifact not found")
    return candidate


def artifact_content_type(path: Path) -> str:
    guessed, _ = mimetypes.guess_type(path.name)
    return guessed or "application/octet-stream"
