"""Persisted prize lookup and bounded on-demand enrichment of a historical draw."""

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

import httpx
from sqlalchemy import Engine

from app.domain.prizes import PrizeTier
from app.ingestion.community import CommunityFallbackService, fallback_reason_for_run
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
    def __init__(
        self,
        engine: Engine,
        fetcher: PageFetcher | None = None,
        *,
        community_fallback_enabled: bool = False,
    ) -> None:
        self.engine = engine
        self.fetcher = fetcher
        self.community_fallback_enabled = community_fallback_enabled

    def get(self, game: str, draw_id: str) -> PrizeDetails | None:
        history = DrawHistoryService(self.engine)
        draw = history.by_id(game, draw_id)
        if draw is None:
            return None
        if draw.prizes is None:
            if self.fetcher is not None:
                summary = self._enrich_with_fallback(game, draw_id, self.fetcher)
            else:
                with httpx.Client(follow_redirects=True) as client:
                    summary = self._enrich_with_fallback(game, draw_id, configured_fetcher(client))
            if summary.status != "success":
                if summary.counters.get("conflict", 0):
                    raise PrizeReviewPendingError("source change requires review")
                raise PrizeSourceUnavailableError("validated prize source is unavailable")
            draw = history.by_id(game, draw_id)
            if draw is None:
                return None
        return PrizeDetails(
            draw.draw_id, draw.prizes or (), draw.source_url, draw.prizes_retrieved_at
        )

    def _enrich_with_fallback(self, game: str, draw_id: str, fetcher: PageFetcher) -> RunSummary:
        summary = self._enrich(game, draw_id, fetcher)
        if (
            summary.status != "success"
            and not summary.counters.get("conflict", 0)
            and self.community_fallback_enabled
        ):
            reason = fallback_reason_for_run(self.engine, summary.run_id)
            if reason is not None:
                return CommunityFallbackService(self.engine, fetcher).enrich_prizes(
                    game, draw_id, fallback_reason=reason
                )
        return summary

    def _enrich(self, game: str, draw_id: str, fetcher: PageFetcher) -> RunSummary:
        return IngestionService(self.engine, fetcher).import_history(
            game, start_id=draw_id, end_id=draw_id, recheck=True
        )
