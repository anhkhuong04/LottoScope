"""Read committed draw freshness and ingestion outcomes by game."""

from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from app.games.definitions import get_game
from app.models.ingestion import IngestionRunRow
from app.repositories.draws import DrawRepository


@dataclass(frozen=True, slots=True)
class GameStatus:
    latest_draw_id: str | None
    latest_draw_date: date | None
    last_successful_ingestion_at: datetime | None
    last_failed_ingestion_at: datetime | None
    data_version: int


def game_status(engine: Engine, game: str) -> GameStatus:
    get_game(game)
    with engine.connect().execution_options(isolation_level="REPEATABLE READ") as connection:
        with Session(connection) as session:
            repo = DrawRepository(session)
            latest = repo.latest(game)
            successful = session.scalar(
                select(func.max(IngestionRunRow.finished_at)).where(
                    IngestionRunRow.game == game, IngestionRunRow.status == "success"
                )
            )
            failed = session.scalar(
                select(func.max(IngestionRunRow.finished_at)).where(
                    IngestionRunRow.game == game,
                    IngestionRunRow.status.in_(["partial", "failed"]),
                )
            )
            return GameStatus(
                latest.draw_id if latest else None,
                latest.draw_date if latest else None,
                successful,
                failed,
                repo.data_version(game),
            )
