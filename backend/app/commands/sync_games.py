"""One bounded pass across games; usable from the Windows local scheduler."""

import argparse
import logging

from app.jobs.collection import run_collections


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync latest draws for all games")
    parser.add_argument(
        "--recheck-recent",
        action="store_true",
        help="Also reconcile recent draws and a bounded historical backlog",
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    summaries = run_collections(recheck_recent=args.recheck_recent)
    return int(any(summary.status != "success" for summary in summaries))


if __name__ == "__main__":
    raise SystemExit(main())
