"""Typed MVP API payloads; business validation remains in domain services."""

from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, StrictInt, field_serializer

from app.analytics.service import AnalysisWindow
from app.games.definitions import DomainValidationError
from app.services.generator import (
    ExactWithinDays,
    ExcludeBottomFrequency,
    MaxPreviousOverlap,
    MinimumPairFrequency,
    OddEvenRatio,
    RuleSet,
    SumRange,
)


class SyncOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    game: str
    run_id: int
    status: Literal["success", "partial", "failed"]
    created: int
    enriched: int
    unchanged: int
    remaining_unresolved: int
    source: Literal["official", "community"] = "official"


class StrictBody(BaseModel):
    model_config = ConfigDict(extra="forbid")


class WindowIn(StrictBody):
    kind: Literal["last_draws", "date_range", "all_time"]
    count: StrictInt | None = None
    from_date: date | None = None
    to_date: date | None = None

    def to_domain(self) -> AnalysisWindow:
        window = AnalysisWindow(self.kind, self.count, self.from_date, self.to_date)
        if (
            window.kind == "date_range"
            and window.from_date is not None
            and window.to_date is not None
            and (window.to_date - window.from_date).days > 3650
        ):
            raise DomainValidationError("window", "date range exceeds 3650 days")
        return window


class CheckIn(StrictBody):
    main_numbers: list[StrictInt]
    analysis_window: WindowIn
    as_of_draw_id: str | None = None
    similar_page: StrictInt = 1
    similar_page_size: StrictInt = 25


class ExactDaysIn(StrictBody):
    days: StrictInt


class MaxOverlapIn(StrictBody):
    max: StrictInt


class MinPairIn(StrictBody):
    min_count: StrictInt


class BottomIn(StrictBody):
    n: StrictInt


class OddEvenIn(StrictBody):
    odd: StrictInt
    even: StrictInt


class SumRangeIn(StrictBody):
    min: StrictInt
    max: StrictInt


class RuleSetIn(StrictBody):
    exclude_exact_within_days: ExactDaysIn | None = None
    max_overlap_previous_draw: MaxOverlapIn | None = None
    minimum_historical_pair_frequency: MinPairIn | None = None
    exclude_bottom_frequency_numbers: BottomIn | None = None
    odd_even_ratio: OddEvenIn | None = None
    sum_range: SumRangeIn | None = None

    def to_domain(self) -> RuleSet:
        return RuleSet(
            ExactWithinDays(self.exclude_exact_within_days.days)
            if self.exclude_exact_within_days
            else None,
            MaxPreviousOverlap(self.max_overlap_previous_draw.max)
            if self.max_overlap_previous_draw
            else None,
            MinimumPairFrequency(self.minimum_historical_pair_frequency.min_count)
            if self.minimum_historical_pair_frequency
            else None,
            ExcludeBottomFrequency(self.exclude_bottom_frequency_numbers.n)
            if self.exclude_bottom_frequency_numbers
            else None,
            OddEvenRatio(self.odd_even_ratio.odd, self.odd_even_ratio.even)
            if self.odd_even_ratio
            else None,
            SumRange(self.sum_range.min, self.sum_range.max) if self.sum_range else None,
        )


class GenerateIn(StrictBody):
    analysis_window: WindowIn
    requested_count: StrictInt
    rules: RuleSetIn
    as_of_draw_id: str | None = None
    seed: StrictInt | None = None
    reference_date: date | None = None


class Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class DrawOut(Out):
    draw_id: str
    draw_date: date
    draw_time: time | None
    main_numbers: tuple[int, ...]
    special_number: int | None
    source_url: str
    source_retrieved_at: datetime


class DrawPageOut(Out):
    items: tuple[DrawOut, ...]
    page: int
    page_size: int
    total: int


class PrizeMatchOut(Out):
    main_count: int
    special: bool


class PrizeTierOut(Out):
    name: str
    matches: tuple[PrizeMatchOut, ...]
    winner_count: int
    amount_vnd: int

    @field_serializer("amount_vnd")
    def decimal_vnd(self, amount: int) -> str:
        return str(amount)


class PrizesOut(Out):
    draw_id: str
    items: tuple[PrizeTierOut, ...]
    currency: Literal["VND"]
    source_url: str
    source_retrieved_at: datetime | None


class LastDrawsOut(Out):
    kind: Literal["last_draws"]
    count: int


class DateRangeOut(Out):
    kind: Literal["date_range"]
    from_date: date
    to_date: date


class AllTimeOut(Out):
    kind: Literal["all_time"]


class ContextOut(Out):
    game: str
    analysis_window: LastDrawsOut | DateRangeOut | AllTimeOut
    as_of_draw_id: str | None
    actual_draw_count: int
    data_version: int


class NumberOut(Out):
    number: int
    frequency: int
    frequency_percent: float | None
    frequency_rank: int
    current_gap: int | None
    average_gap: float | None
    max_gap: int | None
    last_seen_draw_id: str | None


class PairOut(Out):
    numbers: tuple[int, int]
    frequency: int
    percent_of_draws: float | None
    current_gap: int | None
    average_gap: float | None
    max_gap: int | None
    last_seen_draw_id: str | None


class NumbersOut(Out):
    context: ContextOut
    items: tuple[NumberOut, ...]


class PairPageOut(Out):
    items: tuple[PairOut, ...]
    page: int
    page_size: int
    total: int


class PairsOut(Out):
    context: ContextOut
    page: int
    page_size: int
    total: int
    items: tuple[PairOut, ...]


class NumberDetailOut(Out):
    context: ContextOut
    metrics: NumberOut
    appearance_draws: DrawPageOut
    timeline_draw_ids: tuple[str, ...]
    pair_partners: tuple[PairOut, ...]


class PairDetailOut(Out):
    context: ContextOut
    metrics: PairOut
    appearance_draws: DrawPageOut
    timeline_draw_ids: tuple[str, ...]


class SimilarOut(Out):
    draw: DrawOut
    overlap_count: int


class SimilarPageOut(Out):
    items: tuple[SimilarOut, ...]
    page: int
    page_size: int
    total: int


class CheckOut(Out):
    context: ContextOut
    main_numbers: tuple[int, ...]
    history_draw_count: int
    exact_match_count: int
    last_exact_match: DrawOut | None
    overlap_histogram: dict[str, int]
    similar_draws: SimilarPageOut
    number_analysis: tuple[NumberOut, ...]
    pair_analysis: tuple[PairOut, ...]


class RuleResultOut(Out):
    rule_id: str
    threshold: object
    observed: object
    passed: bool


class NumberObservationOut(Out):
    number: int
    frequency: int
    current_gap: int | None


class PairObservationOut(Out):
    numbers: tuple[int, int]
    frequency: int


class ExplanationOut(Out):
    number_frequency: tuple[NumberObservationOut, ...]
    current_gaps: tuple[NumberObservationOut, ...]
    historical_pairs: tuple[PairObservationOut, ...]
    exact_match_within_days: int | None
    maximum_recent_overlap: int | None
    rule_results: tuple[RuleResultOut, ...]


class GeneratedItemOut(Out):
    main_numbers: tuple[int, ...]
    explanation: ExplanationOut


class GenerateOut(Out):
    context: ContextOut
    reference_date: date
    algorithm_version: str
    seed: int
    requested_count: int
    generated_count: int
    attempted_count: int
    status: str
    reason: str | None
    items: tuple[GeneratedItemOut, ...]


class GameOut(Out):
    id: str
    label: str
    main_count: int
    main_min: int
    main_max: int
    special_min: int | None
    special_max: int | None


class GamesOut(Out):
    items: tuple[GameOut, ...]


class StatusOut(Out):
    latest_draw_id: str | None
    latest_draw_date: date | None
    last_successful_ingestion_at: datetime | None
    last_failed_ingestion_at: datetime | None
    data_version: int
