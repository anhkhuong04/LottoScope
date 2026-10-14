"""Hand-calculated Power analytics and HTTP contracts across all existing endpoints."""

from datetime import UTC, date, datetime

import pytest
from sqlalchemy.orm import Session
from test_api_v1 import client as client
from test_api_v1 import engine as engine
from test_power_ingestion import parse_power, power_html

from app.domain.draw import Draw
from app.repositories.draws import DrawRepository

pytestmark = pytest.mark.integration
BASE = "/api/v1/games/power_655"


def seed_power(engine) -> None:
    with Session(engine) as session, session.begin():
        repo = DrawRepository(session)
        for seq, main, special in (
            (1, (1, 2, 3, 4, 54, 55), 53),
            (2, (1, 2, 7, 8, 9, 10), 55),
            (3, (2, 3, 11, 12, 13, 14), 54),
        ):
            repo.add(
                Draw(
                    game="power_655",
                    draw_id=f"{90000 + seq:05d}",
                    draw_date=date(2099, 1, seq),
                    draw_time=None,
                    main_numbers=main,
                    special_number=special,
                    source_url="https://example.test/synthetic-power-fixture",
                    source_retrieved_at=datetime(2099, 1, 4, tzinfo=UTC),
                )
            )
        repo.add(
            Draw(
                game="mega_645",
                draw_id="90001",
                draw_date=date(2099, 1, 1),
                draw_time=None,
                main_numbers=(1, 2, 3, 4, 5, 6),
                special_number=None,
                source_url="https://example.test/synthetic-mega-fixture",
                source_retrieved_at=datetime(2099, 1, 4, tzinfo=UTC),
            )
        )


def test_power_empty_context_and_game_definition(client) -> None:
    games = client.get("/api/v1/games").json()["items"]
    power = next(game for game in games if game["id"] == "power_655")
    assert power == {
        "id": "power_655",
        "label": "Power 6/55",
        "main_count": 6,
        "main_min": 1,
        "main_max": 55,
        "special_min": 1,
        "special_max": 55,
    }
    assert client.get(BASE + "/draws/latest").json()["error"]["code"] == "no_draws"
    response = client.get(BASE + "/analytics/numbers?window=all_time").json()
    assert len(response["items"]) == 55
    assert response["context"]["actual_draw_count"] == 0
    assert response["context"]["as_of_draw_id"] is None
    assert response["items"][-1]["frequency"] == 0
    assert response["items"][-1]["current_gap"] is None


def test_power_hand_calculated_frequency_gaps_pairs_and_cutoff(client, engine) -> None:
    seed_power(engine)
    response = client.get(BASE + "/analytics/numbers?window=all_time").json()
    assert response["context"]["actual_draw_count"] == 3
    numbers = {item["number"]: item for item in response["items"]}
    assert (numbers[2]["frequency"], numbers[2]["current_gap"], numbers[2]["average_gap"]) == (
        3,
        0,
        0,
    )
    assert (numbers[3]["frequency"], numbers[3]["average_gap"], numbers[3]["max_gap"]) == (2, 1, 1)
    assert (numbers[55]["frequency"], numbers[55]["current_gap"]) == (1, 2)
    assert (numbers[54]["frequency"], numbers[54]["current_gap"]) == (1, 2)
    assert (numbers[53]["frequency"], numbers[53]["current_gap"]) == (0, None)
    pairs = client.get(BASE + "/analytics/pairs?window=all_time&page_size=100").json()
    assert pairs["total"] == 1485
    pair = client.get(BASE + "/analytics/pairs/55/54?window=all_time").json()
    assert pair["metrics"]["numbers"] == [54, 55]
    assert pair["metrics"]["frequency"] == pair["appearance_draws"]["total"] == 1
    number = client.get(BASE + "/analytics/numbers/55?window=all_time").json()
    assert number["appearance_draws"]["total"] == 1  # special at P2 is excluded
    cutoff = client.get(BASE + "/analytics/numbers?window=all_time&as_of_draw_id=90002").json()
    assert cutoff["context"]["actual_draw_count"] == 2
    assert cutoff["items"][1]["frequency"] == 2
    day = client.get(BASE + "/draws?from_date=2099-01-02&to_date=2099-01-02").json()
    assert day["total"] == 1 and day["items"][0]["draw_id"] == "90002"
    assert client.get(BASE + "/draws?page=2&page_size=1").json()["items"][0]["draw_id"] == "90002"
    assert client.get(BASE + "/analytics/numbers/56?window=all_time").status_code == 422
    assert client.get(BASE + "/analytics/pairs/1/56?window=all_time").status_code == 422


def test_power_checker_remains_main_only_with_exact_k_overlap(client, engine) -> None:
    seed_power(engine)
    body = {"main_numbers": [55, 54, 4, 3, 2, 1], "analysis_window": {"kind": "all_time"}}
    checked = client.post(BASE + "/combinations/check", json=body).json()
    assert checked["history_draw_count"] == 3
    assert checked["exact_match_count"] == 1
    assert checked["main_numbers"] == [1, 2, 3, 4, 54, 55]
    assert checked["overlap_histogram"] == {
        "match_0": 0,
        "match_1": 0,
        "match_2": 2,
        "match_3": 0,
        "match_4": 0,
        "match_5": 0,
        "match_6": 1,
    }
    assert len(checked["pair_analysis"]) == 15
    assert checked["similar_draws"]["items"][0]["draw"]["special_number"] == 53
    for main in ([1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 56], [1, 2, 3, 4, 5, 5], [1, 2, 3, 4, 5, True]):
        assert (
            client.post(
                BASE + "/combinations/check", json=body | {"main_numbers": main}
            ).status_code
            == 422
        )
    assert (
        client.post(BASE + "/combinations/check", json=body | {"special_number": 53}).status_code
        == 422
    )


def test_power_generator_rules_reproducibility_and_explanation(client, engine) -> None:
    seed_power(engine)
    body = {
        "analysis_window": {"kind": "all_time"},
        "requested_count": 3,
        "seed": 42,
        "reference_date": "2099-01-04",
        "rules": {
            "exclude_exact_within_days": {"days": 30},
            "max_overlap_previous_draw": {"max": 3},
            "minimum_historical_pair_frequency": {"min_count": 1},
            "exclude_bottom_frequency_numbers": {"n": 1},
            "odd_even_ratio": {"odd": 3, "even": 3},
            "sum_range": {"min": 80, "max": 250},
        },
    }
    response = client.post(BASE + "/combinations/generate", json=body)
    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "complete" and result["generated_count"] == 3
    assert client.post(BASE + "/combinations/generate", json=body).json() == result
    for item in result["items"]:
        main = item["main_numbers"]
        assert len(set(main)) == 6 and min(main) >= 1 and max(main) <= 55
        assert "special_number" not in item
        assert sum(number % 2 for number in main) == 3
        assert 80 <= sum(main) <= 250 and 5 not in main
        assert len(item["explanation"]["rule_results"]) == 6
        assert all(rule["passed"] for rule in item["explanation"]["rule_results"])
        assert len(item["explanation"]["historical_pairs"]) == 15
    for rules in (
        {"sum_range": {"min": 316, "max": 400}},
        {"odd_even_ratio": {"odd": 3, "even": 4}},
        {"exclude_bottom_frequency_numbers": {"n": 50}},
    ):
        assert (
            client.post(BASE + "/combinations/generate", json=body | {"rules": rules}).status_code
            == 422
        )


def test_power_prize_api_preserves_five_tiers_and_jackpot2(client, engine) -> None:
    draw = parse_power(power_html("01385"), "01385")
    with Session(engine) as session, session.begin():
        DrawRepository(session).add(draw)
    response = client.get(BASE + "/draws/01385/prizes")
    assert response.status_code == 200
    tiers = response.json()["items"]
    assert len(tiers) == 5
    assert tiers[0]["amount_vnd"] == "32326470750"
    assert tiers[1]["amount_vnd"] == "3258496750"
    assert tiers[1]["matches"] == [{"main_count": 5, "special": True}]
    assert tiers[1]["winner_count"] == 0
