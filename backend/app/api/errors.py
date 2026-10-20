"""Stable public errors without SQL, source HTML or traceback disclosure."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.analytics.service import CutoffNotFoundError
from app.games.definitions import DomainValidationError
from app.ingestion.service import JobOverlapError
from app.services.generator import InsufficientHistoryError, InvalidRulesError
from app.services.prizes import PrizeReviewPendingError, PrizeSourceUnavailableError
from app.services.sync import SyncCooldownError, SyncReviewPendingError, SyncSourceUnavailableError

logger = logging.getLogger(__name__)


class ApiNotFoundError(LookupError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status, content={"error": {"code": code, "message": message, "details": {}}}
    )


def install_error_handlers(application: FastAPI) -> None:
    @application.exception_handler(SyncSourceUnavailableError)
    def sync_source_error(_request: Request, _exc: SyncSourceUnavailableError) -> JSONResponse:
        return _error(503, "sync_source_unavailable", "New draw collection could not finish")

    @application.exception_handler(SyncReviewPendingError)
    def sync_review_error(_request: Request, _exc: SyncReviewPendingError) -> JSONResponse:
        return _error(409, "sync_review_pending", "Source data requires correction review")

    @application.exception_handler(SyncCooldownError)
    def sync_cooldown(_request: Request, _exc: SyncCooldownError) -> JSONResponse:
        response = _error(429, "sync_cooldown", "Wait 60 seconds before syncing this game again")
        response.headers["Retry-After"] = "60"
        return response

    @application.exception_handler(PrizeSourceUnavailableError)
    def prize_source_error(_request: Request, _exc: PrizeSourceUnavailableError) -> JSONResponse:
        return _error(
            503, "prize_source_unavailable", "Prize data source is temporarily unavailable"
        )

    @application.exception_handler(PrizeReviewPendingError)
    def prize_review_error(_request: Request, _exc: PrizeReviewPendingError) -> JSONResponse:
        return _error(409, "prize_review_pending", "Prize data requires source correction review")

    @application.exception_handler(JobOverlapError)
    def ingestion_busy(_request: Request, _exc: JobOverlapError) -> JSONResponse:
        return _error(409, "ingestion_busy", "Ingestion is running; retry shortly")

    @application.exception_handler(DomainValidationError)
    def domain_error(_request: Request, exc: DomainValidationError) -> JSONResponse:
        if exc.field == "game":
            return _error(404, "unknown_game", "Game was not found")
        return _error(
            422,
            "invalid_window" if exc.field in {"window", "date_range", "count"} else "invalid_input",
            str(exc),
        )

    @application.exception_handler(CutoffNotFoundError)
    def cutoff_error(_request: Request, _exc: CutoffNotFoundError) -> JSONResponse:
        return _error(404, "draw_not_found", "Cutoff draw was not found")

    @application.exception_handler(ApiNotFoundError)
    def not_found(_request: Request, exc: ApiNotFoundError) -> JSONResponse:
        return _error(404, exc.code, str(exc))

    @application.exception_handler(InvalidRulesError)
    def invalid_rules(_request: Request, exc: InvalidRulesError) -> JSONResponse:
        return _error(422, "invalid_rules", str(exc))

    @application.exception_handler(InsufficientHistoryError)
    def no_history(_request: Request, exc: InsufficientHistoryError) -> JSONResponse:
        return _error(409, "insufficient_history", str(exc))

    @application.exception_handler(RequestValidationError)
    def request_error(_request: Request, _exc: RequestValidationError) -> JSONResponse:
        return _error(422, "invalid_request", "Request fields are invalid")

    @application.exception_handler(HTTPException)
    def http_error(_request: Request, exc: HTTPException) -> JSONResponse:
        return _error(
            exc.status_code,
            "not_found" if exc.status_code == 404 else "http_error",
            "Resource was not found" if exc.status_code == 404 else "HTTP request failed",
        )

    @application.exception_handler(Exception)
    def internal_error(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled API error", exc_info=exc)
        return _error(500, "internal_error", "Internal server error")
