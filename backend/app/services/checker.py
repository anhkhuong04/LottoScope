"""Main-only historical combination checks with window-scoped context."""

from dataclasses import dataclass
from itertools import combinations

from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.analytics.metrics import NumberMetrics, PairMetrics, number_metrics, pair_metrics
from app.analytics.service import AnalysisContext, AnalysisWindow, AnalyticsService
from app.domain.draw import Draw, normalize_main_numbers
from app.games.definitions import DomainValidationError, get_game
from app.repositories.draws import DrawRepository


@dataclass(frozen=True, slots=True)
class SimilarDraw:
    draw: Draw
    overlap_count: int


@dataclass(frozen=True, slots=True)
class SimilarPage:
    items: tuple[SimilarDraw, ...]
    page: int
    page_size: int
    total: int


@dataclass(frozen=True, slots=True)
class CheckResult:
    context: AnalysisContext
    main_numbers: tuple[int, ...]
    history_draw_count: int
    exact_match_count: int
    last_exact_match: Draw | None
    overlap_histogram: dict[str, int]
    similar_draws: SimilarPage
    number_analysis: tuple[NumberMetrics, ...]
    pair_analysis: tuple[PairMetrics, ...]


def check_draws(
    game: str,
    main_numbers: tuple[int, ...],
    context: AnalysisContext,
    window_draws: tuple[Draw, ...],
    history_draws: tuple[Draw, ...],
    *,
    similar_page: int = 1,
    similar_page_size: int = 25,
) -> CheckResult:
    """Exact/overlap use history; number/pair metrics use only the requested window."""
    candidate = normalize_main_numbers(game, main_numbers)
    if type(similar_page) is not int or similar_page < 1:
        raise DomainValidationError("similar_page", "expected positive integer")
    if type(similar_page_size) is not int or not 1 <= similar_page_size <= 100:
        raise DomainValidationError("similar_page_size", "expected integer in 1..100")
    definition = get_game(game)
    counts = {f"match_{size}": 0 for size in range(definition.main_count + 1)}
    exact: list[Draw] = []
    similar: list[SimilarDraw] = []
    candidate_set = set(candidate)
    for draw in history_draws:
        if draw.game != definition.id.value:
            raise DomainValidationError("history", "mixed games")
        overlap = len(candidate_set.intersection(draw.main_numbers))
        counts[f"match_{overlap}"] += 1
        if overlap == definition.main_count:
            exact.append(draw)
        if overlap >= 2:
            similar.append(SimilarDraw(draw, overlap))
    similar.sort(
        key=lambda item: (
            -item.overlap_count,
            -item.draw.draw_date.toordinal(),
            -item.draw.draw_seq,
        )
    )
    start = (similar_page - 1) * similar_page_size
    numbers = number_metrics(game, window_draws)
    pairs = pair_metrics(game, window_draws)
    by_number = {item.number: item for item in numbers}
    by_pair = {item.numbers: item for item in pairs}
    return CheckResult(
        context,
        candidate,
        len(history_draws),
        len(exact),
        exact[-1] if exact else None,
        counts,
        SimilarPage(
            tuple(similar[start : start + similar_page_size]),
            similar_page,
            similar_page_size,
            len(similar),
        ),
        tuple(by_number[number] for number in candidate),
        tuple(by_pair[pair] for pair in combinations(candidate, 2)),
    )


class CheckerService:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def check(
        self,
        game: str,
        main_numbers: tuple[int, ...],
        window: AnalysisWindow,
        *,
        as_of_draw_id: str | None = None,
        similar_page: int = 1,
        similar_page_size: int = 25,
    ) -> CheckResult:
        candidate = normalize_main_numbers(game, main_numbers)
        with self.engine.connect().execution_options(
            isolation_level="REPEATABLE READ"
        ) as connection:
            with Session(connection) as session:
                repo = DrawRepository(session)
                snapshot = AnalyticsService.select_snapshot(repo, game, window, as_of_draw_id)
                cutoff = (
                    repo.get_by_id(game, snapshot.context.as_of_draw_id)
                    if snapshot.context.as_of_draw_id is not None
                    else None
                )
                history = repo.window_draws(game, cutoff=cutoff)
                return check_draws(
                    game,
                    candidate,
                    snapshot.context,
                    snapshot.draws,
                    history,
                    similar_page=similar_page,
                    similar_page_size=similar_page_size,
                )
