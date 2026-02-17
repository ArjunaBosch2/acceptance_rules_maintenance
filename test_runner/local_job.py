import os
import subprocess
import sys
import traceback
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from .constants import DEFAULT_DASHBOARD_URL
from .storage import logs_path, run_dir, update_status, write_summary


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _zip_if_has_files(directory: Path, output_zip: Path) -> None:
    if not directory.exists() or not any(path.is_file() for path in directory.rglob("*")):
        return

    with ZipFile(output_zip, "w", compression=ZIP_DEFLATED) as archive:
        for file_path in sorted(directory.rglob("*")):
            if file_path.is_file():
                archive.write(file_path, arcname=file_path.relative_to(directory).as_posix())


def _parse_junit_summary(path: Path) -> dict[str, int]:
    if not path.exists():
        return {"total": 0, "passed": 0, "failed": 1, "skipped": 0}

    root = ET.parse(path).getroot()
    if root.tag == "testsuite":
        tests = int(root.attrib.get("tests", 0))
        failures = int(root.attrib.get("failures", 0))
        errors = int(root.attrib.get("errors", 0))
        skipped = int(root.attrib.get("skipped", 0))
    else:
        tests = failures = errors = skipped = 0
        for suite in root.findall("testsuite"):
            tests += int(suite.attrib.get("tests", 0))
            failures += int(suite.attrib.get("failures", 0))
            errors += int(suite.attrib.get("errors", 0))
            skipped += int(suite.attrib.get("skipped", 0))

    failed = failures + errors
    passed = max(0, tests - failed - skipped)
    return {
        "total": tests,
        "passed": passed,
        "failed": failed,
        "skipped": skipped,
    }


def execute_local_test_run(run_id: str, suite: str, base_url: str | None = None) -> dict:
    run_path = run_dir(run_id)
    run_path.mkdir(parents=True, exist_ok=True)
    log_file = logs_path(run_id)
    log_file.parent.mkdir(parents=True, exist_ok=True)

    update_status(run_id, status="running", started_at=_utc_now_iso(), message=None)

    junit_path = run_path / "junit.xml"
    html_path = run_path / "report.html"

    env = os.environ.copy()
    env.update(
        {
            "PYTHONUNBUFFERED": "1",
            "TOOLBOX_RUN_ID": run_id,
            "TOOLBOX_RUN_DIR": str(run_path),
            "TOOLBOX_TEST_BASE_URL": base_url or DEFAULT_DASHBOARD_URL,
            "TOOLBOX_TEST_SUITE": suite,
        }
    )

    command = [
        sys.executable,
        "-m",
        "pytest",
        "test_runner/tests/test_avp_scenario.py",
        "-m",
        suite,
        "-s",
        "--maxfail=1",
        "--disable-warnings",
        f"--html={html_path}",
        "--self-contained-html",
        f"--junitxml={junit_path}",
    ]

    return_code = 1
    status = "failed"
    message = "Run failed. Zie logs en artifacts voor details."
    return_payload = {
        "run_id": run_id,
        "status": status,
        "summary": {"total": 0, "passed": 0, "failed": 1, "skipped": 0},
    }

    try:
        with log_file.open("a", encoding="utf-8", errors="replace") as sink:
            sink.write(f"[{_utc_now_iso()}] Starting command: {' '.join(command)}\\n")
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=env,
                cwd=Path(__file__).resolve().parent.parent,
            )

            assert process.stdout is not None
            for line in process.stdout:
                sink.write(line)
                sink.flush()
                print(line, end="")

            return_code = process.wait()
            sink.write(f"[{_utc_now_iso()}] Pytest exited with code {return_code}\\n")
    except Exception:
        with log_file.open("a", encoding="utf-8", errors="replace") as sink:
            sink.write(f"[{_utc_now_iso()}] Runner crashed:\\n{traceback.format_exc()}\\n")
    finally:
        try:
            summary = _parse_junit_summary(junit_path)
        except Exception:
            summary = {"total": 0, "passed": 0, "failed": 1, "skipped": 0}

        write_summary(run_id, summary)
        _zip_if_has_files(run_path / "screenshots", run_path / "screenshots.zip")
        _zip_if_has_files(run_path / "videos", run_path / "videos.zip")

        if return_code == 0 and summary.get("failed", 0) == 0:
            status = "succeeded"
            message = "Run completed successfully"

        update_status(run_id, status=status, finished_at=_utc_now_iso(), message=message)
        return_payload = {
            "run_id": run_id,
            "status": status,
            "summary": summary,
        }

    return return_payload
