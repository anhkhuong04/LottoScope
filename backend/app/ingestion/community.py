"""Opt-in, append-only community fallback; never repairs official history."""

from collections.abc import Mapping, Sequence
from dataclasses import replace
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from app.domain.draw import Draw, validate_draw_id
from app.games.definitions import get_game
from app.ingestion.fetcher import SourceFetchError
from app.ingestion.locking import game_ingestion_lock
from app.ingestion.publishers import feed_url as feed_url
from app.ingestion.publishers import load_draws
from app.ingestion.publishers import parse_feed as parse_feed
from app.ingestion.service import PageFetcher, RunSummary
from app.models.draw import DrawRow
from app.models.ingestion import IngestionCheckpointRow, IngestionItemRow, IngestionRunRow
from app.repositories.draws import DrawRepository

ANCHORS = 20
MAX_NEW = 20
_FALLBACK_ERROR_REASONS: tuple[tuple[str, str], ...] = (
    ("Cloudflare challenge; deferred", "official_cloudflare_challenge"),
    ("HTTP 429; deferred", "official_rate_limited"),
    ("Retry-After exceeds 60 seconds; deferred", "official_rate_limited"),
    ("HTTP 403", "official_forbidden"),
    ("TimeoutException", "official_network_timeout"),
    ("ConnectTimeout", "official_network_timeout"),
    ("ReadTimeout", "official_network_timeout"),
    ("WriteTimeout", "official_network_timeout"),
    ("PoolTimeout", "official_network_timeout"),
    ("ConnectError", "official_network_error"),
    ("ReadError", "official_network_error"),
    ("NetworkError", "official_network_error"),
)


def fallback_reason_for_run(engine: Engine, run_id: int) -> str | None:
    """Return a fallback reason tag when an official run failed due to block/limit/timeout."""
    with Session(engine) as session:
        row = session.get(IngestionRunRow, run_id)
        candidates: list[str] = []
        if row is not None and row.error_summary:
            candidates.append(row.error_summary)
        item_errors = session.scalars(
            select(IngestionItemRow.error_summary).where(
                IngestionItemRow.last_run_id == run_id,
                IngestionItemRow.error_summary.is_not(None),
            )
        ).all()
        candidates.extend(err for err in item_errors if err)
    for text_value in candidates:
        for marker, reason in _FALLBACK_ERROR_REASONS:
            if marker in text_value:
                return reason
    return None


class CommunityFeedError(ValueError):
    """Untrusted publisher cannot safely extend stored history."""


def _verify_anchors(anchors: Sequence[DrawRow], incoming: Mapping[int, Draw]) -> None:
    for stored in anchors:
        draw = incoming.get(stored.draw_seq)
        if draw is None or (
            draw.draw_date,
            list(draw.main_numbers),
            draw.special_number,
        ) != (stored.draw_date, stored.main_numbers, stored.special_number):
            raise CommunityFeedError(
                f"reference mismatch for {stored.draw_id}; manual review required"
            )


class CommunityFallbackService:
    def __init__(self, engine: Engine, fetcher: PageFetcher) -> None:
        self.engine = engine
        self.fetcher = fetcher

    def collect(
        self, game: str, *, fallback_reason: str = "official_cloudflare_challenge"
    ) -> RunSummary:
        get_game(game)
        with game_ingestion_lock(self.engine, game, "another collector owns this game"):
            return self._collect_locked(game, fallback_reason=fallback_reason)

    def enrich_prizes(
        self, game: str, draw_id: str, *, fallback_reason: str = "official_source_blocked"
    ) -> RunSummary:
        get_game(game)
        validate_draw_id(draw_id)
        with game_ingestion_lock(self.engine, game, "another collector owns this game"):
            return self._enrich_prizes_locked(game, draw_id, fallback_reason=fallback_reason)

    def _collect_locked(self, game: str, *, fallback_reason: str) -> RunSummary:
        with Session(self.engine) as session, session.begin():
            run = IngestionRunRow(
                game=game,
                kind="collector",
                status="running",
                counters={},
                scope={
                    "source": "community",
                    "source_url": feed_url(game),
                    "fallback_reason": fallback_reason,
                },
            )
            session.add(run)
            session.flush()
            run_id = run.id
        counts = {
            "created": 0,
            "inserted": 0,
            "enriched": 0,
            "unchanged": 0,
            "remaining_unresolved": 0,
        }
        error: str | None = None
        status: Literal["success", "partial", "failed"] = "failed"
        try:
            with Session(self.engine) as session:
                anchors = session.scalars(
                    select(DrawRow)
                    .where(DrawRow.game == game)
                    .order_by(DrawRow.draw_seq.desc())
                    .limit(ANCHORS)
                ).all()
                if len(anchors) != ANCHORS:
                    raise CommunityFeedError("fallback requires 20 stored reference draws")
                latest = anchors[0].draw_seq
                draws = load_draws(self.fetcher, game, anchors[-1].draw_seq)
                _verify_anchors(anchors, draws)
                upper = max(draws)
                if upper < latest or upper - latest > MAX_NEW:
                    raise CommunityFeedError("stale feed or new batch exceeds 20 draws")
                pending = [draws.get(sequence) for sequence in range(latest + 1, upper + 1)]
                if any(draw is None for draw in pending):
                    raise CommunityFeedError("community tail contains missing IDs")
            with Session(self.engine) as session, session.begin():
                checkpoint = session.get(IngestionCheckpointRow, game)
                if checkpoint is None or checkpoint.last_scanned_seq != latest:
                    raise CommunityFeedError("official history checkpoint requires review")
                repo = DrawRepository(session)
                enriched = 0
                for stored in anchors:
                    if stored.prizes is not None:
                        continue
                    incoming = draws.get(stored.draw_seq)
                    if incoming is None or incoming.prizes is None:
                        continue
                    current = repo.get_by_id(game, stored.draw_id)
                    if current is None or current.prizes is not None:
                        continue
                    if (
                        repo.add(
                            replace(
                                current,
                                prizes=incoming.prizes,
                                prizes_retrieved_at=incoming.prizes_retrieved_at,
                            )
                        ).status
                        == "enriched"
                    ):
                        enriched += 1
                previous_day = anchors[0].draw_date
                for draw in pending:
                    if draw is None:
                        raise CommunityFeedError("missing draw")
                    if draw.draw_date < previous_day:
                        raise CommunityFeedError("community dates are not chronological")
                    previous_day = draw.draw_date
                    result = repo.add(draw)
                    if result.status != "created":
                        raise CommunityFeedError("append-only fallback refused existing identity")
                    item = session.get(IngestionItemRow, (game, draw.draw_seq))
                    if item is None:
                        item = IngestionItemRow(game=game, draw_seq=draw.draw_seq)
                        session.add(item)
                    item.status = "found"
                    item.error_summary = None
                    item.last_run_id = run_id
                session.flush()
                scanned = (
                    session.scalar(
                        select(func.count())
                        .select_from(IngestionItemRow)
                        .where(
                            IngestionItemRow.game == game,
                            IngestionItemRow.draw_seq <= upper,
                            IngestionItemRow.status != "excluded",
                        )
                    )
                    or 0
                )
                found = (
                    session.scalar(
                        select(func.count())
                        .select_from(IngestionItemRow)
                        .where(
                            IngestionItemRow.game == game,
                            IngestionItemRow.draw_seq <= upper,
                            IngestionItemRow.status == "found",
                        )
                    )
                    or 0
                )
                if scanned == upper:
                    checkpoint.last_scanned_seq = upper
                    checkpoint.updated_at = datetime.now(UTC)
            counts["remaining_unresolved"] = upper - found
            counts["created"] = counts["inserted"] = len(pending)
            counts["enriched"] = enriched
            counts["unchanged"] = int(not pending and not enriched)
            status = "partial" if counts["remaining_unresolved"] else "success"
        except (SourceFetchError, ValueError) as exc:
            error = str(exc)[:500]
        finally:
            with Session(self.engine) as session, session.begin():
                row = session.get(IngestionRunRow, run_id)
                if row is None:
                    raise RuntimeError("community audit run vanished")
                row.status = status
                row.counters = {key: value for key, value in counts.items()}
                row.error_summary = error
                row.finished_at = datetime.now(UTC)
        return RunSummary(
            run_id,
            game,
            "collector",
            status,
            counts,
            source="community",
        )

    def _enrich_prizes_locked(self, game: str, draw_id: str, *, fallback_reason: str) -> RunSummary:
        with Session(self.engine) as session, session.begin():
            run = IngestionRunRow(
                game=game,
                kind="import",
                status="running",
                counters={},
                scope={
                    "source": "community",
                    "action": "prize_enrichment",
                    "draw_id": draw_id,
                    "source_url": feed_url(game),
                    "fallback_reason": fallback_reason,
                },
            )
            session.add(run)
            session.flush()
            run_id = run.id
        counts = {"created": 0, "enriched": 0, "unchanged": 0, "conflict": 0}
        error: str | None = None
        status: Literal["success", "partial", "failed"] = "failed"
        try:
            with Session(self.engine) as session:
                stored_target = DrawRepository(session).get_by_id(game, draw_id)
                if stored_target is None:
                    raise CommunityFeedError(f"draw {draw_id} not found")
                already_enriched = stored_target.prizes is not None
                anchors = session.scalars(
                    select(DrawRow)
                    .where(DrawRow.game == game)
                    .order_by(DrawRow.draw_seq.desc())
                    .limit(ANCHORS)
                ).all()
            if already_enriched:
                counts["unchanged"] = 1
                status = "success"
            else:
                if len(anchors) != ANCHORS:
                    raise CommunityFeedError("fallback requires 20 stored reference draws")
                lower = min(stored_target.draw_seq, anchors[-1].draw_seq)
                draws = load_draws(self.fetcher, game, lower)
                _verify_anchors(anchors, draws)
                incoming = draws.get(stored_target.draw_seq)
                if incoming is None or (
                    incoming.draw_date,
                    incoming.main_numbers,
                    incoming.special_number,
                ) != (
                    stored_target.draw_date,
                    stored_target.main_numbers,
                    stored_target.special_number,
                ):
                    raise CommunityFeedError(
                        f"reference mismatch for {draw_id}; manual review required"
                    )
                if incoming.prizes is None:
                    raise CommunityFeedError(f"publisher page has no prizes for {draw_id}")
                with Session(self.engine) as session, session.begin():
                    repo = DrawRepository(session)
                    current = repo.get_by_id(game, draw_id)
                    if current is None:
                        raise CommunityFeedError(f"draw {draw_id} vanished")
                    if current.prizes is not None:
                        counts["unchanged"] = 1
                    else:
                        result = repo.add(
                            replace(
                                current,
                                prizes=incoming.prizes,
                                prizes_retrieved_at=incoming.prizes_retrieved_at,
                            )
                        )
                        counts[result.status] = counts.get(result.status, 0) + 1
                status = "success"
        except (SourceFetchError, ValueError) as exc:
            error = str(exc)[:500]
        finally:
            with Session(self.engine) as session, session.begin():
                row = session.get(IngestionRunRow, run_id)
                if row is None:
                    raise RuntimeError("community audit run vanished")
                row.status = status
                row.counters = {key: value for key, value in counts.items()}
                row.error_summary = error
                row.finished_at = datetime.now(UTC)
        return RunSummary(
            run_id,
            game,
            "import",
            status,
            counts,
            source="community",
        )
