"""Power PostgreSQL constraints and non-destructive migration on a dedicated test DB."""

from dataclasses import replace

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from test_draw_domain import power_draw
from test_draw_repository import clean_tables as clean_tables
from test_draw_repository import engine as engine
from test_draw_repository import sample

from app.core.config import get_settings
from app.domain.prizes import PrizeMatch, PrizeTier
from app.models.draw import DrawRow
from app.repositories.draws import DrawRepository

pytestmark = pytest.mark.integration


def test_power_repository_isolation_idempotency_and_special_correction(engine: Engine) -> None:
    power = power_draw()
    with Session(engine) as session, session.begin():
        repo = DrawRepository(session)
        for draw in (sample(), sample(game="mega_645"), power):
            assert repo.add(draw).status == "created"
        assert repo.add(power).status == "unchanged"
        assert repo.list_draws("power_655").total == 1
        assert repo.latest("power_655") == power
        assert repo.data_version("power_655") == 1
        changed = replace(power, special_number=55)
        conflict = repo.add(changed)
        assert conflict.status == "conflict"
        assert repo.get_by_id("power_655", "00001") == power
        assert repo.apply_correction(conflict.correction_id, reason="Fixture correction") == changed
        assert repo.data_version("power_655") == 2
        assert repo.data_version("mega_645") == 1


@pytest.mark.parametrize("special", [None, 0, 56, 5, 38])
def test_database_rejects_invalid_power_special(engine: Engine, special: int | None) -> None:
    with Session(engine) as session, session.begin():
        DrawRepository(session).add(power_draw())
    with pytest.raises(IntegrityError):
        with Session(engine) as session, session.begin():
            row = session.scalar(select(DrawRow))
            row.special_number = special
            session.flush()
    with Session(engine) as session:
        assert DrawRepository(session).get_by_id("power_655", "00001") == power_draw()


def _snapshot(engine: Engine) -> dict[str, list[object]]:
    tables = (
        "draws",
        "draw_corrections",
        "game_data_state",
        "ingestion_runs",
        "ingestion_items",
        "ingestion_checkpoints",
    )
    with engine.connect() as connection:
        return {
            table: list(
                connection.scalars(
                    text(f"SELECT to_jsonb(t) FROM {table} t ORDER BY to_jsonb(t)::text")
                )
            )
            for table in tables
        }


def _configure_migration(engine: Engine, monkeypatch: pytest.MonkeyPatch) -> Config:
    monkeypatch.setenv("LOTTO_DATABASE_URL", engine.url.render_as_string(hide_password=False))
    get_settings.cache_clear()
    return Config("alembic.ini")


def test_migration_keeps_legacy_results_prizes_hashes_versions_and_audit(
    engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    config = _configure_migration(engine, monkeypatch)
    command.downgrade(config, "0004_draw_prizes")
    try:
        with Session(engine) as session, session.begin():
            repo = DrawRepository(session)
            lotto = replace(
                sample(), prizes=(PrizeTier("Giải Nhất", (PrizeMatch(5, False),), 0, 10000000),)
            )
            repo.add(lotto)
            repo.add(sample(game="mega_645"))
            repo.add(replace(lotto, special_number=11))
        before = _snapshot(engine)
        command.upgrade(config, "head")
        assert _snapshot(engine) == before
        command.downgrade(config, "0004_draw_prizes")
        assert _snapshot(engine) == before
    finally:
        command.upgrade(config, "head")
        get_settings.cache_clear()


@pytest.mark.parametrize(
    "table",
    ["draws", "game_data_state", "ingestion_runs", "ingestion_checkpoints", "ingestion_items"],
)
def test_downgrade_refuses_power_rows_without_deleting_them(
    engine: Engine, monkeypatch: pytest.MonkeyPatch, table: str
) -> None:
    config = _configure_migration(engine, monkeypatch)
    with engine.begin() as connection:
        if table == "draws":
            with Session(bind=connection) as session:
                DrawRepository(session).add(power_draw())
                session.flush()
            connection.execute(text("DELETE FROM game_data_state"))
        elif table == "game_data_state":
            connection.execute(text("INSERT INTO game_data_state(game) VALUES ('power_655')"))
        elif table == "ingestion_checkpoints":
            connection.execute(text("INSERT INTO ingestion_checkpoints(game) VALUES ('power_655')"))
        else:
            run_id = connection.scalar(
                text(
                    "INSERT INTO ingestion_runs(game,kind,scope,status,counters) "
                    "VALUES (:game,'import','{}','success','{}') RETURNING id"
                ),
                {"game": "power_655" if table == "ingestion_runs" else "mega_645"},
            )
            if table == "ingestion_items":
                connection.execute(
                    text(
                        "INSERT INTO ingestion_items(game,draw_seq,status,last_run_id) "
                        "VALUES ('power_655',1,'found',:run_id)"
                    ),
                    {"run_id": run_id},
                )
    before = _snapshot(engine)
    try:
        with pytest.raises(RuntimeError, match="Power data exists"):
            command.downgrade(config, "0004_draw_prizes")
        assert _snapshot(engine) == before
        with engine.connect() as connection:
            assert (
                connection.scalar(text("SELECT version_num FROM alembic_version"))
                == "0005_power_655"
            )
    finally:
        get_settings.cache_clear()
