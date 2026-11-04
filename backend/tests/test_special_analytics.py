"""Lotto special fixtures deliberately share values with main numbers."""

from datetime import date

import pytest
from sqlalchemy.orm import Session
from test_analytics import engine as engine
from test_analytics import make_draw
from test_api_v1 import client as client

from app.analytics.metrics import number_metrics, pair_metrics
from app.analytics.service import AnalysisWindow, AnalyticsService
from app.repositories.draws import DrawRepository


def draws():
    return (
        make_draw("lotto_535", "90001", date(2099, 1, 1), (1, 2, 3, 4, 5), special=1),
        make_draw("lotto_535", "90002", date(2099, 1, 1), (1, 2, 6, 7, 8), special=2),
        make_draw("lotto_535", "90003", date(2099, 1, 2), (2, 3, 9, 10, 11), special=1),
        make_draw("lotto_535", "90004", date(2099, 1, 3), (6, 7, 8, 9, 10), special=3),
        make_draw("lotto_535", "90005", date(2099, 1, 4), (6, 7, 8, 9, 10), special=1),
    )


def test_special_frequency_recency_dense_ties_and_main_isolation():
    values = number_metrics("lotto_535", draws(), number_kind="special")
    assert len(values) == 12
    assert sum(row.frequency for row in values) == 5
    first, second, third, never = values[:4]
    assert (first.frequency, first.frequency_percent, first.frequency_rank) == (3, 60.0, 1)
    assert (first.current_gap, first.average_gap, first.max_gap, first.last_seen_draw_id) == (
        0,
        1,
        1,
        "90005",
    )
    assert (second.frequency_rank, third.frequency_rank, never.frequency_rank) == (2, 2, 3)
    assert second.current_gap == 3 and second.average_gap is None
    assert never.frequency == 0 and never.current_gap is None and never.last_seen_draw_id is None
    assert number_metrics("lotto_535", draws())[0].frequency == 2


def test_special_empty_window_has_zero_counts_and_unknown_recency():
    values = number_metrics("lotto_535", (), number_kind="special")
    assert len(values) == 12
    assert all(
        row.frequency == 0 and row.frequency_percent is None and row.current_gap is None
        for row in values
    )


@pytest.mark.parametrize("game", ["mega_645", "power_655"])
def test_special_analytics_rejects_other_games(game):
    with pytest.raises(ValueError):
        number_metrics(game, (), number_kind="special")


def test_pair_dense_rank_reflects_frequency_not_lexicographic_tie_break():
    pairs = pair_metrics("lotto_535", draws())
    by_pair = {row.numbers: row for row in pairs}
    assert by_pair[(6, 7)].frequency == 3
    assert by_pair[(6, 7)].frequency_rank == by_pair[(6, 8)].frequency_rank == 1
    assert by_pair[(1, 2)].frequency_rank == 2
    assert by_pair[(1, 35)].frequency_rank > by_pair[(1, 3)].frequency_rank


@pytest.mark.integration
def test_special_service_uses_real_special_column_and_inclusive_window(engine):
    with Session(engine) as session, session.begin():
        for draw in draws():
            DrawRepository(session).add(draw)
    service = AnalyticsService(engine)
    window = AnalysisWindow("all_time")
    context, values = service.numbers("lotto_535", window, number_kind="special")
    assert context.actual_draw_count == 5 and values[0].frequency == 3
    result = service.number_detail(
        "lotto_535", 1, window, number_kind="special", page=2, page_size=1
    )
    assert result.number_kind == "special" and result.pair_partners == ()
    assert result.appearance_draws.total == 3
    assert result.appearance_draws.items[0].draw_id == "90003"
    _, limited = service.numbers("lotto_535", window, number_kind="special", as_of_draw_id="90003")
    assert limited[0].frequency == 2 and limited[0].current_gap == 0
    _, same_day = service.numbers(
        "lotto_535",
        AnalysisWindow("date_range", from_date=date(2099, 1, 1), to_date=date(2099, 1, 1)),
        number_kind="special",
    )
    assert same_day[0].frequency_percent == 50 and same_day[1].frequency_percent == 50


@pytest.mark.integration
def test_special_api_contract_and_main_default(client, engine):
    with Session(engine) as session, session.begin():
        for draw in draws():
            DrawRepository(session).add(draw)
    base = "/api/v1/games/lotto_535/analytics/numbers"
    response = client.get(base + "?window=all_time&number_kind=special&sort=frequency_desc")
    assert response.status_code == 200
    payload = response.json()
    assert payload["number_kind"] == "special" and len(payload["items"]) == 12
    assert payload["items"][0]["frequency"] == 3
    assert client.get(base + "?window=all_time").json()["items"][0]["frequency"] == 2
    detail = client.get(base + "/1?window=all_time&number_kind=special").json()
    assert detail["pair_partners"] == [] and detail["appearance_draws"]["total"] == 3
    assert client.get(base + "/13?window=all_time&number_kind=special").status_code == 422
    assert client.get(base + "?window=all_time&number_kind=unknown").status_code == 422
    for game in ("mega_645", "power_655"):
        assert (
            client.get(
                f"/api/v1/games/{game}/analytics/numbers?window=all_time&number_kind=special"
            ).status_code
            == 422
        )


@pytest.mark.integration
def test_special_detail_clips_same_day_cutoff_and_empty_date_window(engine):
    with Session(engine) as session, session.begin():
        for draw in draws():
            DrawRepository(session).add(draw)
    service = AnalyticsService(engine)
    day = AnalysisWindow("date_range", from_date=date(2099, 1, 1), to_date=date(2099, 1, 1))
    first = service.number_detail("lotto_535", 1, day, number_kind="special", as_of_draw_id="90001")
    assert first.context.actual_draw_count == first.appearance_draws.total == 1
    assert first.timeline_draw_ids == ("90001",)
    second = service.number_detail(
        "lotto_535", 2, day, number_kind="special", as_of_draw_id="90002"
    )
    assert second.context.actual_draw_count == 2 and second.metrics.frequency_percent == 50
    assert second.timeline_draw_ids == ("90002",)
    empty = service.number_detail(
        "lotto_535",
        1,
        AnalysisWindow("date_range", from_date=date(2099, 2, 1), to_date=date(2099, 2, 2)),
        number_kind="special",
    )
    assert empty.context.actual_draw_count == empty.appearance_draws.total == 0
    assert empty.appearance_draws.items == () and empty.timeline_draw_ids == ()
    assert empty.metrics.frequency == 0 and empty.metrics.last_seen_draw_id is None


@pytest.mark.integration
def test_special_detail_last_ten_excludes_older_appearances_and_other_game(engine):
    with Session(engine) as session, session.begin():
        repo = DrawRepository(session)
        for index in range(1, 13):
            repo.add(
                make_draw(
                    "lotto_535",
                    f"{90000 + index:05d}",
                    date(2099, 1, index),
                    (1, 2, 3, 4, 5),
                    special=1 if index in (1, 2, 3, 12) else 2,
                )
            )
        repo.add(make_draw("power_655", "90012", date(2099, 1, 12), (2, 3, 4, 5, 6, 7), special=1))
    result = AnalyticsService(engine).number_detail(
        "lotto_535", 1, AnalysisWindow("last_draws", count=10), number_kind="special"
    )
    assert result.context.actual_draw_count == 10
    assert result.metrics.frequency == result.appearance_draws.total == 2
    assert result.metrics.frequency_percent == 20
    assert result.timeline_draw_ids == ("90012", "90003")
    assert result.metrics.average_gap == result.metrics.max_gap == 8
