from pathlib import Path

RUNS_DIR_ENV = "TEST_RUNS_DIR"
REDIS_URL_ENV = "REDIS_URL"
QUEUE_NAME = "toolbox-test-runs"
ACTIVE_RUN_LOCK_KEY = "toolbox:test-runs:active"
ACTIVE_RUN_LOCK_TTL_SECONDS = 6 * 60 * 60
DEFAULT_LOG_TAIL_LINES = 300
SUPPORTED_SUITES = {"avp_scenario", "smoke"}
DEFAULT_DASHBOARD_URL = "https://adviseuracceptatie.private-insurance.eu/#/dashboard"


def project_root() -> Path:
    return Path(__file__).resolve().parent.parent
