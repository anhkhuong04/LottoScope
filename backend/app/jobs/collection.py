"""Single-process schedule; DB advisory lock handles manual/scheduled overlap."""

import logging
from datetime import time
from zoneinfo import ZoneInfo

import httpx
from apscheduler.schedulers.background import (  # pyright: ignore[reportMissingTypeStubs]
    BackgroundScheduler,
)

from app.core.config import Settings
from app.db.session import get_engine
from app.ingestion.fetcher import VietlottFetcher
from app.ingestion.service import IngestionService, JobOverlapError

logger = logging.getLogger(__name__)
VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")


def run_collection(game: str) -> None:
    try:
        with httpx.Client(follow_redirects=True) as client:
            summary = IngestionService(get_engine(), VietlottFetcher(client)).collect(game)
        log_summary = logger.info if summary.status == "success" else logger.error
        log_summary(
            "collector game=%s run=%s status=%s counters=%s",
            game,
            summary.run_id,
            summary.status,
            summary.counters,
        )
    except JobOverlapError:
        logger.info("collector game=%s skipped: ingestion already running", game)
    except Exception:
        logger.exception("collector game=%s failed", game)


def build_scheduler(settings: Settings) -> BackgroundScheduler:
    scheduler = BackgroundScheduler(timezone=VIETNAM_TZ)
    # Cron jobs are rebuilt after a restart and cannot replay polls missed while offline.
    # The shared collector backfills from PostgreSQL's checkpoint, under its per-game lock.
    for game in ("lotto_535", "mega_645"):
        scheduler.add_job(  # pyright: ignore[reportUnknownMemberType]
            run_collection,
            "date",
            args=[game],
            id=f"{game}_startup",
            misfire_grace_time=None,
        )
    schedules = (
        ("lotto_first", "lotto_535", settings.lotto_poll_first, "*"),
        ("lotto_second", "lotto_535", settings.lotto_poll_second, "*"),
        ("mega", "mega_645", settings.mega_poll, "wed,fri,sun"),
        ("lotto_reconcile", "lotto_535", settings.reconcile_poll, "*"),
        ("mega_reconcile", "mega_645", settings.reconcile_poll, "*"),
    )
    for name, game, clock, day_of_week in schedules:
        hour, minute = _schedule_time(clock)
        scheduler.add_job(  # pyright: ignore[reportUnknownMemberType]
            run_collection,
            "cron",
            args=[game],
            id=name,
            hour=hour,
            minute=minute,
            day_of_week=day_of_week,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
        )
    return scheduler


def _schedule_time(value: str) -> tuple[int, int]:
    parsed = time.fromisoformat(value)
    if parsed.tzinfo is not None or parsed.second or parsed.microsecond:
        raise ValueError(f"invalid polling time {value!r}; expected HH:MM")
    return parsed.hour, parsed.minute
