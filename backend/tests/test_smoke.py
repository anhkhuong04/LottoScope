"""P1 smoke tests for import and operational HTTP behavior."""

from fastapi.testclient import TestClient

from app.main import create_app


def test_app_import_and_liveness_without_database() -> None:
    with TestClient(create_app()) as client:
        response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
