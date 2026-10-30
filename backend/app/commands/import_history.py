"""Import a bounded historical range with explicit progress and exit status."""

import argparse
import json
from datetime import date

import httpx

from app.db.session import get_engine
from app.games.definitions import GAMES
from app.ingestion.fetcher import configured_fetcher
from app.ingestion.service import IngestionService


def main() -> int:
    parser = argparse.ArgumentParser(description="Import official Vietlott historical draws")
    parser.add_argument("--game", required=True, choices=list(GAMES))
    parser.add_argument("--start-id")
    parser.add_argument("--end-id")
    parser.add_argument("--from-date", type=date.fromisoformat)
    parser.add_argument("--to-date", type=date.fromisoformat)
    parser.add_argument("--recheck", action="store_true")
    parser.add_argument(
        "--results-only", action="store_true", help="Skip parsing and storing prize snapshots"
    )
    parser.add_argument(
        "--workers",
        type=int,
        choices=(1, 2, 3),
        default=3,
        help="Concurrent history requests; use 1 for strictly sequential import",
    )
    args = parser.parse_args()
    with httpx.Client(follow_redirects=True) as client:
        summary = IngestionService(
            get_engine(),
            configured_fetcher(client),
            import_workers=args.workers,
            include_prizes=not args.results_only,
            progress=lambda sequence, counts: print(
                json.dumps({"draw_seq": sequence, "counters": counts}), flush=True
            ),
        ).import_history(
            args.game,
            start_id=args.start_id,
            end_id=args.end_id,
            from_date=args.from_date,
            to_date=args.to_date,
            recheck=args.recheck,
        )
    print(
        json.dumps(
            {
                "run_id": summary.run_id,
                "game": summary.game,
                "status": summary.status,
                "counters": summary.counters,
            }
        )
    )
    return 0 if summary.status == "success" else 1


if __name__ == "__main__":
    raise SystemExit(main())
