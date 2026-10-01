"""Pure main-number metrics over one chronological analysis window."""

from collections import defaultdict
from dataclasses import dataclass
from itertools import combinations

from app.domain.draw import Draw, normalize_pair
from app.games.definitions import DomainValidationError, get_game


@dataclass(frozen=True, slots=True)
class NumberMetrics:
    number: int
    frequency: int
    frequency_percent: float | None
    frequency_rank: int
    current_gap: int | None
    average_gap: float | None
    max_gap: int | None
    last_seen_draw_id: str | None


@dataclass(frozen=True, slots=True)
class PairMetrics:
    numbers: tuple[int, int]
    frequency: int
    percent_of_draws: float | None
    current_gap: int | None
    average_gap: float | None
    max_gap: int | None
    last_seen_draw_id: str | None


def _recency(
    positions: list[int], draws: tuple[Draw, ...]
) -> tuple[int | None, float | None, int | None, str | None]:
    if not positions:
        return None, None, None, None
    intervals = [right - left - 1 for left, right in zip(positions, positions[1:], strict=False)]
    return (
        len(draws) - 1 - positions[-1],
        sum(intervals) / len(intervals) if intervals else None,
        max(intervals) if intervals else None,
        draws[positions[-1]].draw_id,
    )


def number_metrics(game: str, draws: tuple[Draw, ...]) -> tuple[NumberMetrics, ...]:
    """Include zero-frequency numbers and dense ranks for descending frequency."""
    definition = get_game(game)
    positions: dict[int, list[int]] = defaultdict(list)
    for index, draw in enumerate(draws):
        if draw.game != definition.id.value:
            raise DomainValidationError("draws", "mixed games in analytics window")
        for number in draw.main_numbers:
            positions[number].append(index)
    counts = {number: len(positions[number]) for number in range(1, definition.main_max + 1)}
    ranks = {
        count: rank for rank, count in enumerate(sorted(set(counts.values()), reverse=True), 1)
    }
    results: list[NumberMetrics] = []
    for number, count in counts.items():
        current, average, maximum, last_seen = _recency(positions[number], draws)
        results.append(
            NumberMetrics(
                number,
                count,
                100 * count / len(draws) if draws else None,
                ranks[count],
                current,
                average,
                maximum,
                last_seen,
            )
        )
    return tuple(results)


def pair_metrics(game: str, draws: tuple[Draw, ...]) -> tuple[PairMetrics, ...]:
    """Count every canonical main pair once per draw, including never-seen pairs."""
    definition = get_game(game)
    positions: dict[tuple[int, int], list[int]] = defaultdict(list)
    for index, draw in enumerate(draws):
        if draw.game != definition.id.value:
            raise DomainValidationError("draws", "mixed games in analytics window")
        for pair in combinations(draw.main_numbers, 2):
            positions[pair].append(index)
    results: list[PairMetrics] = []
    for pair in combinations(range(1, definition.main_max + 1), 2):
        occurrence = positions[pair]
        current, average, maximum, last_seen = _recency(occurrence, draws)
        results.append(
            PairMetrics(
                pair,
                len(occurrence),
                100 * len(occurrence) / len(draws) if draws else None,
                current,
                average,
                maximum,
                last_seen,
            )
        )
    return tuple(results)


def select_number(metrics: tuple[NumberMetrics, ...], number: int) -> NumberMetrics:
    if type(number) is not int or not 1 <= number <= len(metrics):
        raise DomainValidationError("number", "outside the game's main range")
    return metrics[number - 1]


def select_pair(
    game: str, metrics: tuple[PairMetrics, ...], first: int, second: int
) -> PairMetrics:
    pair = normalize_pair(game, first, second)
    return next(metric for metric in metrics if metric.numbers == pair)
