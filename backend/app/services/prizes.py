"""Persisted prize lookup and bounded on-demand enrichment of a historical draw."""

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

import httpx
from sqlalchemy import Engine

from app.domain.prizes import PrizeTier
from app.ingestion.fetcher import configured_fetcher
from app.ingestion.service import IngestionService, PageFetcher, RunSummary
from app.services.history import DrawHistoryService


class PrizeSourceUnavailableError(RuntimeError):
    """The source could not supply validated data; stored draw remains available."""


class PrizeReviewPendingError(RuntimeError):
    """Source differs from stored draw/prizes and needs explicit correction review."""


@dataclass(frozen=True, slots=True)
class PrizeDetails:
    draw_id: str
    items: tuple[PrizeTier, ...]
    source_url: str
    source_retrieved_at: datetime | None
    currency: Literal["VND"] = "VND"


class DrawPrizeService:
    def __init__(self, engine: Engine, fetcher: PageFetcher | None = None) -> None:
        self.engine = engine
        self.fetcher = fetcher

    def get(self, game: str, draw_id: str) -> PrizeDetails | None:
        history = DrawHistoryService(self.engine)
        draw = history.by_id(game, draw_id)
        if draw is None:
            return None
        if draw.prizes is None:
            if self.fetcher is not None:
                summary = self._enrich(game, draw_id, self.fetcher)
            else:
                with httpx.Client(follow_redirects=True) as client:
                    summary = self._enrich(game, draw_id, configured_fetcher(client))
            if summary.status != "success":
                if summary.counters["conflict"]:
                    raise PrizeReviewPendingError("source change requires review")
                raise PrizeSourceUnavailableError("validated prize source is unavailable")
            draw = history.by_id(game, draw_id)
            if draw is None:
                return None
        return PrizeDetails(
            draw.draw_id, draw.prizes or (), draw.source_url, draw.prizes_retrieved_at
        )

    def _enrich(self, game: str, draw_id: str, fetcher: PageFetcher) -> RunSummary:
        return IngestionService(self.engine, fetcher).import_history(
            game, start_id=draw_id, end_id=draw_id, recheck=True
        )
