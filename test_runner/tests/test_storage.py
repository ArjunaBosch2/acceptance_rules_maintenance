from pathlib import Path

import pytest

from test_runner.storage import create_run, resolve_artifact_path, run_dir


def test_resolve_artifact_path_blocks_traversal(tmp_path, monkeypatch):
    monkeypatch.setenv("TEST_RUNS_DIR", str(tmp_path))
    create_run("abc", suite="avp_scenario", base_url=None)

    with pytest.raises(ValueError):
        resolve_artifact_path("abc", "../outside.txt")


def test_resolve_artifact_path_returns_file(tmp_path, monkeypatch):
    monkeypatch.setenv("TEST_RUNS_DIR", str(tmp_path))
    create_run("abc", suite="avp_scenario", base_url=None)

    artifact = run_dir("abc") / "report.html"
    artifact.write_text("ok", encoding="utf-8")

    resolved = resolve_artifact_path("abc", "report.html")
    assert resolved == artifact.resolve()
