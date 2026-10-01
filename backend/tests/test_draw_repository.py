"""PostgreSQL integration tests on a dedicated, disposable database."""

import os
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import UTC, date, datetime
from urllib.parse import urlsplit

import pytest
from sqlalchemy import create_engine, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.domain.draw import Draw
from app.games.definitions import DomainValidationError
from app.models.draw import DrawCorrectionRow, DrawRow, GameDataStateRow
from app.repositories.draws import CorrectionError, DrawRepository


@pytest.fixture(scope="module")
def engine():
    url = os.getenv("LOTTO_TEST_DATABASE_URL", "")
    if not url or not urlsplit(url).path.endswith("_test"):
        pytest.fail("LOTTO_TEST_DATABASE_URL must point to a dedicated *_test database")
    db_engine = create_engine(url)
    with db_engine.connect() as connection:
        assert connection.dialect.name == "postgresql"
        assert (
            connection.scalar(text("SELECT version_num FROM alembic_version"))
            == "0003_ingestion_tracking"
        )
    yield db_engine
    db_engine.dispose()


@pytest.fixture(autouse=True)
def clean_tables(request: pytest.FixtureRequest) -> None:
    if request.node.get_closest_marker("integration") is None:
        return
    db_engine = request.getfixturevalue("engine")
    with db_engine.begin() as connection:
        connection.execute(
            text(
                "TRUNCATE ingestion_items, ingestion_runs, ingestion_checkpoints, "
                "draw_corrections, draws, game_data_state RESTART IDENTITY"
            )
        )


def sample(
    draw_id: str = "00001", *, game: str = "lotto_535", day: int = 1, first: int = 1
) -> Draw:
    count = 5 if game == "lotto_535" else 6
    return Draw(
        game=game,
        draw_id=draw_id,
        draw_date=date(2026, 1, day),
        draw_time=None,
        main_numbers=tuple(range(first, first + count)),
        special_number=12 if game == "lotto_535" else None,
        source_url=f"https://example.test/{game}/{draw_id}",
        source_retrieved_at=datetime(2026, 1, day, tzinfo=UTC),
    )


@pytest.mark.integration
def test_insert_query_order_filters_and_game_isolation(engine) -> None:
    with Session(engine) as session, session.begin():
        repo = DrawRepository(session)
        assert repo.latest("lotto_535") is None
        assert repo.latest_n("lotto_535", 3) == ()
        assert repo.list_draws("lotto_535").total == 0
        for draw in (
            sample("00001", day=1),
            sample("00002", day=2),
            sample("00003", day=2),
            sample("00001", game="mega_645", day=1),
        ):
            assert repo.add(draw).status == "created"
        assert repo.get_by_id("lotto_535", "00002") == sample("00002", day=2)
        assert repo.get_by_id("lotto_535", "00004") is None
        assert repo.latest("lotto_535") == sample("00003", day=2)
        assert [d.draw_id for d in repo.latest_n("lotto_535", 10)] == ["00003", "00002", "00001"]
        assert [d.draw_id for d in repo.list_draws("lotto_535", page_size=2).items] == [
            "00003",
            "00002",
        ]
        assert [d.draw_id for d in repo.list_draws("lotto_535", page=2, page_size=2).items] == [
            "00001"
        ]
        assert [d.draw_id for d in repo.list_draws("lotto_535", sort="asc").items] == [
            "00001",
            "00002",
            "00003",
        ]
        assert repo.list_draws("lotto_535", from_date=date(2026, 1, 2)).total == 2
        assert repo.list_draws("lotto_535", to_date=date(2026, 1, 2)).total == 3
        assert repo.list_draws("lotto_535", draw_id="00002").total == 1
        assert repo.list_draws("mega_645").total == 1
        assert session.get(GameDataStateRow, "lotto_535").version == 3


@pytest.mark.integration
def test_invalid_filters_and_chronology(engine) -> None:
    with Session(engine) as session, session.begin():
        repo = DrawRepository(session)
        repo.add(sample("00001", day=1))
        repo.add(sample("00003", day=3))
        with pytest.raises(DomainValidationError, match="draw_date"):
            repo.add(sample("00002", day=4))
        for kwargs in (
            {"from_date": date(2026, 2, 1), "to_date": date(2026, 1, 1)},
            {"page": 0},
            {"page_size": 101},
            {"sort": "random"},
            {"draw_id": "2"},
        ):
            with pytest.raises(DomainValidationError):
                repo.list_draws("lotto_535", **kwargs)
        with pytest.raises(DomainValidationError):
            repo.latest_n("lotto_535", 0)


@pytest.mark.integration
def test_correction_is_explicit_audited_and_atomic(engine) -> None:
    original = sample()
    changed = replace(original, main_numbers=(2, 3, 4, 5, 6))
    with Session(engine) as session, session.begin():
        repo = DrawRepository(session)
        first = repo.add(original)
        assert first.status == "created"
        assert (
            repo.add(replace(original, source_url="https://example.test/mirror")).status
            == "unchanged"
        )
        conflict = repo.add(changed)
        assert conflict.status == "conflict"
        assert repo.add(changed).correction_id == conflict.correction_id
        assert repo.get_by_id("lotto_535", "00001") == original
        assert session.get(GameDataStateRow, "lotto_535").version == 1
        assert (
            session.scalar(
                select(DrawCorrectionRow).where(DrawCorrectionRow.id == conflict.correction_id)
            ).status
            == "pending"
        )
    with Session(engine) as session, session.begin():
        repo = DrawRepository(session)
        with pytest.raises(CorrectionError, match="reason"):
            repo.apply_correction(conflict.correction_id, reason=" ")
        assert (
            repo.apply_correction(conflict.correction_id, reason="Verified source page") == changed
        )
        assert repo.get_by_id("lotto_535", "00001") == changed
        audit = session.get(DrawCorrectionRow, conflict.correction_id)
        assert audit.status == "applied"
        assert audit.old_payload == original.canonical_payload()
        assert audit.new_payload == changed.canonical_payload()
        assert audit.resolution_note == "Verified source page"
        assert audit.applied_at is not None
        assert session.get(GameDataStateRow, "lotto_535").version == 2
        with pytest.raises(CorrectionError, match="not pending"):
            repo.apply_correction(conflict.correction_id, reason="again")


@pytest.mark.integration
def test_stale_and_invalid_date_corrections_do_not_overwrite(engine) -> None:
    with Session(engine) as session, session.begin():
        repo = DrawRepository(session)
        repo.add(sample("00001", day=1))
        repo.add(sample("00002", day=2))
        first = repo.add(sample("00001", day=1, first=2)).correction_id
        stale = repo.add(sample("00001", day=1, first=3)).correction_id
        wrong_date = repo.add(sample("00001", day=3)).correction_id
        assert first is not None and stale is not None and wrong_date is not None
        with pytest.raises(DomainValidationError, match="draw_date"):
            repo.apply_correction(wrong_date, reason="date verified")
        assert repo.get_by_id("lotto_535", "00001") == sample("00001", day=1)
        repo.apply_correction(first, reason="verified")
        with pytest.raises(CorrectionError, match="stale"):
            repo.apply_correction(stale, reason="verified")
        assert session.get(DrawCorrectionRow, stale).status == "pending"
        assert session.get(GameDataStateRow, "lotto_535").version == 3


@pytest.mark.integration
def test_correction_rollback_preserves_draw_audit_and_version(engine) -> None:
    with Session(engine) as session, session.begin():
        repo = DrawRepository(session)
        repo.add(sample())
        correction_id = repo.add(sample(first=2)).correction_id
    assert correction_id is not None
    with pytest.raises(RuntimeError):
        with Session(engine) as session, session.begin():
            DrawRepository(session).apply_correction(correction_id, reason="reviewed")
            raise RuntimeError("abort transaction")
    with Session(engine) as session:
        assert DrawRepository(session).get_by_id("lotto_535", "00001") == sample()
        assert session.get(DrawCorrectionRow, correction_id).status == "pending"
        assert session.get(GameDataStateRow, "lotto_535").version == 1


@pytest.mark.integration
def test_rollback_and_database_constraints(engine) -> None:
    original = sample()
    with pytest.raises(RuntimeError):
        with Session(engine) as session, session.begin():
            DrawRepository(session).add(original)
            raise RuntimeError("abort transaction")
    with Session(engine) as session, session.begin():
        assert DrawRepository(session).get_by_id(original.game, original.draw_id) is None
        DrawRepository(session).add(original)
    with pytest.raises(IntegrityError):
        with Session(engine) as session, session.begin():
            row = session.scalar(select(DrawRow).where(DrawRow.draw_id == "00001"))
            session.add(
                DrawRow(
                    game=row.game,
                    draw_id=row.draw_id,
                    draw_seq=row.draw_seq,
                    draw_date=row.draw_date,
                    draw_time=row.draw_time,
                    main_numbers=row.main_numbers,
                    special_number=row.special_number,
                    source_url=row.source_url,
                    source_retrieved_at=row.source_retrieved_at,
                    source_sha256=row.source_sha256,
                )
            )
    with Session(engine) as session:
        assert session.scalar(select(DrawRow).where(DrawRow.game == "lotto_535")) is not None
        assert session.get(GameDataStateRow, "lotto_535").version == 1
    with pytest.raises(IntegrityError):
        with Session(engine) as session, session.begin():
            row = session.scalar(select(DrawRow).where(DrawRow.draw_id == "00001"))
            row.draw_seq = 9
            session.flush()
    with pytest.raises(IntegrityError):
        with Session(engine) as session, session.begin():
            row = session.scalar(select(DrawRow).where(DrawRow.draw_id == "00001"))
            row.main_numbers = [1, 2]
            session.flush()


@pytest.mark.integration
def test_concurrent_same_draw_has_one_insert(engine) -> None:
    def insert_once() -> str:
        with Session(engine) as session, session.begin():
            return DrawRepository(session).add(sample()).status

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(lambda _: insert_once(), range(2)))
    assert sorted(statuses) == ["created", "unchanged"]
    with Session(engine) as session:
        assert session.scalar(select(GameDataStateRow.version)) == 1
        assert len(session.scalars(select(DrawRow)).all()) == 1
