"""P4 contracts against a migrated PostgreSQL database and hand-calculated draws."""

import os
from dataclasses import replace
from datetime import UTC, date, datetime
from urllib.parse import urlsplit

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.analytics.service import AnalysisWindow, AnalyticsService, CutoffNotFoundError
from app.domain.draw import Draw
from app.games.definitions import DomainValidationError, get_game
from app.repositories.draws import DrawRepository
from app.services.history import DrawHistoryService


@pytest.fixture
def engine():
    url = os.getenv("LOTTO_TEST_DATABASE_URL", "")
    if not url or not urlsplit(url).path.endswith("_test"):
        pytest.fail("LOTTO_TEST_DATABASE_URL must point to a dedicated *_test database")
    db_engine = create_engine(url)
    with db_engine.begin() as connection:
        assert connection.dialect.name == "postgresql"
        assert (
            connection.scalar(text("SELECT version_num FROM alembic_version")) == "0004_draw_prizes"
        )
        connection.execute(
            text(
                "TRUNCATE ingestion_items, ingestion_runs, ingestion_checkpoints, "
                "draw_corrections, draws, game_data_state RESTART IDENTITY"
            )
        )
    yield db_engine
    db_engine.dispose()


def make_draw(
    game: str,
    draw_id: str,
    draw_date: date,
    main: tuple[int, ...],
    *,
    special: int | None = None,
) -> Draw:
    return Draw(
        game=game,
        draw_id=draw_id,
        draw_date=draw_date,
        draw_time=None,
        main_numbers=main,
        special_number=special,
        source_url=f"https://example.test/{game}/{draw_id}",
        source_retrieved_at=datetime(2099, 1, 4, tzinfo=UTC),
    )


def seed_fixture(engine) -> None:
    draws = (
        make_draw("lotto_535", "90001", date(2099, 1, 1), (1, 2, 3, 4, 5), special=1),
        make_draw("lotto_535", "90002", date(2099, 1, 1), (1, 2, 6, 7, 8), special=2),
        make_draw("lotto_535", "90003", date(2099, 1, 2), (2, 3, 9, 10, 11), special=3),
        make_draw("mega_645", "90001", date(2099, 1, 1), (1, 2, 3, 4, 5, 6)),
        make_draw("mega_645", "90002", date(2099, 1, 2), (1, 2, 7, 8, 9, 10)),
        make_draw("mega_645", "90003", date(2099, 1, 3), (2, 3, 11, 12, 13, 14)),
    )
    with Session(engine) as session, session.begin():
        repo = DrawRepository(session)
        for draw in draws:
            assert repo.add(draw).status == "created"


@pytest.mark.integration
def test_window_cutoff_same_day_empty_and_missing_count(engine) -> None:
    seed_fixture(engine)
    service = AnalyticsService(engine)
    last = AnalysisWindow("last_draws", count=10)
    snapshot = service.snapshot("lotto_535", last)
    assert snapshot.context.as_of_draw_id == "90003"
    assert snapshot.context.actual_draw_count == 3
    assert snapshot.context.data_version == 3
    assert [draw.draw_id for draw in snapshot.draws] == ["90001", "90002", "90003"]

    same_day = service.snapshot(
        "lotto_535",
        AnalysisWindow("date_range", from_date=date(2099, 1, 1), to_date=date(2099, 1, 1)),
    )
    assert [draw.draw_id for draw in same_day.draws] == ["90001", "90002"]
    cutoff = service.snapshot("lotto_535", AnalysisWindow("all_time"), as_of_draw_id="90002")
    assert [draw.draw_id for draw in cutoff.draws] == ["90001", "90002"]
    assert service.snapshot("mega_645", AnalysisWindow("all_time")).context.actual_draw_count == 3
    empty = service.snapshot(
        "lotto_535",
        AnalysisWindow("date_range", from_date=date(2099, 2, 1), to_date=date(2099, 2, 2)),
    )
    assert empty.context.actual_draw_count == 0
    assert empty.context.as_of_draw_id == "90003"
    with pytest.raises(CutoffNotFoundError):
        service.snapshot("lotto_535", last, as_of_draw_id="99999")
    with pytest.raises(CutoffNotFoundError):
        service.snapshot("lotto_535", last, as_of_draw_id="bad")


@pytest.mark.integration
def test_empty_game_and_window_validation(engine) -> None:
    service = AnalyticsService(engine)
    context, numbers = service.numbers("lotto_535", AnalysisWindow("all_time"))
    assert context.as_of_draw_id is None and context.actual_draw_count == 0
    assert len(numbers) == 35
    assert all(item.frequency == 0 and item.frequency_percent is None for item in numbers)
    assert all(item.current_gap is None and item.last_seen_draw_id is None for item in numbers)
    _, empty_pairs = service.pairs("lotto_535", AnalysisWindow("all_time"), page_size=1)
    assert empty_pairs.total == 595
    assert empty_pairs.items[0].frequency == 0
    assert empty_pairs.items[0].percent_of_draws is None
    for values in (
        {"kind": "last_draws", "count": 9},
        {"kind": "date_range", "from_date": date(2099, 1, 2), "to_date": date(2099, 1, 1)},
        {"kind": "all_time", "count": 10},
    ):
        with pytest.raises(DomainValidationError):
            AnalysisWindow(**values)


@pytest.mark.integration
@pytest.mark.parametrize("game", ["lotto_535", "mega_645"])
def test_frequency_gap_pair_formulas_and_ties(engine, game: str) -> None:
    seed_fixture(engine)
    service = AnalyticsService(engine)
    window = AnalysisWindow("all_time")
    max_number = get_game(game).main_max
    context, values = service.numbers(game, window)
    assert context.actual_draw_count == 3
    assert len(values) == max_number
    by_number = {item.number: item for item in values}
    assert (
        by_number[2].frequency,
        by_number[2].frequency_percent,
        by_number[2].frequency_rank,
    ) == (3, 100, 1)
    assert (by_number[1].frequency, by_number[1].frequency_rank, by_number[1].current_gap) == (
        2,
        2,
        1,
    )
    assert by_number[1].frequency_percent == pytest.approx(200 / 3)
    assert by_number[1].average_gap == by_number[1].max_gap == 0
    assert by_number[3].frequency_rank == 2
    assert by_number[3].average_gap == by_number[3].max_gap == 1
    assert by_number[3].last_seen_draw_id == "90003"
    assert by_number[4].current_gap == 2
    assert by_number[4].average_gap is None and by_number[4].max_gap is None
    assert by_number[max_number].frequency == 0
    assert by_number[max_number].current_gap is None
    assert by_number[max_number].frequency_percent == 0
    assert [
        item.number for item in service.numbers(game, window, sort="frequency_desc")[1][:3]
    ] == [2, 1, 3]
    assert [
        item.number for item in service.numbers(game, window, sort="frequency_asc")[1][:2]
    ] == list(range(15 if game == "mega_645" else 12, 17 if game == "mega_645" else 14))
    assert service.numbers(game, window, sort="gap_desc")[1][-1].current_gap is None
    assert service.numbers(game, window, sort="frequency_desc") == service.numbers(
        game, window, sort="frequency_desc"
    )

    _, pair_page = service.pairs(game, window, min_frequency=1)
    assert pair_page.items[0].numbers == (1, 2)
    assert pair_page.items[0].frequency == 2
    assert pair_page.items[0].percent_of_draws == pytest.approx(200 / 3)
    assert pair_page.items[0].current_gap == 1
    assert pair_page.items[0].average_gap == pair_page.items[0].max_gap == 0
    pair_23 = service.pair_detail(game, 3, 2, window)
    assert pair_23.metrics.numbers == (2, 3)
    assert pair_23.metrics.frequency == 2
    assert pair_23.metrics.average_gap == pair_23.metrics.max_gap == 1
    assert pair_23.timeline_draw_ids == ("90003", "90001")
    _, all_pairs = service.pairs(game, window, page=2, page_size=1)
    assert all_pairs.total == max_number * (max_number - 1) // 2
    assert len(all_pairs.items) == 1
    assert service.pairs(game, window, min_frequency=4)[1].total == 0
    assert service.pairs(game, window, page=2, page_size=1) == service.pairs(
        game, window, page=2, page_size=1
    )
    with pytest.raises(DomainValidationError):
        service.pairs(game, window, page_size=101)


@pytest.mark.integration
def test_history_filters_paging_details_and_consistency_after_correction(engine) -> None:
    seed_fixture(engine)
    history = DrawHistoryService(engine)
    service = AnalyticsService(engine)
    window = AnalysisWindow("all_time")
    assert history.latest("lotto_535").draw_id == "90003"
    assert history.by_id("mega_645", "90002").draw_id == "90002"
    assert history.by_id("lotto_535", "90004") is None
    same_day = history.list_draws(
        "lotto_535", from_date=date(2099, 1, 1), to_date=date(2099, 1, 1), page_size=1
    )
    assert same_day.total == 2 and [item.draw_id for item in same_day.items] == ["90002"]
    assert [item.draw_id for item in history.list_draws("lotto_535", sort="asc").items] == [
        "90001",
        "90002",
        "90003",
    ]
    assert history.list_draws("lotto_535", page=9).items == ()
    assert [item.draw_id for item in history.containing_number("lotto_535", 1).items] == [
        "90002",
        "90001",
    ]
    assert [item.draw_id for item in history.containing_pair("lotto_535", 2, 1).items] == [
        "90002",
        "90001",
    ]
    assert [
        item.draw_id for item in history.containing_combination("lotto_535", (5, 4, 3, 2, 1)).items
    ] == ["90001"]
    assert history.containing_number("mega_645", 35).total == 0

    number = service.number_detail("lotto_535", 1, window, page_size=1)
    assert number.metrics.frequency == number.appearance_draws.total == 2
    assert number.timeline_draw_ids == ("90002",)
    assert number.pair_partners[0].numbers == (1, 2)
    assert number.pair_partners[0].frequency == 2
    pair = service.pair_detail("lotto_535", 1, 2, window, page=2, page_size=1)
    assert pair.metrics.frequency == pair.appearance_draws.total == 2
    assert pair.timeline_draw_ids == ("90001",)

    with Session(engine) as session, session.begin():
        repo = DrawRepository(session)
        original = repo.get_by_id("lotto_535", "90003")
        correction_id = repo.add(replace(original, main_numbers=(3, 9, 10, 11, 12))).correction_id
        assert correction_id is not None
        repo.apply_correction(correction_id, reason="verified test correction")
    refreshed = service.number_detail("lotto_535", 2, window)
    assert refreshed.context.data_version == 4
    assert refreshed.metrics.frequency == refreshed.appearance_draws.total == 2
    assert refreshed.metrics.last_seen_draw_id == "90002"
    assert refreshed.timeline_draw_ids == ("90002", "90001")
    assert service.pair_detail("lotto_535", 2, 3, window).metrics.frequency == 1


@pytest.mark.integration
def test_last_ten_and_date_window_details_share_exact_draw_set(engine) -> None:
    with Session(engine) as session, session.begin():
        repo = DrawRepository(session)
        for seq in range(1, 12):
            main = (1, 2, 3, 4, 5) if seq % 2 else (2, 3, 4, 5, 6)
            repo.add(make_draw("lotto_535", f"{seq:05d}", date(2099, 1, seq), main, special=12))
    service = AnalyticsService(engine)
    window = AnalysisWindow("last_draws", count=10)
    snapshot = service.snapshot("lotto_535", window)
    assert [draw.draw_id for draw in snapshot.draws] == [f"{seq:05d}" for seq in range(2, 12)]
    detail = service.number_detail("lotto_535", 1, window)
    assert detail.metrics.frequency == detail.appearance_draws.total == 5
    assert detail.timeline_draw_ids == ("00011", "00009", "00007", "00005", "00003")
    assert service.number_detail("lotto_535", 12, window).metrics.frequency == 0
    assert service.number_detail("lotto_535", 12, window).pair_partners == ()
    assert service.pair_detail("lotto_535", 12, 2, window).metrics.frequency == 0
    cutoff = service.pair_detail("lotto_535", 1, 2, window, as_of_draw_id="00008")
    assert cutoff.context.actual_draw_count == 8
    assert cutoff.metrics.frequency == cutoff.appearance_draws.total == 4
