"""Manual collection uses the real PostgreSQL pipeline, without live source I/O."""

from pathlib import Path

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session
from test_api_v1 import client as client
from test_api_v1 import engine as engine
from test_ingestion_service import FixtureFetcher

from app.api.v1 import get_sync_service
from app.ingestion.service import IngestionService
from app.models.draw import DrawRow
from app.models.ingestion import IngestionItemRow, IngestionRunRow
from app.services.sync import ManualSyncService

FIXTURES = Path(__file__).parent / "fixtures" / "vietlott"


@pytest.mark.integration
@pytest.mark.parametrize("old_backlog", [False, True])
@pytest.mark.parametrize(
    "game,code", [("lotto_535", "535"), ("mega_645", "645"), ("power_655", "655")]
)
def test_manual_sync_persists_selected_game_and_throttles_repeated_clicks(
    client, engine, game, code, old_backlog
):
    filename = f"{code}_00001" + ("_prizes" if code == "655" else "") + ".html"
    fetcher = FixtureFetcher(
        latest="00001", pages={"00001": (FIXTURES / filename).read_text(encoding="utf-8")}
    )
    assert IngestionService(engine, fetcher).import_history(game).status == "success"
    if old_backlog:
        with Session(engine) as session, session.begin():
            session.get(IngestionItemRow, (game, 1)).status = "failed"
    fetcher.latest = "00002"
    fetcher.pages["00002"] = str(fetcher.pages["00001"]).replace("#00001", "#00002")
    fetcher.calls.clear()
    client.app.dependency_overrides[get_sync_service] = lambda: ManualSyncService(engine, fetcher)
    path = f"/api/v1/games/{game}/sync"
    response = client.post(path, json={})
    assert response.status_code == 200, response.text
    assert response.json()["created"] == 1
    assert response.json()["game"] == game
    assert response.json()["remaining_unresolved"] == int(old_backlog)
    assert response.json()["status"] == ("partial" if old_backlog else "success")
    assert client.get(f"/api/v1/games/{game}/draws/latest").json()["draw_id"] == "00002"
    assert fetcher.calls == ["00002"]
    assert client.post(path, json={}).status_code == 429
    assert fetcher.calls == ["00002"]
    assert client.get(path).status_code == 405
    with engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE ingestion_runs SET finished_at=clock_timestamp()-interval '61 seconds' "
                "WHERE id=:id"
            ),
            {"id": response.json()["run_id"]},
        )
    repeated = client.post(path, json={})
    assert repeated.status_code == 200
    assert repeated.json()["created"] == 0
    assert repeated.json()["unchanged"] == 1
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(DrawRow)) == 2


@pytest.mark.integration
def test_manual_sync_errors_and_locks_do_not_report_success(client, engine):
    fetcher = FixtureFetcher(latest="00001", pages={})
    client.app.dependency_overrides[get_sync_service] = lambda: ManualSyncService(engine, fetcher)
    path = "/api/v1/games/lotto_535/sync"
    assert client.post("/api/v1/games/unknown/sync", json={}).status_code == 404
    assert fetcher.calls == []
    with engine.connect() as connection:
        connection.execute(text("SELECT pg_advisory_lock(5044, 1)"))
        try:
            busy = client.post(path, json={})
            assert busy.status_code == 409
            assert busy.json()["error"]["code"] == "ingestion_busy"
            assert fetcher.calls == []
        finally:
            connection.execute(text("SELECT pg_advisory_unlock(5044, 1)"))
    response = client.post(path, json={})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "sync_source_unavailable"
    with Session(engine) as session:
        assert session.scalar(select(IngestionRunRow.status)) == "failed"
    assert client.post(path, json={}).status_code == 429
    assert client.post(path).status_code == 422
    assert client.post(path, data={"unused": "value"}).status_code == 422
