"""Authenticate the cloud gateway without changing local Compose access."""

from secrets import compare_digest

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send


class OriginTokenMiddleware:
    def __init__(self, app: ASGIApp, token: str) -> None:
        self.app = app
        self.token = token.encode("utf-8")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or (
            scope["path"] == "/health/live" and scope["method"] == "GET"
        ):
            await self.app(scope, receive, send)
            return
        values = [value for key, value in scope["headers"] if key == b"x-lotto-origin-token"]
        if len(values) != 1 or not compare_digest(values[0], self.token):
            response = JSONResponse(
                {
                    "error": {
                        "code": "unauthorized",
                        "message": "Gateway access required",
                        "details": {},
                    }
                },
                status_code=401,
                headers={"Cache-Control": "no-store"},
            )
            await response(scope, receive, send)
            return
        await self.app(scope, receive, send)
