"""MVP HTTP contract and source-to-PostgreSQL-to-API integration."""

import os
from datetime import UTC, date, datetime
from pathlib import Path
from threading import current_thread
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.analytics.service import AnalyticsService
from app.db.session import get_engine
from app.domain.draw import Draw
from app.ingestion.service import IngestionService
from app.main import create_app
from app.repositories.draws import DrawRepository

FIXTURES = Path(__file__).parent / "fixtures" / "vietlott"


@pytest.fixture
def engine():
    url = os.getenv("LOTTO_TEST_DATABASE_URL", "")
    if not url or not urlsplit(url).path.endswith("_test"):
        pytest.fail("LOTTO_TEST_DATABASE_URL must point to a dedicated *_test database")
    db_engine = create_engine(url)
    with db_engine.begin() as connection:
        assert connection.dialect.name == "postgresql"
        connection.execute(
            text(
                "TRUNCATE ingestion_items, ingestion_runs, ingestion_checkpoints, "
                "draw_corrections, draws, game_data_state RESTART IDENTITY"
            )
        )
    yield db_engine
    db_engine.dispose()


@pytest.fixture
def client(engine):
    application = create_app()
    application.dependency_overrides[get_engine] = lambda: engine
    with TestClient(application, raise_server_exceptions=False) as test_client:
        yield test_client


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
        repository = DrawRepository(session)
        for game, draw_id, day, main, special in fixture:
            repository.add(
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
def test_games_history_status_and_errors(client, engine) -> None:
    games = client.get("/api/v1/games").json()["items"]
    assert games[0]["main_count"] == 5
    assert games[0]["label"] == "Lotto 5/35" and games[0]["special_min"] == 1
    assert games[1]["special_min"] is None
    assert client.get("/api/v1/games/lotto_535/draws/latest").json()["error"]["code"] == "no_draws"
    assert client.get("/api/v1/games/unknown/draws").status_code == 404
    seed(engine)
    base = "/api/v1/games/lotto_535"
    latest = client.get(base + "/draws/latest")
    assert latest.status_code == 200
    assert latest.json()["draw_id"] == "90003"
    assert latest.json()["source_retrieved_at"].endswith("Z")
    page = client.get(
        base + "/draws",
        params={
            "from_date": "2099-01-01",
            "to_date": "2099-01-01",
            "page_size": 1,
        },
    ).json()
    assert page["total"] == 2 and page["items"][0]["draw_id"] == "90002"
    assert client.get(base + "/draws", params={"page": 9}).json()["items"] == []
    assert client.get(base + "/draws/90001").json()["special_number"] == 1
    assert client.get(base + "/draws/90004").json()["error"]["code"] == "draw_not_found"
    assert (
        client.get(
            base + "/draws", params={"from_date": "2099-02-01", "to_date": "2099-01-01"}
        ).status_code
        == 422
    )
    assert client.get(base + "/draws", params={"page_size": 101}).status_code == 422
    status = client.get(base + "/status").json()
    assert status["latest_draw_id"] == "90003" and status["data_version"] == 3


@pytest.mark.integration
@pytest.mark.parametrize("game", ["lotto_535", "mega_645"])
def test_analytics_checker_generator_api(client, engine, game: str) -> None:
    seed(engine)
    base = f"/api/v1/games/{game}"
    query = {"window": "last_draws", "count": 10}
    numbers = client.get(base + "/analytics/numbers", params=query)
    assert numbers.status_code == 200, numbers.text
    data = numbers.json()
    assert data["context"]["actual_draw_count"] == 3
    assert data["items"][1]["frequency"] == 3
    assert data["items"][1]["current_gap"] == 0
    assert len(data["items"]) == (35 if game == "lotto_535" else 45)
    cutoff_data = client.get(
        base + "/analytics/numbers",
        params={
            **query,
            "as_of_draw_id": "90002",
        },
    ).json()
    assert cutoff_data["context"]["actual_draw_count"] == 2
    assert cutoff_data["context"]["as_of_draw_id"] == "90002"
    pairs = client.get(base + "/analytics/pairs", params={**query, "page_size": 1}).json()
    assert pairs["items"][0]["numbers"] == [1, 2]
    assert pairs["items"][0]["frequency"] == 2
    number = client.get(base + "/analytics/numbers/1", params={**query, "page_size": 1}).json()
    assert number["metrics"]["frequency"] == number["appearance_draws"]["total"] == 2
    assert len(number["appearance_draws"]["items"]) == 1
    pair = client.get(base + "/analytics/pairs/2/1", params=query).json()
    assert pair["metrics"]["numbers"] == [1, 2]
    assert pair["appearance_draws"]["total"] == 2
    assert (
        client.get(base + "/analytics/numbers", params={"window": "last_draws"}).status_code == 422
    )
    assert (
        client.get(
            base + "/analytics/numbers",
            params={
                "window": "date_range",
                "from_date": "2000-01-01",
                "to_date": "2099-01-01",
            },
        ).status_code
        == 422
    )
    assert client.get(base + "/analytics/pairs/1/1", params=query).status_code == 422
    assert (
        client.get(
            base + "/analytics/numbers", params={**query, "as_of_draw_id": "99999"}
        ).status_code
        == 404
    )
    assert (
        client.get(
            base + "/analytics/numbers",
            params={
                **query,
                "as_of_draw_id": "bad",
            },
        ).status_code
        == 404
    )
    candidate = [5, 4, 3, 2, 1] if game == "lotto_535" else [6, 5, 4, 3, 2, 1]
    checked = client.post(
        base + "/combinations/check",
        json={
            "main_numbers": candidate,
            "analysis_window": {"kind": "last_draws", "count": 10},
            "similar_page_size": 1,
        },
    )
    assert checked.status_code == 200, checked.text
    result = checked.json()
    assert result["exact_match_count"] == 1
    assert result["overlap_histogram"][f"match_{len(candidate)}"] == 1
    assert result["similar_draws"]["total"] == 3
    assert result["pair_analysis"][0]["frequency"] == pairs["items"][0]["frequency"]
    no_match = client.post(
        base + "/combinations/check",
        json={
            "main_numbers": list(range(20, 20 + len(candidate))),
            "analysis_window": {"kind": "all_time"},
        },
    )
    assert no_match.status_code == 200
    assert no_match.json()["exact_match_count"] == 0
    assert no_match.json()["last_exact_match"] is None
    assert (
        client.post(
            base + "/combinations/check",
            json={
                "main_numbers": candidate,
                "analysis_window": {"kind": "all_time"},
                "similar_page_size": 101,
            },
        ).status_code
        == 422
    )
    assert (
        client.post(
            base + "/combinations/check",
            json={
                "main_numbers": [True, *candidate[1:]],
                "analysis_window": {"kind": "all_time"},
            },
        ).status_code
        == 422
    )
    assert (
        client.post(
            base + "/combinations/check",
            json={
                "main_numbers": candidate,
                "analysis_window": {"kind": "all_time"},
                "special_number": 1,
            },
        ).status_code
        == 422
    )
    generated = client.post(
        base + "/combinations/generate",
        json={
            "analysis_window": {"kind": "last_draws", "count": 10},
            "requested_count": 2,
            "seed": 42,
            "reference_date": "2099-01-04",
            "rules": {},
        },
    )
    assert generated.status_code == 200, generated.text
    output = generated.json()
    assert output["status"] == "complete" and output["generated_count"] == 2
    assert output["context"]["game"] == game
    assert output["items"][0]["explanation"]["rule_results"] == []
    assert (
        output
        == client.post(
            base + "/combinations/generate",
            json={
                "analysis_window": {"kind": "last_draws", "count": 10},
                "requested_count": 2,
                "seed": 42,
                "reference_date": "2099-01-04",
                "rules": {},
            },
        ).json()
    )
    assert (
        client.post(
            base + "/combinations/generate",
            json={
                "analysis_window": {"kind": "all_time"},
                "requested_count": 21,
                "rules": {},
            },
        ).status_code
        == 422
    )
    assert (
        client.post(
            base + "/combinations/generate",
            json={
                "analysis_window": {"kind": "all_time"},
                "requested_count": 1,
                "rules": {"sum_range": {"min": 1, "max": 2}},
            },
        ).json()["error"]["code"]
        == "invalid_rules"
    )
    minimum_sum = 15 if game == "lotto_535" else 21
    partial = client.post(
        base + "/combinations/generate",
        json={
            "analysis_window": {"kind": "all_time"},
            "requested_count": 1,
            "seed": 7,
            "reference_date": "2099-01-04",
            "rules": {"sum_range": {"min": minimum_sum, "max": minimum_sum}},
        },
    )
    assert partial.status_code == 200
    assert partial.json()["status"] == "partial"
    assert partial.json()["reason"] == "search_limit"
    assert partial.json()["attempted_count"] == 1000


class FixtureFetcher:
    def __init__(self, game_code: str, latest: str) -> None:
        self.game_code = game_code
        self.latest = latest

    def fetch(self, url: str) -> tuple[str, datetime]:
        draw_id = parse_qs(urlsplit(url).query).get("id", [self.latest])[0]
        return (FIXTURES / f"{self.game_code}_{draw_id}.html").read_text(
            encoding="utf-8"
        ), datetime(2026, 10, 1, tzinfo=UTC)


@pytest.mark.integration
def test_official_fixture_ingestion_to_api(client, engine) -> None:
    assert (
        IngestionService(engine, FixtureFetcher("535", "00830"))
        .import_history("lotto_535", start_id="00829", end_id="00830")
        .status
        == "success"
    )
    assert (
        IngestionService(engine, FixtureFetcher("645", "01530"))
        .import_history("mega_645", start_id="01530", end_id="01530")
        .status
        == "success"
    )
    for game, expected_id, count in (("lotto_535", "00830", 2), ("mega_645", "01530", 1)):
        base = f"/api/v1/games/{game}"
        draw = client.get(base + "/draws/latest").json()
        assert draw["draw_id"] == expected_id
        assert draw["source_url"].startswith("https://vietlott.vn/")
        assert client.get(base + "/status").json()["latest_draw_id"] == expected_id
        assert client.get(base + "/status").json()["last_successful_ingestion_at"].endswith("Z")
        query = {"window": "all_time"}
        numbers = client.get(base + "/analytics/numbers", params=query).json()
        assert numbers["context"]["actual_draw_count"] == count
        for number in draw["main_numbers"]:
            assert (
                next(item for item in numbers["items"] if item["number"] == number)["frequency"]
                >= 1
            )
        pairs = client.get(base + "/analytics/pairs", params=query).json()
        assert pairs["items"][0]["frequency"] >= 1
        checked = client.post(
            base + "/combinations/check",
            json={
                "main_numbers": draw["main_numbers"],
                "analysis_window": {"kind": "all_time"},
            },
        ).json()
        assert checked["exact_match_count"] >= 1
        generated = client.post(
            base + "/combinations/generate",
            json={
                "analysis_window": {"kind": "all_time"},
                "requested_count": 1,
                "seed": 4,
                "reference_date": "2026-10-01",
                "rules": {},
            },
        ).json()
        assert generated["generated_count"] == 1


def test_openapi_and_internal_error_redaction(client) -> None:
    schema = client.get("/openapi.json").json()
    assert "/api/v1/games/{game}/combinations/generate" in schema["paths"]
    no_history = client.post(
        "/api/v1/games/lotto_535/combinations/generate",
        json={
            "analysis_window": {"kind": "all_time"},
            "requested_count": 1,
            "seed": 1,
            "rules": {"max_overlap_previous_draw": {"max": 1}},
        },
    )
    assert no_history.status_code == 409
    assert no_history.json()["error"]["code"] == "insufficient_history"

    def broken_engine():
        raise RuntimeError("secret SQL connection string")

    client.app.dependency_overrides[get_engine] = broken_engine
    failure = client.get("/api/v1/games/lotto_535/draws/latest")
    assert failure.status_code == 500
    assert failure.json()["error"]["code"] == "internal_error"
    assert "secret" not in failure.text


@pytest.mark.integration
def test_analytics_route_runs_service_in_worker_thread(client, monkeypatch) -> None:
    seen: list[str] = []
    original = AnalyticsService.numbers

    def observed(self, *args, **kwargs):
        seen.append(current_thread().name)
        return original(self, *args, **kwargs)

    monkeypatch.setattr(AnalyticsService, "numbers", observed)
    response = client.get("/api/v1/games/lotto_535/analytics/numbers?window=all_time")
    assert response.status_code == 200
    assert len(seen) == 1 and "worker" in seen[0].lower()
