"""History queries backed by PostgreSQL pagination and stable chronology."""

from datetime import date
from typing import Literal

from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.domain.draw import Draw, normalize_main_numbers, normalize_pair
from app.games.definitions import DomainValidationError, get_game
from app.repositories.draws import DrawPage, DrawRepository


class DrawHistoryService:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def latest(self, game: str) -> Draw | None:
        with Session(self.engine) as session:
            return DrawRepository(session).latest(game)

    def by_id(self, game: str, draw_id: str) -> Draw | None:
        with Session(self.engine) as session:
            return DrawRepository(session).get_by_id(game, draw_id)

    def list_draws(
        self,
        game: str,
        *,
        from_date: date | None = None,
        to_date: date | None = None,
        draw_id: str | None = None,
        page: int = 1,
        page_size: int = 25,
        sort: Literal["asc", "desc"] = "desc",
    ) -> DrawPage:
        with self.engine.connect().execution_options(
            isolation_level="REPEATABLE READ"
        ) as connection:
            with Session(connection) as session:
                return DrawRepository(session).list_draws(
                    game,
                    from_date=from_date,
                    to_date=to_date,
                    draw_id=draw_id,
                    page=page,
                    page_size=page_size,
                    sort=sort,
                )

    def containing_number(
        self, game: str, number: int, *, page: int = 1, page_size: int = 25
    ) -> DrawPage:
        definition = get_game(game)
        if type(number) is not int or not 1 <= number <= definition.main_max:
            raise DomainValidationError("number", "outside the game's main range")
        return self._containing(game, (number,), page, page_size)

    def containing_pair(
        self, game: str, first: int, second: int, *, page: int = 1, page_size: int = 25
    ) -> DrawPage:
        return self._containing(game, normalize_pair(game, first, second), page, page_size)

    def containing_combination(
        self, game: str, main_numbers: tuple[int, ...], *, page: int = 1, page_size: int = 25
    ) -> DrawPage:
        return self._containing(game, normalize_main_numbers(game, main_numbers), page, page_size)

    def _containing(
        self, game: str, numbers: tuple[int, ...], page: int, page_size: int
    ) -> DrawPage:
        with self.engine.connect().execution_options(
            isolation_level="REPEATABLE READ"
        ) as connection:
            with Session(connection) as session:
                return DrawRepository(session).list_draws(
                    game, main_contains=numbers, page=page, page_size=page_size
                )
