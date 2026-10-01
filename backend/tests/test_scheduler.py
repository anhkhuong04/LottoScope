"""Scheduler registration is deterministic and does not start network I/O."""

from app.core.config import Settings
from app.jobs.collection import build_scheduler


def test_vietnam_schedule_registers_poll_and_reconcile() -> None:
    settings = Settings(
        database_url="postgresql+psycopg://lotto:example@localhost/lotto",
        lotto_poll_second="23:45",
    )
    scheduler = build_scheduler(settings)
    jobs = {job.id: str(job.trigger) for job in scheduler.get_jobs()}
    assert set(jobs) == {"lotto_first", "lotto_second", "mega", "lotto_reconcile", "mega_reconcile"}
    assert "hour='23'" in jobs["lotto_second"]
    assert "minute='45'" in jobs["lotto_second"]
    assert "day_of_week='wed,fri,sun'" in jobs["mega"]
