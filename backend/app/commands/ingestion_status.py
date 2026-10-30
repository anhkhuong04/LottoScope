"""Inspect persisted ingestion freshness and unresolved source IDs."""

import argparse
import json
from dataclasses import asdict
from datetime import datetime

from app.db.session import get_engine
from app.games.definitions import GAMES
from app.ingestion.service import IngestionService


class _UnusedFetcher:
    def fetch(self, url: str) -> tuple[str, datetime]:
        raise RuntimeError(f"unexpected fetch for status: {url}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Read ingestion status for one game")
    parser.add_argument("--game", required=True, choices=list(GAMES))
    args = parser.parse_args()
    status = IngestionService(get_engine(), _UnusedFetcher()).status(args.game)
    print(json.dumps(asdict(status), default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
