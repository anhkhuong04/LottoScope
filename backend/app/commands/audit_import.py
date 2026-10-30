"""Audit complete historical coverage and compare deterministic source samples."""

import argparse
import json
from dataclasses import asdict

import httpx

from app.db.session import get_engine
from app.games.definitions import GAMES
from app.ingestion.audit import audit_history
from app.ingestion.fetcher import configured_fetcher


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit official historical import")
    parser.add_argument("--game", required=True, choices=list(GAMES))
    args = parser.parse_args()
    with httpx.Client(follow_redirects=True) as client:
        report = audit_history(get_engine(), configured_fetcher(client), args.game)
    print(json.dumps(asdict(report), default=str))
    return 0 if report.complete else 1


if __name__ == "__main__":
    raise SystemExit(main())
