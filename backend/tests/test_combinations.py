"""Main-only checker and bounded generator contracts on PostgreSQL fixtures."""

import os
from datetime import UTC, date, datetime
from urllib.parse import urlsplit

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.analytics.service import AnalysisWindow
from app.domain.draw import Draw
from app.games.definitions import DomainValidationError
from app.repositories.draws import DrawRepository
from app.services.checker import CheckerService
from app.services.generator import (
    ExactWithinDays,
    ExcludeBottomFrequency,
    GeneratorService,
    InsufficientHistoryError,
    InvalidRulesError,
    MaxPreviousOverlap,
    MinimumPairFrequency,
    OddEvenRatio,
    RuleSet,
    SumRange,
)


@pytest.fixture
def engine():
    url = os.getenv("LOTTO_TEST_DATABASE_URL", "")
    if not url or not urlsplit(url).path.endswith("_test"):
        pytest.fail("LOTTO_TEST_DATABASE_URL must point to a dedicated *_test database")
    engine = create_engine(url)
    with engine.begin() as connection:
        assert connection.dialect.name == "postgresql"
        connection.execute(
            text(
                "TRUNCATE ingestion_items, ingestion_runs, ingestion_checkpoints, "
                "draw_corrections, draws, game_data_state RESTART IDENTITY"
            )
        )
    yield engine
    engine.dispose()


def seed(engine) -> None:
    fixture = (
        ("lotto_535", "90001", 1, (1, 2, 3, 4, 5), 1),
        ("lotto_535", "90002", 1, (1, 2, 6, 7, 8), 2),
        ("lotto_535", "90003", 2, (2, 3, 9, 10, 11), 3),
        ("mega_645", "90001", 1, (1, 2, 3, 4, 5, 6), None),
        ("mega_645", "90002", 2, (1, 2, 7, 8, 9, 10), None),
        ("mega_645", "90003", 3, (2, 3, 11, 12, 13, 14), None),
    )
    with Session(engine) as session, session.begin():
        repo = DrawRepository(session)
        for game, draw_id, day, main, special in fixture:
            repo.add(
                Draw(
                    game=game,
                    draw_id=draw_id,
                    draw_date=date(2099, 1, day),
                    draw_time=None,
                    main_numbers=main,
                    special_number=special,
                    source_url=f"https://example.test/{game}/{draw_id}",
                    source_retrieved_at=datetime(2099, 1, 4, tzinfo=UTC),
                )
            )


@pytest.mark.integration
@pytest.mark.parametrize(
    "game,candidate,exact_bucket",
    [
        ("lotto_535", (5, 4, 3, 2, 1), "match_5"),
        ("mega_645", (6, 5, 4, 3, 2, 1), "match_6"),
    ],
)
def test_checker_exact_overlap_window_and_isolation(engine, game, candidate, exact_bucket) -> None:
    seed(engine)
    checker = CheckerService(engine)
    result = checker.check(
        game, candidate, AnalysisWindow("last_draws", count=10), similar_page_size=1
    )
    assert result.main_numbers == tuple(sorted(candidate))
    assert result.exact_match_count == 1
    assert result.last_exact_match.draw_id == "90001"
    assert result.history_draw_count == 3
    assert result.overlap_histogram["match_2"] == 2
    assert result.overlap_histogram[exact_bucket] == 1
    assert sum(result.overlap_histogram.values()) == 3
    assert result.similar_draws.total == 3
    assert result.similar_draws.items[0].draw.draw_id == "90001"
    assert (
        checker.check(
            game, candidate, AnalysisWindow("all_time"), similar_page=2, similar_page_size=1
        )
        .similar_draws.items[0]
        .draw.draw_id
        == "90003"
    )
    assert result.number_analysis[0].frequency == 2
    assert result.pair_analysis[0].numbers == (1, 2)
    assert result.pair_analysis[0].frequency == 2
    before = checker.check(
        game,
        candidate,
        AnalysisWindow("date_range", from_date=date(2099, 1, 3), to_date=date(2099, 1, 3)),
        as_of_draw_id="90002",
    )
    assert before.context.actual_draw_count == 0
    assert before.history_draw_count == 2
    assert before.exact_match_count == 1
    assert before.number_analysis[0].frequency == 0
    assert before.number_analysis[0].frequency_percent is None


@pytest.mark.integration
def test_checker_no_match_validation_and_repeated_identity(engine) -> None:
    seed(engine)
    checker = CheckerService(engine)
    absent = checker.check("lotto_535", (20, 21, 22, 23, 24), AnalysisWindow("all_time"))
    assert absent.exact_match_count == 0 and absent.last_exact_match is None
    assert absent.overlap_histogram["match_0"] == 3
    assert absent.similar_draws.total == 0
    with Session(engine) as session, session.begin():
        DrawRepository(session).add(
            Draw(
                game="lotto_535",
                draw_id="90004",
                draw_date=date(2099, 1, 3),
                draw_time=None,
                main_numbers=(1, 2, 3, 4, 5),
                special_number=12,
                source_url="https://example.test/90004",
                source_retrieved_at=datetime(2099, 1, 4, tzinfo=UTC),
            )
        )
    repeated = checker.check("lotto_535", (1, 2, 3, 4, 5), AnalysisWindow("last_draws", count=10))
    assert repeated.exact_match_count == 2
    assert repeated.last_exact_match.draw_id == "90004"
    for candidate in ((1, 1, 2, 3, 4), (1, 2, 3, 4, 36), (True, 2, 3, 4, 5)):
        with pytest.raises(DomainValidationError):
            checker.check("lotto_535", candidate, AnalysisWindow("all_time"))
    with pytest.raises(DomainValidationError):
        checker.check(
            "lotto_535", (1, 2, 3, 4, 5), AnalysisWindow("all_time"), similar_page_size=101
        )


@pytest.mark.integration
def test_generator_seed_rules_explanation_and_bound(engine) -> None:
    seed(engine)
    generator = GeneratorService(engine)
    window = AnalysisWindow("last_draws", count=10)
    rules = RuleSet(
        exclude_exact_within_days=ExactWithinDays(2),
        max_overlap_previous_draw=MaxPreviousOverlap(4),
        minimum_historical_pair_frequency=MinimumPairFrequency(1),
        exclude_bottom_frequency_numbers=ExcludeBottomFrequency(2),
        odd_even_ratio=OddEvenRatio(2, 3),
        sum_range=SumRange(20, 110),
    )
    first = generator.generate(
        "lotto_535", window, rules, requested_count=2, seed=123, reference_date=date(2099, 1, 3)
    )
    second = generator.generate(
        "lotto_535", window, rules, requested_count=2, seed=123, reference_date=date(2099, 1, 3)
    )
    assert first == second
    assert first.status == "complete" and first.generated_count == 2
    assert 2 <= first.attempted_count <= 2000
    assert len({item.main_numbers for item in first.items}) == 2
    for item in first.items:
        explanation = item.explanation
        assert len(explanation.number_frequency) == 5
        assert len(explanation.historical_pairs) == 10
        assert explanation.maximum_recent_overlap is not None
        assert [result.rule_id for result in explanation.rule_results] == [
            "exclude_exact_within_days",
            "max_overlap_previous_draw",
            "minimum_historical_pair_frequency",
            "exclude_bottom_frequency_numbers",
            "odd_even_ratio",
            "sum_range",
        ]
        assert all(result.passed for result in explanation.rule_results)
        assert explanation.rule_results[0].observed == 0
        assert explanation.rule_results[2].observed == max(
            pair.frequency for pair in explanation.historical_pairs
        )
        assert explanation.rule_results[-1].observed == sum(item.main_numbers)
    impossible = generator.generate(
        "lotto_535",
        window,
        RuleSet(sum_range=SumRange(15, 15)),
        requested_count=1,
        seed=7,
        reference_date=date(2099, 1, 3),
    )
    assert impossible.status == "partial" and impossible.reason == "search_limit"
    assert impossible.generated_count == 0 and impossible.attempted_count == 1000


@pytest.mark.integration
@pytest.mark.parametrize(
    "rules,rejected,accepted",
    [
        (
            RuleSet(exclude_exact_within_days=ExactWithinDays(3)),
            (1, 2, 3, 4, 5),
            (15, 16, 17, 18, 19),
        ),
        (
            RuleSet(max_overlap_previous_draw=MaxPreviousOverlap(0)),
            (1, 2, 3, 4, 5),
            (15, 16, 17, 18, 19),
        ),
        (
            RuleSet(minimum_historical_pair_frequency=MinimumPairFrequency(2)),
            (15, 16, 17, 18, 19),
            (1, 2, 3, 4, 5),
        ),
        (
            RuleSet(exclude_bottom_frequency_numbers=ExcludeBottomFrequency(2)),
            (12, 14, 15, 16, 17),
            (15, 16, 17, 18, 19),
        ),
        (RuleSet(odd_even_ratio=OddEvenRatio(2, 3)), (1, 2, 3, 4, 5), (2, 4, 6, 7, 9)),
        (RuleSet(sum_range=SumRange(20, 30)), (1, 2, 3, 4, 5), (2, 3, 4, 5, 6)),
    ],
)
def test_each_enabled_rule_rejects_and_accepts_at_boundary(
    engine, monkeypatch, rules: RuleSet, rejected: tuple[int, ...], accepted: tuple[int, ...]
) -> None:
    seed(engine)

    class FixedCandidates:
        def __init__(self, _seed: int) -> None:
            self.candidates = iter((rejected, accepted))

        def sample(self, _population: range, _count: int) -> tuple[int, ...]:
            return next(self.candidates)

    monkeypatch.setattr("app.services.generator.random.Random", FixedCandidates)
    result = GeneratorService(engine).generate(
        "lotto_535",
        AnalysisWindow("all_time"),
        rules,
        requested_count=1,
        seed=4,
        reference_date=date(2099, 1, 3),
    )
    assert result.attempted_count == 2
    assert result.items[0].main_numbers == accepted
    assert result.items[0].explanation.rule_results[0].passed


@pytest.mark.integration
def test_generator_empty_history_invalid_rules_and_reference_date(engine) -> None:
    generator = GeneratorService(engine)
    window = AnalysisWindow("all_time")
    no_history = generator.generate(
        "mega_645",
        window,
        RuleSet(exclude_exact_within_days=ExactWithinDays(1)),
        requested_count=1,
        seed=1,
        reference_date=date(2099, 1, 1),
    )
    assert no_history.status == "complete"
    assert no_history.items[0].explanation.exact_match_within_days == 0
    for rules in (
        RuleSet(max_overlap_previous_draw=MaxPreviousOverlap(0)),
        RuleSet(minimum_historical_pair_frequency=MinimumPairFrequency(1)),
        RuleSet(exclude_bottom_frequency_numbers=ExcludeBottomFrequency(1)),
    ):
        with pytest.raises(InsufficientHistoryError):
            generator.generate(
                "mega_645",
                window,
                rules,
                requested_count=1,
                seed=1,
                reference_date=date(2099, 1, 1),
            )
    for rules in (
        RuleSet(odd_even_ratio=OddEvenRatio(1, 1)),
        RuleSet(sum_range=SumRange(1, 2)),
        RuleSet(exclude_exact_within_days=ExactWithinDays(0)),
        RuleSet(odd_even_ratio=OddEvenRatio(0, 6), sum_range=SumRange(21, 22)),
    ):
        with pytest.raises(InvalidRulesError):
            generator.generate(
                "mega_645",
                window,
                rules,
                requested_count=1,
                seed=1,
                reference_date=date(2099, 1, 1),
            )
    seed(engine)
    with pytest.raises(InvalidRulesError):
        generator.generate(
            "lotto_535",
            window,
            RuleSet(minimum_historical_pair_frequency=MinimumPairFrequency(4)),
            requested_count=1,
            seed=1,
            reference_date=date(2099, 1, 3),
        )
    with pytest.raises(DomainValidationError):
        generator.generate(
            "lotto_535", window, RuleSet(), requested_count=1, reference_date=date(2026, 1, 1)
        )
    for requested, random_seed in ((0, 1), (21, 1), (1, True), (1, -1)):
        with pytest.raises(DomainValidationError):
            generator.generate(
                "lotto_535", window, RuleSet(), requested_count=requested, seed=random_seed
            )
