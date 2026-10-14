"""Startup catches missed polls in the background; recurring schedules remain intact."""

from datetime import UTC, datetime, timedelta
from threading import Event

from fastapi.testclient import TestClient

import app.jobs.collection as collection
import app.main as main
from app.core.config import Settings
from app.jobs.collection import VIETNAM_TZ, build_scheduler


def test_restart_collects_all_games_without_blocking_http(monkeypatch) -> None:
    # Keep every cron poll in the future: only startup recovery can satisfy this test.
    later = (datetime.now(VIETNAM_TZ) + timedelta(hours=2)).strftime("%H:%M")
    settings = Settings(
        database_url="postgresql+psycopg://lotto:example@localhost/lotto",
        lotto_poll_first=later,
        lotto_poll_second=later,
        mega_poll=later,
        power_poll=later,
        reconcile_poll=later,
    )
    monkeypatch.setenv("LOTTO_SCHEDULER_ENABLED", "true")
    monkeypatch.setattr(main, "get_settings", lambda: settings)
    started = {game: Event() for game in ("lotto_535", "mega_645", "power_655")}
    finished = {game: Event() for game in started}
    release = Event()

    def collect(game: str) -> None:
        started[game].set()
        release.wait(timeout=10)
        finished[game].set()

    monkeypatch.setattr(collection, "run_collection", collect)
    for _ in range(2):
        for event in (*started.values(), *finished.values()):
            event.clear()
        release.clear()
        with TestClient(main.create_app()) as client:
            try:
                assert all(event.wait(timeout=3) for event in started.values())
                assert all(not event.is_set() for event in finished.values())
                assert client.get("/health/live").json() == {"status": "ok"}
                assert all(not event.is_set() for event in finished.values())
            finally:
                release.set()


def test_disabled_scheduler_does_not_collect_on_startup(monkeypatch) -> None:
    monkeypatch.setenv("LOTTO_SCHEDULER_ENABLED", "false")

    def unexpected_scheduler(_settings):
        raise AssertionError("disabled scheduler must not be built")

    monkeypatch.setattr(main, "build_scheduler", unexpected_scheduler)
    with TestClient(main.create_app()) as client:
        assert client.get("/health/live").status_code == 200


def test_vietnam_schedule_registers_poll_and_reconcile() -> None:
    settings = Settings(
        database_url="postgresql+psycopg://lotto:example@localhost/lotto",
        lotto_poll_second="23:45",
    )
    scheduler = build_scheduler(settings)
    jobs = {job.id: str(job.trigger) for job in scheduler.get_jobs()}
    assert set(jobs) == {
        "lotto_first",
        "lotto_second",
        "mega",
        "power",
        "lotto_reconcile",
        "mega_reconcile",
        "power_reconcile",
        "lotto_535_startup",
        "mega_645_startup",
        "power_655_startup",
    }
    assert "hour='23'" in jobs["lotto_second"]
    assert "minute='45'" in jobs["lotto_second"]
    assert "day_of_week='wed,fri,sun'" in jobs["mega"]
    assert "day_of_week='tue,thu,sat'" in jobs["power"]


def test_delayed_scheduler_start_does_not_discard_catchup(monkeypatch) -> None:
    completed = {game: Event() for game in ("lotto_535", "mega_645", "power_655")}
    monkeypatch.setattr(collection, "run_collection", lambda game: completed[game].set())
    scheduler = build_scheduler(
        Settings(database_url="postgresql+psycopg://lotto:example@localhost/lotto")
    )
    # Simulate time passing between job creation and scheduler start, without sleeping.
    for game in completed:
        scheduler.modify_job(
            f"{game}_startup", next_run_time=datetime.now(UTC) - timedelta(minutes=10)
        )
    scheduler.start()
    try:
        assert all(event.wait(timeout=3) for event in completed.values())
    finally:
        scheduler.shutdown(wait=True)
