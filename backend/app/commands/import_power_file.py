"""Validate/import the user's dated Power table and report remaining stored-ID gaps."""

import argparse
import json
from dataclasses import asdict
from pathlib import Path

from app.db.session import get_engine
from app.ingestion.power_file import import_power_file, load_power_file, missing_power_ids


def main() -> int:
    parser = argparse.ArgumentParser(description="Import Power results from a dated Markdown table")
    parser.add_argument("--file", type=Path, required=True)
    parser.add_argument("--dry-run", action="store_true", help="Validate file only; no DB writes")
    args = parser.parse_args()
    file = load_power_file(args.file)
    if args.dry_run:
        print(
            json.dumps(
                {
                    "rows": len(file.draws),
                    "sha256": file.sha256,
                    "first": file.draws[0].draw_id,
                    "last": file.draws[-1].draw_id,
                }
            )
        )
        return 0
    engine = get_engine()
    summary = import_power_file(engine, file)
    print(
        json.dumps(
            {"summary": asdict(summary), "missing_ids_to_stored_latest": missing_power_ids(engine)}
        )
    )
    return 0 if summary.status == "success" else 1


if __name__ == "__main__":
    raise SystemExit(main())
