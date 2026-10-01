"""Historical import and collector share one transactional ingestion path."""

from collections import deque
from collections.abc import Callable, Iterable
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Literal, Protocol

from sqlalchemy import Engine, func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.domain.draw import Draw, validate_draw_id
from app.games.definitions import DomainValidationError, get_game
from app.ingestion.fetcher import SourceFetchError
from app.ingestion.sources import SourceParseError, parse_result, result_url
from app.models.ingestion import IngestionCheckpointRow, IngestionItemRow, IngestionRunRow
from app.repositories.draws import DrawRepository


class PageFetcher(Protocol):
    def fetch(self, url: str) -> tuple[str, datetime]: ...


class JobOverlapError(RuntimeError):
    """Another import/collector owns this game's advisory lock."""


class ImportPrerequisiteError(RuntimeError):
    """Collector requires a seeded local history; run import first."""


@dataclass(frozen=True, slots=True)
class RunSummary:
    run_id: int
    game: str
    kind: Literal["import", "collector"]
    status: Literal["success", "partial", "failed"]
    counters: dict[str, int]


@dataclass(frozen=True, slots=True)
class IngestionStatus:
    latest_draw_date: date | None
    last_successful_ingestion_at: datetime | None
    last_failed_ingestion_at: datetime | None
    unresolved_items: int
    last_scanned_seq: int | None
    unscanned_ids_before_checkpoint: int
    excluded_items: int


class IngestionService:
    def __init__(
        self,
        engine: Engine,
        fetcher: PageFetcher,
        *,
        now: Callable[[], datetime] = lambda: datetime.now(UTC),
        progress: Callable[[int, dict[str, int]], None] | None = None,
    ) -> None:
        self.engine = engine
        self.fetcher = fetcher
        self.now = now
        self.progress = progress

    def _latest_source(self, game: str) -> Draw:
        url = result_url(game)
        html, retrieved_at = self.fetcher.fetch(url)
        return parse_result(
            html, game=game, expected_id=None, source_url=url, retrieved_at=retrieved_at
        )

    def _record_item(
        self,
        session: Session,
        *,
        run_id: int,
        game: str,
        sequence: int,
        status: str,
        error: str | None,
    ) -> None:
        session.execute(
            insert(IngestionItemRow)
            .values(
                game=game,
                draw_seq=sequence,
                status=status,
                error_summary=error,
                last_run_id=run_id,
                attempted_at=self.now(),
            )
            .on_conflict_do_update(
                index_elements=["game", "draw_seq"],
                set_={
                    "status": status,
                    "error_summary": error,
                    "last_run_id": run_id,
                    "attempted_at": self.now(),
                },
            )
        )
        session.execute(
            insert(IngestionCheckpointRow)
            .values(game=game, last_scanned_seq=sequence, updated_at=self.now())
            .on_conflict_do_update(
                index_elements=["game"],
                set_={
                    "last_scanned_seq": func.greatest(
                        IngestionCheckpointRow.last_scanned_seq, sequence
                    ),
                    "updated_at": self.now(),
                },
            )
        )

    def _process_one(
        self,
        game: str,
        sequence: int,
        run_id: int,
        *,
        from_date: date | None,
        to_date: date | None,
    ) -> str:
        draw_id = f"{sequence:05d}"
        url = result_url(game, draw_id)
        try:
            html, retrieved_at = self.fetcher.fetch(url)
            draw = parse_result(
                html, game=game, expected_id=draw_id, source_url=url, retrieved_at=retrieved_at
            )
        except SourceFetchError as exc:
            status = "missing" if exc.missing else "failed"
            with Session(self.engine) as session, session.begin():
                self._record_item(
                    session,
                    run_id=run_id,
                    game=game,
                    sequence=sequence,
                    status=status,
                    error=str(exc)[:500],
                )
            return status
        except (SourceParseError, DomainValidationError) as exc:
            with Session(self.engine) as session, session.begin():
                self._record_item(
                    session,
                    run_id=run_id,
                    game=game,
                    sequence=sequence,
                    status="invalid",
                    error=f"{url}: {exc}"[:500],
                )
            return "invalid"

        if (from_date is not None and draw.draw_date < from_date) or (
            to_date is not None and draw.draw_date > to_date
        ):
            with Session(self.engine) as session, session.begin():
                self._record_item(
                    session,
                    run_id=run_id,
                    game=game,
                    sequence=sequence,
                    status="excluded",
                    error=None,
                )
            return "excluded"

        try:
            with Session(self.engine) as session, session.begin():
                result = DrawRepository(session).add(draw)
                self._record_item(
                    session,
                    run_id=run_id,
                    game=game,
                    sequence=sequence,
                    status="found",
                    error=(
                        f"content_conflict correction_id={result.correction_id}"
                        if result.status == "conflict"
                        else None
                    ),
                )
            return result.status
        except DomainValidationError as exc:
            with Session(self.engine) as session, session.begin():
                self._record_item(
                    session,
                    run_id=run_id,
                    game=game,
                    sequence=sequence,
                    status="invalid",
                    error=f"{url}: {exc}"[:500],
                )
            return "invalid"
        except SQLAlchemyError as exc:
            with Session(self.engine) as session, session.begin():
                self._record_item(
                    session,
                    run_id=run_id,
                    game=game,
                    sequence=sequence,
                    status="failed",
                    error=f"{url}: database {type(exc).__name__}"[:500],
                )
            return "failed"

    def _run(
        self,
        game: str,
        kind: Literal["import", "collector"],
        *,
        start_id: str | None,
        end_id: str | None,
        from_date: date | None,
        to_date: date | None,
        recheck: bool,
    ) -> RunSummary:
        get_game(game)
        if start_id is not None:
            validate_draw_id(start_id)
        if end_id is not None:
            validate_draw_id(end_id)
        if from_date is not None and to_date is not None and from_date > to_date:
            raise DomainValidationError("date_range", "from_date must be <= to_date")
        if start_id is not None and end_id is not None and start_id > end_id:
            raise DomainValidationError("id_range", "start_id must be <= end_id")

        # Session-level lock spans per-draw transactions and protects manual/scheduled overlap.
        with self.engine.connect() as lock_connection:
            acquired = lock_connection.scalar(
                text("SELECT pg_try_advisory_lock(5043, hashtext(:game))"), {"game": game}
            )
            if not acquired:
                raise JobOverlapError(f"ingestion already running for {game}")
            try:
                return self._run_locked(
                    game,
                    kind,
                    start_id=start_id,
                    end_id=end_id,
                    from_date=from_date,
                    to_date=to_date,
                    recheck=recheck,
                )
            finally:
                lock_connection.scalar(
                    text("SELECT pg_advisory_unlock(5043, hashtext(:game))"), {"game": game}
                )

    def _run_locked(
        self,
        game: str,
        kind: Literal["import", "collector"],
        *,
        start_id: str | None,
        end_id: str | None,
        from_date: date | None,
        to_date: date | None,
        recheck: bool,
    ) -> RunSummary:
        scope: dict[str, object] = {
            "start_id": start_id,
            "end_id": end_id,
            "from_date": from_date.isoformat() if from_date else None,
            "to_date": to_date.isoformat() if to_date else None,
            "recheck": recheck,
        }
        counts = {
            key: 0
            for key in (
                "created",
                "inserted",
                "unchanged",
                "skipped",
                "conflict",
                "missing",
                "invalid",
                "failed",
                "excluded",
                "resumed",
            )
        }
        with Session(self.engine) as session, session.begin():
            stale_runs = session.scalars(
                select(IngestionRunRow).where(
                    IngestionRunRow.game == game, IngestionRunRow.status == "running"
                )
            ).all()
            for stale in stale_runs:
                stale.status = "failed"
                stale.finished_at = self.now()
                stale.error_summary = (
                    "interrupted before completion; inspect ingestion_items and resume"
                )
            run = IngestionRunRow(
                game=game, kind=kind, scope=scope, status="running", counters=counts.copy()
            )
            session.add(run)
            session.flush()
            run_id = run.id
        status: Literal["success", "partial", "failed"] = "failed"
        error: str | None = None
        try:
            sequences = self._plan_ids(game, kind, start_id=start_id, end_id=end_id)
            pending: list[int] = []
            for sequence in sequences:
                if kind == "import" and not recheck:
                    with Session(self.engine) as session:
                        existing = session.get(IngestionItemRow, (game, sequence))
                        if existing is not None and existing.status == "found":
                            counts["resumed"] += 1
                            counts["skipped"] += 1
                            continue
                pending.append(sequence)

            def process(sequence: int) -> str:
                return self._process_one(
                    game, sequence, run_id, from_date=from_date, to_date=to_date
                )

            if kind == "import":
                with ThreadPoolExecutor(max_workers=3) as pool:
                    iterator = iter(pending)
                    active: deque[tuple[int, Future[str]]] = deque()
                    for sequence in iterator:
                        active.append((sequence, pool.submit(process, sequence)))
                        if len(active) == 3:
                            break
                    while active:
                        sequence, future = active.popleft()
                        outcome = future.result()
                        counts[outcome] += 1
                        if outcome == "created":
                            counts["inserted"] += 1
                        elif outcome == "unchanged":
                            counts["skipped"] += 1
                        if self.progress is not None and sequence % 50 == 0:
                            self.progress(sequence, counts.copy())
                        try:
                            following = next(iterator)
                        except StopIteration:
                            continue
                        active.append((following, pool.submit(process, following)))
            else:
                for sequence in pending:
                    outcome = process(sequence)
                    counts[outcome] += 1
                    if outcome == "created":
                        counts["inserted"] += 1
                    elif outcome == "unchanged":
                        counts["skipped"] += 1
            status = (
                "partial"
                if any(counts[key] for key in ("conflict", "missing", "invalid", "failed"))
                else "success"
            )
        except (SourceFetchError, SourceParseError, ImportPrerequisiteError) as exc:
            error = str(exc)[:500]
            status = "failed"
        except Exception as exc:
            # Job boundary records failure, then propagates unexpected bugs for logs/exit status.
            error = f"{type(exc).__name__}: {exc}"[:500]
            raise
        finally:
            with Session(self.engine) as session, session.begin():
                row = session.get(IngestionRunRow, run_id)
                if row is None:
                    raise RuntimeError(f"ingestion run {run_id} vanished")
                row.finished_at = self.now()
                row.status = status
                row.counters = {key: value for key, value in counts.items()}
                row.error_summary = error
        return RunSummary(run_id, game, kind, status, counts)

    def _plan_ids(
        self,
        game: str,
        kind: Literal["import", "collector"],
        *,
        start_id: str | None,
        end_id: str | None,
    ) -> Iterable[int]:
        latest = self._latest_source(game)
        if end_id is not None and int(end_id) > latest.draw_seq:
            raise ImportPrerequisiteError(
                f"{game}: requested end {end_id} exceeds source latest {latest.draw_id}"
            )
        upper = int(end_id) if end_id else latest.draw_seq
        if kind == "import":
            lower = int(start_id) if start_id else 1
            if lower > upper:
                raise ImportPrerequisiteError(
                    f"{game}: requested start {lower:05d} exceeds source latest {latest.draw_id}"
                )
            return range(lower, upper + 1)
        with Session(self.engine) as session:
            local_latest = DrawRepository(session).latest(game)
            if local_latest is None:
                raise ImportPrerequisiteError(f"{game}: no local history; run import first")
            checkpoint = session.get(IngestionCheckpointRow, game)
            if checkpoint is None:
                raise ImportPrerequisiteError(f"{game}: no import checkpoint; run import first")
            if checkpoint.last_scanned_seq > upper:
                raise ImportPrerequisiteError(
                    f"{game}: source latest {latest.draw_id} is behind checkpoint"
                )
            covered = (
                session.scalar(
                    select(func.count())
                    .select_from(IngestionItemRow)
                    .where(
                        IngestionItemRow.game == game,
                        IngestionItemRow.draw_seq <= checkpoint.last_scanned_seq,
                        IngestionItemRow.status != "excluded",
                    )
                )
                or 0
            )
            if covered != checkpoint.last_scanned_seq:
                raise ImportPrerequisiteError(
                    f"{game}: history coverage incomplete through {checkpoint.last_scanned_seq:05d}"
                )
            start = checkpoint.last_scanned_seq + 1
            unresolved = session.scalars(
                select(IngestionItemRow.draw_seq).where(
                    IngestionItemRow.game == game,
                    IngestionItemRow.status.in_(["missing", "invalid", "failed"]),
                    IngestionItemRow.draw_seq <= upper,
                )
            ).all()
        return sorted(
            set(range(start, upper + 1))
            | set(range(max(1, upper - 6), upper + 1))
            | set(unresolved)
        )

    def import_history(
        self,
        game: str,
        *,
        start_id: str | None = None,
        end_id: str | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
        recheck: bool = False,
    ) -> RunSummary:
        return self._run(
            game,
            "import",
            start_id=start_id,
            end_id=end_id,
            from_date=from_date,
            to_date=to_date,
            recheck=recheck,
        )

    def collect(self, game: str) -> RunSummary:
        return self._run(
            game,
            "collector",
            start_id=None,
            end_id=None,
            from_date=None,
            to_date=None,
            recheck=True,
        )

    def status(self, game: str) -> IngestionStatus:
        get_game(game)
        with Session(self.engine) as session:
            latest = DrawRepository(session).latest(game)
            success = session.scalar(
                select(func.max(IngestionRunRow.finished_at)).where(
                    IngestionRunRow.game == game, IngestionRunRow.status == "success"
                )
            )
            failure = session.scalar(
                select(func.max(IngestionRunRow.finished_at)).where(
                    IngestionRunRow.game == game,
                    IngestionRunRow.status.in_(["partial", "failed"]),
                )
            )
            unresolved = (
                session.scalar(
                    select(func.count())
                    .select_from(IngestionItemRow)
                    .where(
                        IngestionItemRow.game == game,
                        IngestionItemRow.status.in_(["missing", "invalid", "failed"]),
                    )
                )
                or 0
            )
            checkpoint = session.get(IngestionCheckpointRow, game)
            scanned = (
                session.scalar(
                    select(func.count())
                    .select_from(IngestionItemRow)
                    .where(
                        IngestionItemRow.game == game,
                        IngestionItemRow.draw_seq <= checkpoint.last_scanned_seq,
                    )
                )
                if checkpoint
                else 0
            ) or 0
            excluded = (
                session.scalar(
                    select(func.count())
                    .select_from(IngestionItemRow)
                    .where(IngestionItemRow.game == game, IngestionItemRow.status == "excluded")
                )
                or 0
            )
            return IngestionStatus(
                latest_draw_date=latest.draw_date if latest else None,
                last_successful_ingestion_at=success,
                last_failed_ingestion_at=failure,
                unresolved_items=unresolved,
                last_scanned_seq=checkpoint.last_scanned_seq if checkpoint else None,
                unscanned_ids_before_checkpoint=(checkpoint.last_scanned_seq - scanned)
                if checkpoint
                else 0,
                excluded_items=excluded,
            )
