import sys
import traceback

from .local_job import execute_local_test_run
from .storage import update_status, utc_now_iso


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: python -m test_runner.local_runner <run_id> <suite> [base_url]")
        return 2

    run_id = sys.argv[1]
    suite = sys.argv[2]
    base_url = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else None

    try:
        execute_local_test_run(run_id, suite, base_url)
        return 0
    except Exception as exc:
        update_status(
            run_id,
            status="failed",
            finished_at=utc_now_iso(),
            message=f"Runner crashed: {exc}",
        )
        print(traceback.format_exc())
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
