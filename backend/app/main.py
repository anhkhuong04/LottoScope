"""FastAPI application factory."""

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.errors import install_error_handlers
from app.api.health import router as health_router
from app.api.v1 import router as v1_router
from app.core.config import get_settings, scheduler_enabled
from app.jobs.collection import build_scheduler


@asynccontextmanager
async def lifespan(_application: FastAPI) -> AsyncGenerator[None]:
    if not scheduler_enabled():
        yield
        return
    # Uvicorn configures its own loggers; app INFO otherwise disappears from Docker logs.
    logging.basicConfig(format="%(levelname)s %(name)s %(message)s")
    logging.getLogger("app").setLevel(logging.INFO)
    settings = get_settings()
    scheduler = build_scheduler(settings)
    scheduler.start()  # pyright: ignore[reportUnknownMemberType]
    try:
        yield
    finally:
        scheduler.shutdown(wait=True)  # pyright: ignore[reportUnknownMemberType]


def create_app() -> FastAPI:
    application = FastAPI(title="LottoScope API", version="0.1.0", lifespan=lifespan)
    install_error_handlers(application)
    application.include_router(health_router)
    application.include_router(v1_router)
    return application


app = create_app()
