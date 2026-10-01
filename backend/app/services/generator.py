"""Bounded, seeded generation with transparent historical rule evaluations."""

import random
import secrets
from dataclasses import dataclass
from datetime import date, datetime
from itertools import combinations
from typing import Literal
from zoneinfo import ZoneInfo

from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.analytics.metrics import number_metrics, pair_metrics
from app.analytics.service import AnalysisContext, AnalysisWindow, AnalyticsService
from app.domain.draw import Draw
from app.games.definitions import DomainValidationError, GameDefinition, get_game
from app.repositories.draws import DrawRepository

ALGORITHM_VERSION = "1"


class InvalidRulesError(ValueError):
    """A rule configuration is invalid or statically contradictory."""


class InsufficientHistoryError(ValueError):
    """An enabled history-dependent rule has no usable draws."""


@dataclass(frozen=True, slots=True)
class ExactWithinDays:
    days: int


@dataclass(frozen=True, slots=True)
class MaxPreviousOverlap:
    max: int


@dataclass(frozen=True, slots=True)
class MinimumPairFrequency:
    min_count: int


@dataclass(frozen=True, slots=True)
class ExcludeBottomFrequency:
    n: int


@dataclass(frozen=True, slots=True)
class OddEvenRatio:
    odd: int
    even: int


@dataclass(frozen=True, slots=True)
class SumRange:
    min: int
    max: int


@dataclass(frozen=True, slots=True)
class RuleSet:
    exclude_exact_within_days: ExactWithinDays | None = None
    max_overlap_previous_draw: MaxPreviousOverlap | None = None
    minimum_historical_pair_frequency: MinimumPairFrequency | None = None
    exclude_bottom_frequency_numbers: ExcludeBottomFrequency | None = None
    odd_even_ratio: OddEvenRatio | None = None
    sum_range: SumRange | None = None


@dataclass(frozen=True, slots=True)
class RuleResult:
    rule_id: str
    threshold: object
    observed: object
    passed: bool


@dataclass(frozen=True, slots=True)
class NumberObservation:
    number: int
    frequency: int
    current_gap: int | None


@dataclass(frozen=True, slots=True)
class PairObservation:
    numbers: tuple[int, int]
    frequency: int


@dataclass(frozen=True, slots=True)
class Explanation:
    number_frequency: tuple[NumberObservation, ...]
    current_gaps: tuple[NumberObservation, ...]
    historical_pairs: tuple[PairObservation, ...]
    exact_match_within_days: int | None
    maximum_recent_overlap: int | None
    rule_results: tuple[RuleResult, ...]


@dataclass(frozen=True, slots=True)
class GeneratedItem:
    main_numbers: tuple[int, ...]
    explanation: Explanation


@dataclass(frozen=True, slots=True)
class GenerationResult:
    context: AnalysisContext
    reference_date: date
    algorithm_version: str
    seed: int
    requested_count: int
    generated_count: int
    attempted_count: int
    status: Literal["complete", "partial"]
    reason: Literal["search_limit"] | None
    items: tuple[GeneratedItem, ...]


def _positive(value: int, name: str) -> None:
    if type(value) is not int or value < 1:
        raise InvalidRulesError(f"{name} must be a positive integer")


def validate_rules(definition: GameDefinition, rules: RuleSet) -> None:
    if rules.exclude_exact_within_days is not None:
        _positive(rules.exclude_exact_within_days.days, "days")
    if rules.max_overlap_previous_draw is not None:
        value = rules.max_overlap_previous_draw.max
        if type(value) is not int or not 0 <= value <= definition.main_count:
            raise InvalidRulesError("max_overlap_previous_draw.max is out of range")
    if rules.minimum_historical_pair_frequency is not None:
        _positive(rules.minimum_historical_pair_frequency.min_count, "min_count")
    if rules.exclude_bottom_frequency_numbers is not None:
        value = rules.exclude_bottom_frequency_numbers.n
        if type(value) is not int or not 0 <= value <= definition.main_max - definition.main_count:
            raise InvalidRulesError("exclude_bottom_frequency_numbers.n is out of range")
    ratio = rules.odd_even_ratio
    if ratio is not None:
        odds = (definition.main_max + 1) // 2
        evens = definition.main_max // 2
        if (
            type(ratio.odd) is not int
            or type(ratio.even) is not int
            or ratio.odd < 0
            or ratio.even < 0
            or ratio.odd + ratio.even != definition.main_count
            or ratio.odd > odds
            or ratio.even > evens
        ):
            raise InvalidRulesError("odd_even_ratio is impossible for this game")
    sum_rule = rules.sum_range
    if sum_rule is not None:
        low = sum(range(1, definition.main_count + 1))
        high = sum(range(definition.main_max - definition.main_count + 1, definition.main_max + 1))
        if (
            type(sum_rule.min) is not int
            or type(sum_rule.max) is not int
            or sum_rule.min > sum_rule.max
            or sum_rule.max < low
            or sum_rule.min > high
        ):
            raise InvalidRulesError("sum_range does not intersect the game range")
        if ratio is not None:
            odd_values = range(1, definition.main_max + 1, 2)
            even_values = range(2, definition.main_max + 1, 2)
            minimum = sum(list(odd_values)[: ratio.odd]) + sum(list(even_values)[: ratio.even])
            maximum = sum(list(odd_values)[-ratio.odd :] if ratio.odd else ()) + sum(
                list(even_values)[-ratio.even :] if ratio.even else ()
            )
            if sum_rule.max < minimum or sum_rule.min > maximum:
                raise InvalidRulesError("sum_range conflicts with odd_even_ratio")


class GeneratorService:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def generate(
        self,
        game: str,
        window: AnalysisWindow,
        rules: RuleSet,
        *,
        requested_count: int,
        seed: int | None = None,
        reference_date: date | None = None,
        as_of_draw_id: str | None = None,
    ) -> GenerationResult:
        definition = get_game(game)
        if type(requested_count) is not int or not 1 <= requested_count <= 20:
            raise DomainValidationError("requested_count", "expected integer in 1..20")
        if seed is not None and (type(seed) is not int or not 0 <= seed <= 2**63 - 1):
            raise DomainValidationError("seed", "expected integer in 0..2^63-1")
        if reference_date is not None and type(reference_date) is not date:
            raise DomainValidationError("reference_date", "expected local date")
        validate_rules(definition, rules)
        effective_date = reference_date or datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).date()
        effective_seed = seed if seed is not None else secrets.randbits(63)
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
                if cutoff is not None and effective_date < cutoff.draw_date:
                    raise DomainValidationError("reference_date", "must not precede cutoff")
                history = repo.window_draws(game, cutoff=cutoff)
        return self._search(
            definition,
            snapshot.context,
            snapshot.draws,
            history,
            rules,
            requested_count,
            effective_seed,
            effective_date,
        )

    @staticmethod
    def _search(
        definition: GameDefinition,
        context: AnalysisContext,
        window_draws: tuple[Draw, ...],
        history: tuple[Draw, ...],
        rules: RuleSet,
        requested_count: int,
        seed: int,
        reference_date: date,
    ) -> GenerationResult:
        if rules.max_overlap_previous_draw is not None and not history:
            raise InsufficientHistoryError("previous draw is unavailable")
        if (
            rules.minimum_historical_pair_frequency is not None
            or rules.exclude_bottom_frequency_numbers is not None
        ) and not window_draws:
            raise InsufficientHistoryError("analysis window is empty")
        numbers = {item.number: item for item in number_metrics(definition.id.value, window_draws)}
        pairs = {item.numbers: item for item in pair_metrics(definition.id.value, window_draws)}
        bottom_rule = rules.exclude_bottom_frequency_numbers
        bottom: set[int] = (
            set(
                item.number
                for item in sorted(
                    numbers.values(), key=lambda item: (item.frequency, item.number)
                )[: bottom_rule.n]
            )
            if bottom_rule is not None
            else set()
        )
        available = [number for number in range(1, definition.main_max + 1) if number not in bottom]
        pair_rule = rules.minimum_historical_pair_frequency
        if (
            pair_rule is not None
            and max(item.frequency for item in pairs.values()) < pair_rule.min_count
        ):
            raise InvalidRulesError("minimum_historical_pair_frequency cannot be reached")
        ratio = rules.odd_even_ratio
        if ratio is not None:
            odds = [number for number in available if number % 2]
            evens = [number for number in available if number % 2 == 0]
            if len(odds) < ratio.odd or len(evens) < ratio.even:
                raise InvalidRulesError("odd_even_ratio conflicts with excluded numbers")
            smallest = sorted(odds[: ratio.odd] + evens[: ratio.even])
            largest = sorted(
                (odds[-ratio.odd :] if ratio.odd else [])
                + (evens[-ratio.even :] if ratio.even else [])
            )
        else:
            smallest = available[: definition.main_count]
            largest = available[-definition.main_count :]
        if rules.sum_range is not None and (
            rules.sum_range.max < sum(smallest) or rules.sum_range.min > sum(largest)
        ):
            raise InvalidRulesError("sum_range conflicts with available numbers")
        exact_dates: dict[tuple[int, ...], list[date]] = {}
        for draw in history:
            exact_dates.setdefault(draw.main_numbers, []).append(draw.draw_date)
        rng = random.Random(seed)
        attempts_limit = min(20000, max(1000, 1000 * requested_count))
        seen: set[tuple[int, ...]] = set()
        items: list[GeneratedItem] = []
        attempts = 0
        while attempts < attempts_limit and len(items) < requested_count:
            attempts += 1
            candidate = tuple(
                sorted(rng.sample(range(1, definition.main_max + 1), definition.main_count))
            )
            if candidate in seen:
                continue
            seen.add(candidate)
            rule_results: list[RuleResult] = []
            candidate_set = set(candidate)
            exact_count: int | None = None
            if rules.exclude_exact_within_days is not None:
                first_day = max(
                    1, reference_date.toordinal() - rules.exclude_exact_within_days.days + 1
                )
                exact_count = sum(
                    first_day <= day.toordinal() <= reference_date.toordinal()
                    for day in exact_dates.get(candidate, ())
                )
                rule_results.append(
                    RuleResult(
                        "exclude_exact_within_days",
                        rules.exclude_exact_within_days.days,
                        exact_count,
                        exact_count == 0,
                    )
                )
            if rules.max_overlap_previous_draw is not None:
                overlap = len(candidate_set.intersection(history[-1].main_numbers))
                rule_results.append(
                    RuleResult(
                        "max_overlap_previous_draw",
                        rules.max_overlap_previous_draw.max,
                        overlap,
                        overlap <= rules.max_overlap_previous_draw.max,
                    )
                )
            candidate_pairs = tuple(combinations(candidate, 2))
            if rules.minimum_historical_pair_frequency is not None:
                highest = max(pairs[pair].frequency for pair in candidate_pairs)
                rule_results.append(
                    RuleResult(
                        "minimum_historical_pair_frequency",
                        rules.minimum_historical_pair_frequency.min_count,
                        highest,
                        highest >= rules.minimum_historical_pair_frequency.min_count,
                    )
                )
            if bottom_rule is not None:
                excluded = tuple(number for number in candidate if number in bottom)
                rule_results.append(
                    RuleResult(
                        "exclude_bottom_frequency_numbers", bottom_rule.n, excluded, not excluded
                    )
                )
            if rules.odd_even_ratio is not None:
                odd = sum(number % 2 for number in candidate)
                observed = (odd, definition.main_count - odd)
                threshold = (rules.odd_even_ratio.odd, rules.odd_even_ratio.even)
                rule_results.append(
                    RuleResult("odd_even_ratio", threshold, observed, observed == threshold)
                )
            if rules.sum_range is not None:
                total = sum(candidate)
                threshold = (rules.sum_range.min, rules.sum_range.max)
                rule_results.append(
                    RuleResult("sum_range", threshold, total, threshold[0] <= total <= threshold[1])
                )
            if not all(result.passed for result in rule_results):
                continue
            maximum_overlap = (
                max(len(candidate_set.intersection(draw.main_numbers)) for draw in window_draws)
                if window_draws
                else None
            )
            observations = tuple(
                NumberObservation(number, numbers[number].frequency, numbers[number].current_gap)
                for number in candidate
            )
            explanation = Explanation(
                observations,
                observations,
                tuple(PairObservation(pair, pairs[pair].frequency) for pair in candidate_pairs),
                exact_count,
                maximum_overlap,
                tuple(rule_results),
            )
            items.append(GeneratedItem(candidate, explanation))
        complete = len(items) == requested_count
        return GenerationResult(
            context,
            reference_date,
            ALGORITHM_VERSION,
            seed,
            requested_count,
            len(items),
            attempts,
            "complete" if complete else "partial",
            None if complete else "search_limit",
            tuple(items),
        )
