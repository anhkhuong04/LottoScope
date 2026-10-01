"""Window selection and read use cases; one PostgreSQL snapshot per response."""

from dataclasses import dataclass
from datetime import date
from typing import Literal

from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.analytics.metrics import (
    NumberMetrics,
    PairMetrics,
    number_metrics,
    pair_metrics,
    select_number,
    select_pair,
)
from app.domain.draw import Draw, normalize_pair
from app.games.definitions import DomainValidationError, get_game
from app.repositories.draws import DrawPage, DrawRepository

type WindowKind = Literal["last_draws", "date_range", "all_time"]


class CutoffNotFoundError(LookupError):
    """The requested draw ID does not exist in this game."""


@dataclass(frozen=True, slots=True)
class AnalysisWindow:
    kind: WindowKind
    count: int | None = None
    from_date: date | None = None
    to_date: date | None = None

    def __post_init__(self) -> None:
        if self.kind == "last_draws":
            if self.count not in (10, 20, 30, 50, 100) or type(self.count) is not int:
                raise DomainValidationError("count", "expected 10, 20, 30, 50, or 100")
            if self.from_date is not None or self.to_date is not None:
                raise DomainValidationError("window", "last_draws does not accept dates")
        elif self.kind == "date_range":
            if (
                type(self.from_date) is not date
                or type(self.to_date) is not date
                or self.from_date > self.to_date
            ):
                raise DomainValidationError("date_range", "expected ordered inclusive dates")
            if self.count is not None:
                raise DomainValidationError("window", "date_range does not accept count")
        elif self.kind == "all_time":
            if self.count is not None or self.from_date is not None or self.to_date is not None:
                raise DomainValidationError("window", "all_time does not accept filters")
        else:
            raise DomainValidationError("window", "unsupported window kind")


@dataclass(frozen=True, slots=True)
class AnalysisContext:
    game: str
    analysis_window: AnalysisWindow
    as_of_draw_id: str | None
    actual_draw_count: int
    data_version: int


@dataclass(frozen=True, slots=True)
class WindowSnapshot:
    context: AnalysisContext
    draws: tuple[Draw, ...]


@dataclass(frozen=True, slots=True)
class MetricPage[T]:
    items: tuple[T, ...]
    page: int
    page_size: int
    total: int


@dataclass(frozen=True, slots=True)
class NumberDetail:
    context: AnalysisContext
    metrics: NumberMetrics
    appearance_draws: DrawPage
    timeline_draw_ids: tuple[str, ...]
    pair_partners: tuple[PairMetrics, ...]


@dataclass(frozen=True, slots=True)
class PairDetail:
    context: AnalysisContext
    metrics: PairMetrics
    appearance_draws: DrawPage
    timeline_draw_ids: tuple[str, ...]


def _validate_page(page: int, page_size: int) -> None:
    if type(page) is not int or page < 1:
        raise DomainValidationError("page", "expected positive integer")
    if type(page_size) is not int or not 1 <= page_size <= 100:
        raise DomainValidationError("page_size", "expected integer in 1..100")


class AnalyticsService:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    @staticmethod
    def select_snapshot(
        repo: DrawRepository,
        game: str,
        window: AnalysisWindow,
        as_of_draw_id: str | None,
    ) -> WindowSnapshot:
        definition = get_game(game)
        if as_of_draw_id is None:
            cutoff = repo.latest(game)
        else:
            try:
                cutoff = repo.get_by_id(game, as_of_draw_id)
            except DomainValidationError as exc:
                if exc.field != "draw_id":
                    raise
                raise CutoffNotFoundError(f"{game}/{as_of_draw_id}") from exc
            if cutoff is None:
                raise CutoffNotFoundError(f"{game}/{as_of_draw_id}")
        draws = repo.window_draws(
            game,
            cutoff=cutoff,
            last_count=window.count if window.kind == "last_draws" else None,
            from_date=window.from_date if window.kind == "date_range" else None,
            to_date=window.to_date if window.kind == "date_range" else None,
        )
        return WindowSnapshot(
            AnalysisContext(
                definition.id.value,
                window,
                cutoff.draw_id if cutoff is not None else None,
                len(draws),
                repo.data_version(game),
            ),
            draws,
        )

    def snapshot(
        self, game: str, window: AnalysisWindow, *, as_of_draw_id: str | None = None
    ) -> WindowSnapshot:
        with self.engine.connect().execution_options(
            isolation_level="REPEATABLE READ"
        ) as connection:
            with Session(connection) as session:
                return self.select_snapshot(DrawRepository(session), game, window, as_of_draw_id)

    def numbers(
        self,
        game: str,
        window: AnalysisWindow,
        *,
        as_of_draw_id: str | None = None,
        sort: Literal["number", "frequency_desc", "frequency_asc", "gap_desc"] = "number",
    ) -> tuple[AnalysisContext, tuple[NumberMetrics, ...]]:
        snapshot = self.snapshot(game, window, as_of_draw_id=as_of_draw_id)
        values = number_metrics(game, snapshot.draws)
        if sort == "frequency_desc":
            values = tuple(sorted(values, key=lambda item: (-item.frequency, item.number)))
        elif sort == "frequency_asc":
            values = tuple(sorted(values, key=lambda item: (item.frequency, item.number)))
        elif sort == "gap_desc":
            values = tuple(
                sorted(
                    values,
                    key=lambda item: (
                        item.current_gap is None,
                        -(item.current_gap or 0),
                        item.number,
                    ),
                )
            )
        elif sort != "number":
            raise DomainValidationError("sort", "unsupported number sort")
        return snapshot.context, values

    def pairs(
        self,
        game: str,
        window: AnalysisWindow,
        *,
        as_of_draw_id: str | None = None,
        min_frequency: int = 0,
        sort: Literal["frequency_desc", "frequency_asc", "pair"] = "frequency_desc",
        page: int = 1,
        page_size: int = 25,
    ) -> tuple[AnalysisContext, MetricPage[PairMetrics]]:
        _validate_page(page, page_size)
        if type(min_frequency) is not int or min_frequency < 0:
            raise DomainValidationError("min_frequency", "expected nonnegative integer")
        snapshot = self.snapshot(game, window, as_of_draw_id=as_of_draw_id)
        values = tuple(
            item for item in pair_metrics(game, snapshot.draws) if item.frequency >= min_frequency
        )
        if sort == "frequency_desc":
            values = tuple(sorted(values, key=lambda item: (-item.frequency, item.numbers)))
        elif sort == "frequency_asc":
            values = tuple(sorted(values, key=lambda item: (item.frequency, item.numbers)))
        elif sort != "pair":
            raise DomainValidationError("sort", "unsupported pair sort")
        start = (page - 1) * page_size
        return snapshot.context, MetricPage(
            values[start : start + page_size], page, page_size, len(values)
        )

    def number_detail(
        self,
        game: str,
        number: int,
        window: AnalysisWindow,
        *,
        as_of_draw_id: str | None = None,
        page: int = 1,
        page_size: int = 25,
    ) -> NumberDetail:
        _validate_page(page, page_size)
        with self.engine.connect().execution_options(
            isolation_level="REPEATABLE READ"
        ) as connection:
            with Session(connection) as session:
                repo = DrawRepository(session)
                snapshot = self.select_snapshot(repo, game, window, as_of_draw_id)
                metric = select_number(number_metrics(game, snapshot.draws), number)
                partners = tuple(
                    sorted(
                        (
                            item
                            for item in pair_metrics(game, snapshot.draws)
                            if number in item.numbers and item.frequency > 0
                        ),
                        key=lambda item: (
                            -item.frequency,
                            next(n for n in item.numbers if n != number),
                        ),
                    )[:10]
                )
                appearances = self._appearances(repo, snapshot.draws, (number,), page, page_size)
                return NumberDetail(
                    snapshot.context,
                    metric,
                    appearances,
                    tuple(draw.draw_id for draw in appearances.items),
                    partners,
                )

    def pair_detail(
        self,
        game: str,
        first: int,
        second: int,
        window: AnalysisWindow,
        *,
        as_of_draw_id: str | None = None,
        page: int = 1,
        page_size: int = 25,
    ) -> PairDetail:
        _validate_page(page, page_size)
        pair = normalize_pair(game, first, second)
        with self.engine.connect().execution_options(
            isolation_level="REPEATABLE READ"
        ) as connection:
            with Session(connection) as session:
                repo = DrawRepository(session)
                snapshot = self.select_snapshot(repo, game, window, as_of_draw_id)
                metric = select_pair(game, pair_metrics(game, snapshot.draws), *pair)
                appearances = self._appearances(repo, snapshot.draws, pair, page, page_size)
                return PairDetail(
                    snapshot.context,
                    metric,
                    appearances,
                    tuple(draw.draw_id for draw in appearances.items),
                )

    @staticmethod
    def _appearances(
        repo: DrawRepository,
        draws: tuple[Draw, ...],
        numbers: tuple[int, ...],
        page: int,
        page_size: int,
    ) -> DrawPage:
        if not draws:
            return DrawPage((), page, page_size, 0)
        return repo.list_draws(
            draws[0].game,
            main_contains=numbers,
            first=draws[0],
            last=draws[-1],
            page=page,
            page_size=page_size,
        )
