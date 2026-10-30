"""Cloud requests must pass through the gateway; local access remains unchanged."""

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import IngressSettings, Settings
from app.main import create_app

TOKEN = "test-origin-token-not-a-real-secret-12345"


def test_cloud_startup_requires_a_token(monkeypatch) -> None:
    monkeypatch.setenv("LOTTO_DEPLOYMENT_MODE", "cloud")
    monkeypatch.delenv("LOTTO_ORIGIN_TOKEN", raising=False)
    with pytest.raises(ValidationError, match="requires LOTTO_ORIGIN_TOKEN"):
        create_app()


def test_cloud_token_never_appears_in_settings_repr() -> None:
    settings = IngressSettings(deployment_mode="cloud", origin_token=TOKEN)
    assert TOKEN not in repr(settings)


def test_cloud_access_is_guarded_and_liveness_needs_no_database(monkeypatch) -> None:
    monkeypatch.setenv("LOTTO_DEPLOYMENT_MODE", "cloud")
    monkeypatch.setenv("LOTTO_ORIGIN_TOKEN", TOKEN)
    monkeypatch.setenv("LOTTO_SCHEDULER_ENABLED", "false")
    monkeypatch.delenv("LOTTO_DATABASE_URL", raising=False)
    with TestClient(create_app()) as client:
        assert client.get("/health/live").json() == {"status": "ok"}
        for path in ("/api/v1/games", "/health/ready", "/docs", "/openapi.json", "/unknown"):
            response = client.get(path)
            assert response.status_code == 401
            assert response.json()["error"]["code"] == "unauthorized"
            assert response.headers["cache-control"] == "no-store"
        assert client.post("/health/live").status_code == 401
        assert (
            client.get("/api/v1/games", headers={"X-Lotto-Origin-Token": "wrong"}).status_code
            == 401
        )
        assert (
            client.get(
                "/api/v1/games",
                headers=[("X-Lotto-Origin-Token", TOKEN), ("X-Lotto-Origin-Token", TOKEN)],
            ).status_code
            == 401
        )
        headers = {"X-Lotto-Origin-Token": TOKEN}
        games = client.get("/api/v1/games", headers=headers)
        assert games.status_code == 200
        assert len(games.json()["items"]) == 3
        assert client.get("/api/v1/nonexistent", headers=headers).status_code == 404
        assert client.get("/docs", headers=headers).status_code == 404
        assert client.get("/openapi.json", headers=headers).status_code == 404


def test_local_access_remains_available(monkeypatch) -> None:
    monkeypatch.setenv("LOTTO_DEPLOYMENT_MODE", "local")
    monkeypatch.delenv("LOTTO_ORIGIN_TOKEN", raising=False)
    monkeypatch.setenv("LOTTO_SCHEDULER_ENABLED", "false")
    with TestClient(create_app()) as client:
        assert client.get("/api/v1/games").status_code == 200
        assert client.get("/openapi.json").status_code == 200


@pytest.mark.parametrize("prefix", ["postgresql://", "postgres://", "postgresql+psycopg://"])
def test_neon_connection_string_uses_installed_driver(prefix: str) -> None:
    settings = Settings(database_url=prefix + "test:example@db.example.test/lotto?sslmode=require")
    assert str(settings.database_url) == (
        "postgresql+psycopg://test:example@db.example.test/lotto?sslmode=require"
    )


def test_cloud_rejects_transaction_pooler_and_scheduler() -> None:
    for override, message in (
        ({"database_url": "postgresql://test:example@ep-test-pooler.example.test/lotto"}, "direct"),
        ({"scheduler_enabled": True}, "scheduler disabled"),
    ):
        options = {
            "database_url": "postgresql://test:example@db.example.test/lotto",
            "deployment_mode": "cloud",
            "origin_token": TOKEN,
            **override,
        }
        with pytest.raises(ValidationError, match=message):
            Settings(**options)
