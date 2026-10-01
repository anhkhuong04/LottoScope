"""Operational health endpoints, outside the versioned product API."""

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import get_engine

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live")
def live() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready", response_model=None)
def ready() -> dict[str, str] | JSONResponse:
    """Require both PostgreSQL connectivity and the current schema revision."""
    try:
        expected = ScriptDirectory.from_config(Config("alembic.ini")).get_current_head()
        with get_engine().connect() as connection:
            connection.execute(text("SELECT 1"))
            current = MigrationContext.configure(connection).get_current_revision()
    except (SQLAlchemyError, OSError) as exc:
        return JSONResponse(
            status_code=503,
            content={"error": {"code": "not_ready", "message": type(exc).__name__}},
        )

    if current != expected:
        return JSONResponse(
            status_code=503,
            content={
                "error": {"code": "migration_required", "message": "Database schema is not current"}
            },
        )
    return {"status": "ok"}
