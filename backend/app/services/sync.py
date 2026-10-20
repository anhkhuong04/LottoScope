"""Bounded, user-triggered collection with database-backed overlap and cooldown."""

from dataclasses import dataclass
from typing import Literal

import httpx
from sqlalchemy import Engine, text

from app.games.definitions import get_game
from app.ingestion.fetcher import configured_fetcher
from app.ingestion.service import IngestionService, JobOverlapError, PageFetcher, RunSummary


class SyncCooldownError(RuntimeError):
    """A recent attempt already contacted this game's source."""


class SyncSourceUnavailableError(RuntimeError):
    """The current attempt could not validate all requested new draws."""


class SyncReviewPendingError(RuntimeError):
    """Collected content requires the existing correction review workflow."""


@dataclass(frozen=True, slots=True)
class SyncResult:
    game: str
    run_id: int
    status: Literal["success", "partial", "failed"]
    created: int
    enriched: int
    unchanged: int
    remaining_unresolved: int


class ManualSyncService:
    def __init__(self, engine: Engine, fetcher: PageFetcher | None = None) -> None:
        self.engine = engine
        self.fetcher = fetcher

    def sync(self, game: str) -> SyncResult:
        get_game(game)
        # One manual request across games/processes, before source I/O. The collector
        # retains its own per-game lock against imports and other ingestion callers.
        with self.engine.connect() as connection:
            if not connection.scalar(text("SELECT pg_try_advisory_lock(5044, 1)")):
                raise JobOverlapError("another manual sync is running")
            try:
                recent = connection.scalar(
                    text(
                        "SELECT EXISTS (SELECT 1 FROM ingestion_runs "
                        "WHERE game=:game AND kind='collector' "
                        "AND finished_at > clock_timestamp() - interval '60 seconds')"
                    ),
                    {"game": game},
                )
                if recent:
                    raise SyncCooldownError("wait before another source request")
                summary = self._collect(game)
            finally:
                connection.execute(text("SELECT pg_advisory_unlock(5044, 1)"))
        if summary.counters.get("conflict", 0):
            raise SyncReviewPendingError("source change requires review")
        if not summary.latest_poll_succeeded:
            raise SyncSourceUnavailableError("new draw collection did not finish")
        return SyncResult(
            game=game,
            run_id=summary.run_id,
            status=summary.status,
            created=summary.counters.get("created", 0),
            enriched=summary.counters.get("enriched", 0),
            unchanged=summary.counters.get("unchanged", 0),
            remaining_unresolved=summary.counters.get("remaining_unresolved", 0),
        )

    def _collect(self, game: str) -> RunSummary:
        if self.fetcher is not None:
            return IngestionService(self.engine, self.fetcher).collect(game, recheck_recent=False)
        with httpx.Client(follow_redirects=True) as client:
            return IngestionService(self.engine, configured_fetcher(client)).collect(
                game, recheck_recent=False
            )
