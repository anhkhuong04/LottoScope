"""Explicit user-file source: validate before an atomic, audited PostgreSQL import."""

import hashlib
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import Engine, func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.domain.draw import Draw
from app.ingestion.service import JobOverlapError, RunSummary
from app.ingestion.sources import result_url
from app.models.draw import DrawRow
from app.models.ingestion import IngestionCheckpointRow, IngestionItemRow, IngestionRunRow
from app.repositories.draws import DrawRepository

GAME = "power_655"
ROW = re.compile(r"\|\s*(\d{5})\s*\|\s*(\d{2}/\d{2}/\d{4})\s*\|\s*([0-9 ]+);\s*(\d+)\s*\|")


@dataclass(frozen=True, slots=True)
class PowerFile:
    name: str
    sha256: str
    read_at: datetime
    draws: tuple[Draw, ...]


def load_power_file(path: Path) -> PowerFile:
    raw = path.read_bytes()
    lines = raw.decode("utf-8-sig").splitlines()
    if len(lines) < 3 or not lines[0].startswith("| Kỳ quay | Ngày quay |"):
        raise ValueError("expected Markdown columns: draw ID, draw date, main numbers; special")
    if not re.fullmatch(r"\|\s*-+\s*\|\s*-+\s*\|\s*-+\s*\|", lines[1]):
        raise ValueError("invalid table separator")
    read_at = datetime.now(UTC)
    draws: dict[str, Draw] = {}
    for number, line in enumerate(lines[2:], 3):
        if not line.strip():
            continue
        match = ROW.fullmatch(line.strip())
        if match is None:
            raise ValueError(f"line {number}: invalid result row")
        draw_id, day, main, special = match.groups()
        if draw_id in draws:
            raise ValueError(f"line {number}: duplicate draw {draw_id}")
        try:
            draws[draw_id] = Draw(
                game=GAME,
                draw_id=draw_id,
                draw_date=datetime.strptime(day, "%d/%m/%Y").date(),
                draw_time=None,
                main_numbers=tuple(int(value) for value in main.split()),
                special_number=int(special),
                # This is a reference URL, not a claim that this import fetched it.
                # The run records the actual file origin/hash and local read time.
                source_url=result_url(GAME, draw_id),
                source_retrieved_at=read_at,
            )
        except ValueError as exc:
            raise ValueError(f"line {number}: {exc}") from exc
    ordered = tuple(draws[key] for key in sorted(draws))
    if not ordered:
        raise ValueError("file has no draw rows")
    if any(b.draw_date < a.draw_date for a, b in zip(ordered, ordered[1:], strict=False)):
        raise ValueError("draw dates contradict draw ID order")
    return PowerFile(path.name, hashlib.sha256(raw).hexdigest(), read_at, ordered)


def import_power_file(engine: Engine, file: PowerFile) -> RunSummary:
    """One file is atomic; unchanged rows keep their provenance and prize snapshot."""
    if not file.draws or any(draw.game != GAME or draw.prizes is not None for draw in file.draws):
        raise ValueError("expected validated Power results without prize snapshots")
    counts: dict[str, int] = dict.fromkeys(
        (
            "created",
            "enriched",
            "unchanged",
            "conflict",
            "failed",
            "invalid",
            "missing",
            "excluded",
        ),
        0,
    )
    with engine.begin() as connection:
        if not connection.scalar(
            text("SELECT pg_try_advisory_xact_lock(5043, hashtext(:game))"), {"game": GAME}
        ):
            raise JobOverlapError("Power ingestion is already running")
        with Session(bind=connection) as session, session.begin():
            run = IngestionRunRow(
                game=GAME,
                kind="import",
                status="running",
                counters=counts.copy(),
                scope={
                    "source_kind": "user_file",
                    "file_name": file.name,
                    "file_sha256": file.sha256,
                    "file_read_at": file.read_at.isoformat(),
                    "source_url_semantics": "official_reference_not_live_fetch",
                    "include_prizes": False,
                    "rows": len(file.draws),
                },
            )
            session.add(run)
            session.flush()
            repository = DrawRepository(session)
            for draw in file.draws:
                result = repository.add(draw)
                counts[result.status] += 1
                item = dict(
                    game=GAME,
                    draw_seq=draw.draw_seq,
                    status="found",
                    last_run_id=run.id,
                    attempted_at=file.read_at,
                    error_summary=f"content_conflict correction_id={result.correction_id}"
                    if result.status == "conflict"
                    else None,
                )
                session.execute(
                    insert(IngestionItemRow)
                    .values(**item)
                    .on_conflict_do_update(
                        index_elements=["game", "draw_seq"],
                        set_=item,
                    )
                )
            upper = file.draws[-1].draw_seq
            session.execute(
                insert(IngestionCheckpointRow)
                .values(
                    game=GAME,
                    last_scanned_seq=upper,
                    updated_at=file.read_at,
                )
                .on_conflict_do_update(
                    index_elements=["game"],
                    set_={
                        "last_scanned_seq": func.greatest(
                            IngestionCheckpointRow.last_scanned_seq, upper
                        ),
                        "updated_at": file.read_at,
                    },
                )
            )
            run.status = "partial" if counts["conflict"] else "success"
            run.counters = {key: value for key, value in counts.items()}
            run.finished_at = datetime.now(UTC)
            run.error_summary = (
                "source content requires correction review" if counts["conflict"] else None
            )
            session.flush()
            summary = RunSummary(
                run.id, GAME, "import", "partial" if counts["conflict"] else "success", counts
            )
    return summary


def missing_power_ids(engine: Engine, *, upper: int | None = None) -> tuple[str, ...]:
    with Session(engine) as session:
        stored = set(session.scalars(select(DrawRow.draw_seq).where(DrawRow.game == GAME)))
    last = max(stored, default=0) if upper is None else upper
    return tuple(f"{number:05d}" for number in range(1, last + 1) if number not in stored)
