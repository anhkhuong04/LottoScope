"""FastAPI application factory."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.health import router as health_router
from app.core.config import get_settings, scheduler_enabled
from app.jobs.collection import build_scheduler


@asynccontextmanager
async def lifespan(_application: FastAPI) -> AsyncGenerator[None]:
    if not scheduler_enabled():
        yield
        return
    settings = get_settings()
    scheduler = build_scheduler(settings)
    scheduler.start()  # pyright: ignore[reportUnknownMemberType]
    try:
        yield
    finally:
        scheduler.shutdown(wait=True)  # pyright: ignore[reportUnknownMemberType]


def create_app() -> FastAPI:
    application = FastAPI(title="LottoScope API", version="0.1.0", lifespan=lifespan)
    application.include_router(health_router)
    return application


app = create_app()
