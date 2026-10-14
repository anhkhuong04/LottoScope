"""Run one collector cycle via the same ingestion service as the scheduler."""

import argparse
import json

import httpx

from app.db.session import get_engine
from app.games.definitions import GAMES
from app.ingestion.fetcher import configured_fetcher
from app.ingestion.service import IngestionService


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect new and recent official draws")
    parser.add_argument("--game", required=True, choices=list(GAMES))
    args = parser.parse_args()
    with httpx.Client(follow_redirects=True) as client:
        summary = IngestionService(get_engine(), configured_fetcher(client)).collect(args.game)
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
