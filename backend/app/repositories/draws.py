"""Draw repository. Callers own the SQLAlchemy transaction boundary."""

from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Literal

from sqlalchemy import func, select, tuple_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.domain.draw import Draw, validate_draw_id
from app.games.definitions import DomainValidationError, get_game
from app.models.draw import DrawCorrectionRow, DrawRow, GameDataStateRow


class StoredDrawError(RuntimeError):
    """Persisted result has broken a domain invariant."""


class CorrectionError(ValueError):
    """A requested correction cannot be safely applied."""


@dataclass(frozen=True, slots=True)
class WriteResult:
    status: Literal["created", "unchanged", "conflict"]
    draw_pk: int
    correction_id: int | None = None


@dataclass(frozen=True, slots=True)
class DrawPage:
    items: tuple[Draw, ...]
    page: int
    page_size: int
    total: int


def _to_domain(row: DrawRow) -> Draw:
    try:
        draw = Draw(
            game=row.game,
            draw_id=row.draw_id,
            draw_date=row.draw_date,
            draw_time=row.draw_time,
            main_numbers=tuple(row.main_numbers),
            special_number=row.special_number,
            source_url=row.source_url,
            source_retrieved_at=row.source_retrieved_at,
        )
    except DomainValidationError as exc:
        raise StoredDrawError(f"invalid stored draw {row.game}/{row.draw_id}") from exc
    if draw.source_sha256 != row.source_sha256:
        raise StoredDrawError(f"content hash mismatch for {row.game}/{row.draw_id}")
    return draw


class DrawRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def _lock_state(self, game: str) -> GameDataStateRow:
        self.session.execute(
            insert(GameDataStateRow)
            .values(game=game)
            .on_conflict_do_nothing(index_elements=["game"])
        )
        state = self.session.scalar(
            select(GameDataStateRow)
            .where(GameDataStateRow.game == game)
            .with_for_update(of=GameDataStateRow)
        )
        if state is None:
            raise StoredDrawError(f"missing data state for {game}")
        return state

    def _check_chronology(self, draw: Draw, *, exclude_pk: int | None = None) -> None:
        older = select(DrawRow.draw_date).where(
            DrawRow.game == draw.game, DrawRow.draw_seq < draw.draw_seq
        )
        newer = select(DrawRow.draw_date).where(
            DrawRow.game == draw.game, DrawRow.draw_seq > draw.draw_seq
        )
        if exclude_pk is not None:
            older = older.where(DrawRow.id != exclude_pk)
            newer = newer.where(DrawRow.id != exclude_pk)
        previous_date = self.session.scalar(older.order_by(DrawRow.draw_seq.desc()).limit(1))
        next_date = self.session.scalar(newer.order_by(DrawRow.draw_seq.asc()).limit(1))
        if (previous_date is not None and previous_date > draw.draw_date) or (
            next_date is not None and next_date < draw.draw_date
        ):
            raise DomainValidationError("draw_date", "conflicts with neighboring draw IDs")

    @staticmethod
    def _bump_state(state: GameDataStateRow) -> None:
        state.version += 1
        state.updated_at = datetime.now(UTC)

    def add(self, draw: Draw) -> WriteResult:
        """Insert once, or audit changed content without overwriting the official draw."""
        state = self._lock_state(draw.game)
        existing = self.session.scalar(
            select(DrawRow)
            .where(DrawRow.game == draw.game, DrawRow.draw_id == draw.draw_id)
            .with_for_update(of=DrawRow)
        )
        if existing is None:
            self._check_chronology(draw)
            statement = (
                insert(DrawRow)
                .values(
                    game=draw.game,
                    draw_id=draw.draw_id,
                    draw_seq=draw.draw_seq,
                    draw_date=draw.draw_date,
                    draw_time=draw.draw_time,
                    main_numbers=list(draw.main_numbers),
                    special_number=draw.special_number,
                    source_url=draw.source_url,
                    source_retrieved_at=draw.source_retrieved_at,
                    source_sha256=draw.source_sha256,
                )
                .on_conflict_do_nothing(index_elements=["game", "draw_id"])
                .returning(DrawRow.id)
            )
            inserted_pk = self.session.scalar(statement)
            if inserted_pk is not None:
                self._bump_state(state)
                return WriteResult("created", inserted_pk)
            existing = self.session.scalar(
                select(DrawRow)
                .where(DrawRow.game == draw.game, DrawRow.draw_id == draw.draw_id)
                .with_for_update(of=DrawRow)
            )
        if existing is None:
            raise StoredDrawError(f"conflict target vanished for {draw.game}/{draw.draw_id}")
        current = _to_domain(existing)
        if current.canonical_payload() == draw.canonical_payload():
            return WriteResult("unchanged", existing.id)

        pending = self.session.scalar(
            select(DrawCorrectionRow).where(
                DrawCorrectionRow.draw_pk == existing.id,
                DrawCorrectionRow.new_sha256 == draw.source_sha256,
                DrawCorrectionRow.status == "pending",
            )
        )
        if pending is None:
            pending = DrawCorrectionRow(
                draw_pk=existing.id,
                status="pending",
                old_payload=current.canonical_payload(),
                new_payload=draw.canonical_payload(),
                new_sha256=draw.source_sha256,
                source_url=draw.source_url,
                source_retrieved_at=draw.source_retrieved_at,
                reason="source_content_changed",
            )
            self.session.add(pending)
            self.session.flush()
        return WriteResult("conflict", existing.id, pending.id)

    def apply_correction(self, correction_id: int, *, reason: str) -> Draw:
        if type(correction_id) is not int or correction_id <= 0:
            raise CorrectionError("correction ID must be positive")
        if not reason.strip():
            raise CorrectionError("a review reason is required")
        game = self.session.scalar(
            select(DrawRow.game)
            .join(DrawCorrectionRow, DrawCorrectionRow.draw_pk == DrawRow.id)
            .where(DrawCorrectionRow.id == correction_id)
        )
        if game is None:
            raise CorrectionError("correction not found")
        state = self._lock_state(game)
        pending = self.session.scalar(
            select(DrawCorrectionRow)
            .where(DrawCorrectionRow.id == correction_id)
            .with_for_update(of=DrawCorrectionRow)
        )
        if pending is None or pending.status != "pending":
            raise CorrectionError("correction is not pending")
        row = self.session.scalar(
            select(DrawRow).where(DrawRow.id == pending.draw_pk).with_for_update(of=DrawRow)
        )
        if row is None:
            raise StoredDrawError("correction target vanished")
        if _to_domain(row).canonical_payload() != pending.old_payload:
            raise CorrectionError("correction is stale; stored draw has changed")
        replacement = Draw.from_canonical_payload(
            pending.new_payload,
            source_url=pending.source_url,
            source_retrieved_at=pending.source_retrieved_at,
        )
        if (replacement.game, replacement.draw_id) != (row.game, row.draw_id):
            raise CorrectionError("correction cannot change draw identity")
        if replacement.source_sha256 != pending.new_sha256:
            raise CorrectionError("correction payload hash mismatch")
        self._check_chronology(replacement, exclude_pk=row.id)
        row.draw_date = replacement.draw_date
        row.draw_time = replacement.draw_time
        row.main_numbers = list(replacement.main_numbers)
        row.special_number = replacement.special_number
        row.source_url = replacement.source_url
        row.source_retrieved_at = replacement.source_retrieved_at
        row.source_sha256 = replacement.source_sha256
        row.updated_at = datetime.now(UTC)
        pending.status = "applied"
        pending.resolution_note = reason.strip()
        pending.applied_at = datetime.now(UTC)
        self._bump_state(state)
        return replacement

    def get_by_id(self, game: str, draw_id: str) -> Draw | None:
        definition = get_game(game)
        validate_draw_id(draw_id)
        row = self.session.scalar(
            select(DrawRow).where(DrawRow.game == definition.id.value, DrawRow.draw_id == draw_id)
        )
        return _to_domain(row) if row is not None else None

    def latest(self, game: str) -> Draw | None:
        definition = get_game(game)
        row = self.session.scalar(
            select(DrawRow)
            .where(DrawRow.game == definition.id.value)
            .order_by(DrawRow.draw_date.desc(), DrawRow.draw_seq.desc())
            .limit(1)
        )
        return _to_domain(row) if row is not None else None

    def latest_n(self, game: str, count: int) -> tuple[Draw, ...]:
        definition = get_game(game)
        if type(count) is not int or not 1 <= count <= 100:
            raise DomainValidationError("count", "expected integer in 1..100")
        rows = self.session.scalars(
            select(DrawRow)
            .where(DrawRow.game == definition.id.value)
            .order_by(DrawRow.draw_date.desc(), DrawRow.draw_seq.desc())
            .limit(count)
        ).all()
        return tuple(_to_domain(row) for row in rows)

    def data_version(self, game: str) -> int:
        definition = get_game(game)
        return (
            self.session.scalar(
                select(GameDataStateRow.version).where(GameDataStateRow.game == definition.id.value)
            )
            or 0
        )

    def window_draws(
        self,
        game: str,
        *,
        cutoff: Draw | None,
        last_count: int | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> tuple[Draw, ...]:
        """Return an inclusive chronological window, oldest first."""
        definition = get_game(game)
        if cutoff is None:
            return ()
        if cutoff.game != definition.id.value:
            raise DomainValidationError("cutoff", "must belong to the requested game")
        statement = select(DrawRow).where(
            DrawRow.game == definition.id.value,
            tuple_(DrawRow.draw_date, DrawRow.draw_seq) <= (cutoff.draw_date, cutoff.draw_seq),
        )
        if from_date is not None:
            statement = statement.where(DrawRow.draw_date >= from_date)
        if to_date is not None:
            statement = statement.where(DrawRow.draw_date <= to_date)
        statement = statement.order_by(DrawRow.draw_date.desc(), DrawRow.draw_seq.desc())
        if last_count is not None:
            statement = statement.limit(last_count)
        rows = self.session.scalars(statement).all()
        return tuple(_to_domain(row) for row in reversed(rows))

    def list_draws(
        self,
        game: str,
        *,
        from_date: date | None = None,
        to_date: date | None = None,
        draw_id: str | None = None,
        main_contains: tuple[int, ...] | None = None,
        first: Draw | None = None,
        last: Draw | None = None,
        page: int = 1,
        page_size: int = 25,
        sort: Literal["asc", "desc"] = "desc",
    ) -> DrawPage:
        definition = get_game(game)
        if from_date is not None and type(from_date) is not date:
            raise DomainValidationError("from_date", "expected date")
        if to_date is not None and type(to_date) is not date:
            raise DomainValidationError("to_date", "expected date")
        if from_date is not None and to_date is not None and from_date > to_date:
            raise DomainValidationError("date_range", "from_date must be <= to_date")
        if draw_id is not None:
            validate_draw_id(draw_id)
        if main_contains is not None:
            if (
                not main_contains
                or len(main_contains) > definition.main_count
                or any(
                    type(number) is not int or not 1 <= number <= definition.main_max
                    for number in main_contains
                )
                or len(set(main_contains)) != len(main_contains)
            ):
                raise DomainValidationError(
                    "main_contains", "expected distinct main numbers in range"
                )
        if first is not None and first.game != definition.id.value:
            raise DomainValidationError("first", "must belong to the requested game")
        if last is not None and last.game != definition.id.value:
            raise DomainValidationError("last", "must belong to the requested game")
        if type(page) is not int or page < 1:
            raise DomainValidationError("page", "expected positive integer")
        if type(page_size) is not int or not 1 <= page_size <= 100:
            raise DomainValidationError("page_size", "expected integer in 1..100")
        if sort not in {"asc", "desc"}:
            raise DomainValidationError("sort", "expected asc or desc")
        filters = [DrawRow.game == definition.id.value]
        if from_date is not None:
            filters.append(DrawRow.draw_date >= from_date)
        if to_date is not None:
            filters.append(DrawRow.draw_date <= to_date)
        if draw_id is not None:
            filters.append(DrawRow.draw_id == draw_id)
        if main_contains is not None:
            filters.append(DrawRow.main_numbers.contains(list(main_contains)))
        if first is not None:
            filters.append(
                tuple_(DrawRow.draw_date, DrawRow.draw_seq) >= (first.draw_date, first.draw_seq)
            )
        if last is not None:
            filters.append(
                tuple_(DrawRow.draw_date, DrawRow.draw_seq) <= (last.draw_date, last.draw_seq)
            )
        total = self.session.scalar(select(func.count()).select_from(DrawRow).where(*filters)) or 0
        order = (
            (DrawRow.draw_date.asc(), DrawRow.draw_seq.asc())
            if sort == "asc"
            else (DrawRow.draw_date.desc(), DrawRow.draw_seq.desc())
        )
        rows = self.session.scalars(
            select(DrawRow)
            .where(*filters)
            .order_by(*order)
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
        return DrawPage(tuple(_to_domain(row) for row in rows), page, page_size, total)
