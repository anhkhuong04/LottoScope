"""Apply one reviewed source correction without automatic overwrite."""

import argparse
import sys

from app.db.session import session_scope
from app.repositories.draws import DrawRepository


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply a reviewed draw correction")
    parser.add_argument("correction_id", type=int)
    parser.add_argument("--reason", required=True, help="Reason for accepting the source change")
    args = parser.parse_args()
    with session_scope() as session:
        draw = DrawRepository(session).apply_correction(args.correction_id, reason=args.reason)
    sys.stdout.write(f"Applied correction {args.correction_id} to {draw.game}/{draw.draw_id}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
