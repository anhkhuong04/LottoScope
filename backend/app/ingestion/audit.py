"""Read-only audit of imported coverage and official source samples."""

import random
from dataclasses import dataclass
from datetime import date

from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from app.ingestion.fetcher import SourceFetchError
from app.ingestion.service import PageFetcher
from app.ingestion.sources import SourceParseError, parse_result, result_url
from app.models.draw import DrawRow
from app.models.ingestion import IngestionItemRow
from app.repositories.draws import DrawRepository


@dataclass(frozen=True, slots=True)
class AuditReport:
    game: str
    source_latest_id: str
    source_latest_date: date
    stored_draws: int
    draws_above_source_latest: int
    scanned_ids: int
    unscanned_ids: int
    unscanned_examples: tuple[str, ...]
    unresolved_ids: int
    unresolved_examples: tuple[str, ...]
    provenance_errors: int
    chronology_errors: int
    sample_ids: tuple[str, ...]
    sample_mismatches: tuple[str, ...]
    complete: bool


def audit_history(engine: Engine, fetcher: PageFetcher, game: str) -> AuditReport:
    """Audit 1..source latest. A partial range can never be labeled complete."""
    latest_url = result_url(game)
    html, retrieved_at = fetcher.fetch(latest_url)
    latest = parse_result(
        html, game=game, expected_id=None, source_url=latest_url, retrieved_at=retrieved_at
    )
    upper = latest.draw_seq
    with Session(engine) as session:
        rows = session.scalars(
            select(DrawRow)
            .where(DrawRow.game == game, DrawRow.draw_seq <= upper)
            .order_by(DrawRow.draw_seq.asc())
        ).all()
        extra_draws = (
            session.scalar(
                select(func.count())
                .select_from(DrawRow)
                .where(DrawRow.game == game, DrawRow.draw_seq > upper)
            )
            or 0
        )
        items = session.scalars(
            select(IngestionItemRow).where(
                IngestionItemRow.game == game, IngestionItemRow.draw_seq <= upper
            )
        ).all()
        item_by_seq = {item.draw_seq: item for item in items}
        unscanned = [f"{seq:05d}" for seq in range(1, upper + 1) if seq not in item_by_seq]
        unresolved = [
            f"{item.draw_seq:05d}:{item.status}" for item in items if item.status != "found"
        ]
        provenance_errors = sum(
            row.source_url != result_url(game, row.draw_id)
            or row.source_retrieved_at.tzinfo is None
            for row in rows
        )
        chronology_errors = sum(
            newer.draw_date < older.draw_date for older, newer in zip(rows, rows[1:], strict=False)
        )
        selected = {1, upper, max(1, upper // 2)}
        selected.update(random.Random(20261001).sample(range(1, upper + 1), min(5, upper)))
        sample_ids = tuple(f"{seq:05d}" for seq in sorted(selected))
        repository = DrawRepository(session)
        mismatches: list[str] = []
        for draw_id in sample_ids:
            url = result_url(game, draw_id)
            try:
                sample_html, sample_retrieved = fetcher.fetch(url)
                source = parse_result(
                    sample_html,
                    game=game,
                    expected_id=draw_id,
                    source_url=url,
                    retrieved_at=sample_retrieved,
                )
            except (SourceFetchError, SourceParseError):
                mismatches.append(f"{draw_id}:source_unavailable_or_invalid")
                continue
            stored = repository.get_by_id(game, draw_id)
            if stored is None or stored.canonical_payload() != source.canonical_payload():
                mismatches.append(draw_id)
    complete = (
        not unscanned
        and not unresolved
        and len(rows) == upper
        and extra_draws == 0
        and provenance_errors == 0
        and chronology_errors == 0
        and not mismatches
    )
    return AuditReport(
        game=game,
        source_latest_id=latest.draw_id,
        source_latest_date=latest.draw_date,
        stored_draws=len(rows),
        draws_above_source_latest=extra_draws,
        scanned_ids=len(items),
        unscanned_ids=len(unscanned),
        unscanned_examples=tuple(unscanned[:20]),
        unresolved_ids=len(unresolved),
        unresolved_examples=tuple(unresolved[:20]),
        provenance_errors=provenance_errors,
        chronology_errors=chronology_errors,
        sample_ids=sample_ids,
        sample_mismatches=tuple(mismatches),
        complete=complete,
    )
