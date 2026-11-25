"""Seed the isolated Playwright database with deterministic fixture data."""

from collections.abc import Iterator
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_engine
from app.domain.draw import Draw
from app.games.definitions import GAMES
from app.ingestion.sources import parse_result, result_url
from app.models.draw import DrawRow
from app.repositories.draws import DrawRepository

FIXTURES = Path(__file__).parent / "fixtures" / "vietlott"
RETRIEVED_AT = datetime(2026, 10, 10, tzinfo=UTC)
SEEDS = {
    "lotto_535": ("535_00922_prizes.html", 889, 921, date(2026, 9, 1)),
    "mega_645": ("645_01570_prizes.html", 1190, 1569, date(2025, 8, 1)),
    "power_655": ("655_00001_prizes.html", 2, 80, date(2017, 8, 3)),
}


def draws() -> Iterator[Draw]:
    for game, (filename, start, end, from_date) in SEEDS.items():
        definition = GAMES[game]
        draw_id = filename.split("_")[1]
        published = parse_result(
            (FIXTURES / filename).read_text(encoding="utf-8"),
            game=game,
            expected_id=draw_id,
            source_url=result_url(game, draw_id),
            retrieved_at=RETRIEVED_AT,
        )
        yield published
        for offset, sequence in enumerate(range(start, end + 1)):
            first = 1 + offset % (definition.main_max - definition.main_count + 1)
            main = tuple(range(first, first + definition.main_count))
            special = None
            if game == "lotto_535":
                special = 1 + offset % 12
            elif game == "power_655":
                special = 1 if first > 1 else 55
            yield Draw(
                game=game,
                draw_id=f"{sequence:05d}",
                draw_date=from_date + timedelta(days=offset // 2),
                draw_time=None,
                main_numbers=main,
                special_number=special,
                source_url=f"https://example.invalid/e2e/{game}/{sequence}",
                source_retrieved_at=RETRIEVED_AT,
                prizes=published.prizes,
            )


def main() -> None:
    engine = get_engine()
    if engine.url.database != "lottoscope_e2e_test":
        raise RuntimeError("Use an isolated database named lottoscope_e2e_test")
    with Session(engine) as session, session.begin():
        if session.scalar(select(DrawRow.id).limit(1)) is not None:
            raise RuntimeError("The E2E database must be empty")
        repo = DrawRepository(session)
        for draw in draws():
            repo.add(draw)


if __name__ == "__main__":
    main()
