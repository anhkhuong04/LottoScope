"""Bounded, throttled HTTP fetch of official result pages."""

import random
import time
from collections.abc import Callable
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from threading import Lock

import httpx

from app.core.config import get_settings


class SourceFetchError(RuntimeError):
    def __init__(self, url: str, detail: str, *, missing: bool = False) -> None:
        super().__init__(f"{url}: {detail}")
        self.missing = missing


class SourceDeferredError(SourceFetchError):
    """Source is rate limited/challenged; stop this batch instead of trying every ID."""


class VietlottFetcher:
    def __init__(
        self,
        client: httpx.Client,
        *,
        sleep: Callable[[float], None] = time.sleep,
        monotonic: Callable[[], float] = time.monotonic,
        jitter: Callable[[], float] = random.random,
        now: Callable[[], datetime] = lambda: datetime.now(UTC),
        min_interval: float = 1.0,
    ) -> None:
        self.client = client
        self.sleep = sleep
        self.monotonic = monotonic
        self.jitter = jitter
        self.now = now
        self.min_interval = min_interval
        self._last_request: float | None = None
        self._throttle_lock = Lock()

    def _throttle(self) -> None:
        with self._throttle_lock:
            current = self.monotonic()
            if self._last_request is not None:
                remaining = self.min_interval - (current - self._last_request)
                if remaining > 0:
                    self.sleep(remaining)
            self._last_request = self.monotonic()

    def _retry_delay(self, response: httpx.Response | None, attempt: int) -> float:
        if response is not None:
            value = response.headers.get("Retry-After")
            if value:
                try:
                    return max(0.0, float(value))
                except ValueError:
                    try:
                        parsed = parsedate_to_datetime(value)
                        if parsed.tzinfo is not None:
                            return max(0.0, (parsed - self.now()).total_seconds())
                    except (TypeError, ValueError):
                        pass
        return min(8.0, 2.0 ** (attempt - 1) + self.jitter())

    def fetch(self, url: str) -> tuple[str, datetime]:
        """Return HTML and UTC retrieval time, or a classified failure after <=3 attempts."""
        for attempt in range(1, 4):
            self._throttle()
            response: httpx.Response | None = None
            try:
                response = self.client.get(url, timeout=httpx.Timeout(10.0))
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                if attempt == 3:
                    raise SourceFetchError(url, type(exc).__name__) from exc
            else:
                if response.headers.get("cf-mitigated", "").lower() == "challenge":
                    raise SourceDeferredError(url, "Cloudflare challenge; deferred")
                if response.status_code == 200:
                    return response.text, self.now()
                if response.status_code == 404:
                    raise SourceFetchError(url, "HTTP 404", missing=True)
                if response.status_code != 429 and response.status_code < 500:
                    raise SourceFetchError(url, f"HTTP {response.status_code}")
                if attempt == 3:
                    if response.status_code == 429:
                        raise SourceDeferredError(url, "HTTP 429; deferred")
                    raise SourceFetchError(url, f"HTTP {response.status_code}")
            delay = self._retry_delay(response, attempt)
            if delay > 60.0:
                raise SourceDeferredError(url, "Retry-After exceeds 60 seconds; deferred")
            self.sleep(delay)
        raise AssertionError("bounded fetch loop did not return or raise")


def configured_fetcher(client: httpx.Client) -> VietlottFetcher:
    """Allow operators to slow source requests while keeping the one-request/s ceiling."""
    return VietlottFetcher(client, min_interval=get_settings().source_request_interval)
