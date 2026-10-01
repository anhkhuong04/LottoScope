"""Import a bounded historical range with explicit progress and exit status."""

import argparse
import json
from datetime import date

import httpx

from app.db.session import get_engine
from app.ingestion.fetcher import VietlottFetcher
from app.ingestion.service import IngestionService


def main() -> int:
    parser = argparse.ArgumentParser(description="Import official Vietlott historical draws")
    parser.add_argument("--game", required=True, choices=["lotto_535", "mega_645"])
    parser.add_argument("--start-id")
    parser.add_argument("--end-id")
    parser.add_argument("--from-date", type=date.fromisoformat)
    parser.add_argument("--to-date", type=date.fromisoformat)
    parser.add_argument("--recheck", action="store_true")
    args = parser.parse_args()
    with httpx.Client(follow_redirects=True) as client:
        summary = IngestionService(
            get_engine(),
            VietlottFetcher(client),
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
