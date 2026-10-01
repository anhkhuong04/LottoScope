"""Stable public errors without SQL, source HTML or traceback disclosure."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.analytics.service import CutoffNotFoundError
from app.games.definitions import DomainValidationError
from app.services.generator import InsufficientHistoryError, InvalidRulesError

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
