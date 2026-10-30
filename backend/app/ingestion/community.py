"""Opt-in, append-only community fallback; never repairs official history."""

import json
from datetime import UTC, date, datetime
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, StrictInt, StrictStr
from sqlalchemy import Engine, func, select, text
from sqlalchemy.orm import Session

from app.domain.draw import Draw, validate_draw_id
from app.games.definitions import get_game
from app.ingestion.fetcher import SourceFetchError
from app.ingestion.service import JobOverlapError, PageFetcher, RunSummary
from app.models.draw import DrawRow
from app.models.ingestion import IngestionCheckpointRow, IngestionItemRow, IngestionRunRow
from app.repositories.draws import DrawRepository

FEEDS = {
    "lotto_535": "power535",
    "mega_645": "power645",
    "power_655": "power655",
}
ANCHORS = 20
MAX_NEW = 20


class CommunityFeedError(ValueError):
    """Untrusted feed cannot safely extend the stored history."""


class FeedIdentity(BaseModel):
    id: StrictStr


class FeedRow(FeedIdentity):
    date: StrictStr
    result: list[StrictInt]


def feed_url(game: str) -> str:
    get_game(game)
    return (
        f"https://raw.githubusercontent.com/vietvudanh/vietlott-data/main/data/{FEEDS[game]}.jsonl"
    )


def parse_feed(body: str, game: str, lower: int, retrieved: datetime) -> dict[int, Draw]:
    """Validate the recent overlap and new tail; historical defects cannot overwrite DB."""
    if len(body.encode("utf-8")) > 2_000_000 or len(body.splitlines()) > 20_000:
        raise CommunityFeedError("community feed exceeds bounds")
    definition = get_game(game)
    today = retrieved.astimezone(ZoneInfo("Asia/Ho_Chi_Minh")).date()
    draws: dict[int, Draw] = {}
    seen: set[int] = set()
    for line in body.splitlines():
        if not line.strip():
            continue
        value: object = json.loads(line)
        identity = FeedIdentity.model_validate(value)
        sequence = validate_draw_id(identity.id)
        if sequence in seen:
            raise CommunityFeedError("duplicate community identity")
        seen.add(sequence)
        if sequence < lower:
            continue
        record = FeedRow.model_validate(value)
        day = date.fromisoformat(record.date)
        if day > today or len(record.result) != definition.main_count + int(
            definition.special_max is not None
        ):
            raise CommunityFeedError("invalid community date or number count")
        draws[sequence] = Draw(
            game=game,
            draw_id=record.id,
            draw_date=day,
            draw_time=None,
            main_numbers=tuple(record.result[: definition.main_count]),
            special_number=record.result[-1] if definition.special_max is not None else None,
            source_url=feed_url(game) + f"#draw={record.id}",
            source_retrieved_at=retrieved,
        )
    if not draws:
        raise CommunityFeedError("empty or stale community tail")
    return draws


class CommunityFallbackService:
    def __init__(self, engine: Engine, fetcher: PageFetcher) -> None:
        self.engine = engine
        self.fetcher = fetcher

    def collect(self, game: str) -> RunSummary:
        get_game(game)
        with self.engine.connect() as lock:
            if not lock.scalar(
                text("SELECT pg_try_advisory_lock(5043, hashtext(:game))"), {"game": game}
            ):
                raise JobOverlapError("another collector owns this game")
            try:
                return self._collect_locked(game)
            finally:
                lock.execute(
                    text("SELECT pg_advisory_unlock(5043, hashtext(:game))"), {"game": game}
                )

    def _collect_locked(self, game: str) -> RunSummary:
        with Session(self.engine) as session, session.begin():
            run = IngestionRunRow(
                game=game,
                kind="collector",
                status="running",
                counters={},
                scope={
                    "source": "community",
                    "source_url": feed_url(game),
                    "fallback_reason": "official_cloudflare_challenge",
                },
            )
            session.add(run)
            session.flush()
            run_id = run.id
        counts = {"created": 0, "inserted": 0, "unchanged": 0, "remaining_unresolved": 0}
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
                body, retrieved = self.fetcher.fetch(feed_url(game))
                draws = parse_feed(body, game, anchors[-1].draw_seq, retrieved)
                for stored in anchors:
                    incoming = draws.get(stored.draw_seq)
                    if incoming is None or (
                        incoming.draw_date,
                        list(incoming.main_numbers),
                        incoming.special_number,
                    ) != (stored.draw_date, stored.main_numbers, stored.special_number):
                        raise CommunityFeedError(
                            f"reference mismatch for {stored.draw_id}; manual review required"
                        )
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
                previous_day = anchors[0].draw_date
                for draw in pending:
                    if draw is None:
                        raise CommunityFeedError("missing draw")
                    if draw.draw_date < previous_day:
                        raise CommunityFeedError("community dates are not chronological")
                    previous_day = draw.draw_date
                    result = DrawRepository(session).add(draw)
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
            counts["unchanged"] = int(not pending)
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
