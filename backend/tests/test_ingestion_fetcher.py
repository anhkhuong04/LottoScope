"""Retry and failure classification use a synthetic HTTP transport."""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from time import monotonic

import httpx
import pytest

from app.ingestion.fetcher import SourceFetchError, VietlottFetcher

URL = "https://vietlott.vn/example"


def test_retry_transient_with_retry_after_and_bounded_attempts() -> None:
    calls = 0
    delays: list[float] = []

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return (
            httpx.Response(429, headers={"Retry-After": "2"}, request=request)
            if calls < 3
            else httpx.Response(200, text="ok", request=request)
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        fetcher = VietlottFetcher(
            client,
            sleep=delays.append,
            monotonic=lambda: 0.0,
            jitter=lambda: 0.0,
            now=lambda: datetime(2026, 1, 1, tzinfo=UTC),
        )
        assert fetcher.fetch(URL)[0] == "ok"
    assert calls == 3
    assert delays == [2.0, 1.0, 2.0, 1.0]


@pytest.mark.parametrize(("code", "missing"), [(404, True), (403, False)])
def test_permanent_http_error_is_not_retried(code: int, missing: bool) -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(code, request=request)

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(SourceFetchError) as error:
            VietlottFetcher(client, sleep=lambda _: None).fetch(URL)
    assert error.value.missing is missing
    assert calls == 1


def test_timeout_retries_three_times_then_fails() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        raise httpx.ReadTimeout("slow", request=request)

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(SourceFetchError, match="ReadTimeout"):
            VietlottFetcher(client, sleep=lambda _: None, jitter=lambda: 0.0).fetch(URL)
    assert calls == 3


def test_long_retry_after_defers_without_retrying_early() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(429, headers={"Retry-After": "120"}, request=request)

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(SourceFetchError, match="deferred"):
            VietlottFetcher(client, sleep=lambda _: None).fetch(URL)
    assert calls == 1


def test_concurrent_workers_start_at_most_one_request_per_interval() -> None:
    started: list[float] = []

    def handler(request: httpx.Request) -> httpx.Response:
        started.append(monotonic())
        return httpx.Response(200, text="ok", request=request)

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        fetcher = VietlottFetcher(client, min_interval=0.05)
        with ThreadPoolExecutor(max_workers=3) as pool:
            assert list(pool.map(fetcher.fetch, [URL + str(i) for i in range(3)]))
    assert len(started) == 3
    assert all(
        later - earlier >= 0.045 for earlier, later in zip(started, started[1:], strict=False)
    )


def test_server_error_retries_then_succeeds() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(503 if calls == 1 else 200, text="ok", request=request)

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        html, _ = VietlottFetcher(client, sleep=lambda _: None, jitter=lambda: 0.0).fetch(URL)
    assert html == "ok"
    assert calls == 2
