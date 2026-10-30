"""Canonical draws, combinations, and pairs."""

import hashlib
import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, time
from typing import cast
from urllib.parse import urlsplit

from app.domain.prizes import PrizeTier, validate_prizes
from app.games.definitions import DomainValidationError, GameDefinition, get_game

type CanonicalPayload = dict[str, object]


def normalize_main_numbers(game: str, numbers: Sequence[object]) -> tuple[int, ...]:
    definition = get_game(game)
    if len(numbers) != definition.main_count:
        raise DomainValidationError("main_numbers", f"expected {definition.main_count} numbers")
    seen: set[int] = set()
    normalized: list[int] = []
    for number in numbers:
        if type(number) is not int:
            raise DomainValidationError("main_numbers", "every number must be an integer")
        if not 1 <= number <= definition.main_max:
            raise DomainValidationError(
                "main_numbers", f"numbers must be in 1..{definition.main_max}"
            )
        if number in seen:
            raise DomainValidationError("main_numbers", f"duplicate number {number}")
        seen.add(number)
        normalized.append(number)
    return tuple(sorted(normalized))


def normalize_pair(game: str, first: object, second: object) -> tuple[int, int]:
    definition = get_game(game)
    if type(first) is not int or type(second) is not int:
        raise DomainValidationError("pair", "both numbers must be integers")
    if first == second:
        raise DomainValidationError("pair", "numbers must be different")
    if not (1 <= first <= definition.main_max and 1 <= second <= definition.main_max):
        raise DomainValidationError("pair", f"numbers must be in 1..{definition.main_max}")
    return (min(first, second), max(first, second))


def validate_draw_id(value: str) -> int:
    if type(value) is not str or len(value) != 5 or not value.isascii() or not value.isdigit():
        raise DomainValidationError("draw_id", "expected exactly five ASCII digits")
    sequence = int(value)
    if sequence == 0:
        raise DomainValidationError("draw_id", "sequence must be positive")
    return sequence


def _validate_special(definition: GameDefinition, value: object | None) -> int | None:
    if definition.special_max is None:
        if value is not None:
            raise DomainValidationError("special_number", "not used by this game")
        return None
    if type(value) is not int or not 1 <= value <= definition.special_max:
        raise DomainValidationError(
            "special_number", f"expected integer in 1..{definition.special_max}"
        )
    return value


@dataclass(frozen=True, slots=True)
class Combination:
    game: str
    main_numbers: tuple[int, ...]

    def __post_init__(self) -> None:
        definition = get_game(self.game)
        object.__setattr__(self, "game", definition.id.value)
        object.__setattr__(
            self, "main_numbers", normalize_main_numbers(self.game, self.main_numbers)
        )


@dataclass(frozen=True, slots=True)
class Draw:
    game: str
    draw_id: str
    draw_date: date
    draw_time: time | None
    main_numbers: tuple[int, ...]
    special_number: int | None
    source_url: str
    source_retrieved_at: datetime
    prizes: tuple[PrizeTier, ...] | None = None
    prizes_retrieved_at: datetime | None = None

    def __post_init__(self) -> None:
        definition = get_game(self.game)
        object.__setattr__(self, "game", definition.id.value)
        validate_draw_id(self.draw_id)
        if type(self.draw_date) is not date:
            raise DomainValidationError("draw_date", "expected a local calendar date")
        if self.draw_time is not None and type(self.draw_time) is not time:
            raise DomainValidationError("draw_time", "expected a local time or null")
        if self.draw_time is not None and self.draw_time.utcoffset() is not None:
            raise DomainValidationError("draw_time", "expected a local time without timezone")
        object.__setattr__(
            self, "main_numbers", normalize_main_numbers(self.game, self.main_numbers)
        )
        object.__setattr__(
            self, "special_number", _validate_special(definition, self.special_number)
        )
        if definition.special_excludes_main and self.special_number in self.main_numbers:
            raise DomainValidationError("special_number", "must differ from every main number")
        if type(self.source_url) is not str:
            raise DomainValidationError("source_url", "expected an HTTP(S) URL")
        parsed = urlsplit(self.source_url)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.netloc
            or any(character.isspace() for character in self.source_url)
        ):
            raise DomainValidationError("source_url", "expected an HTTP(S) URL")
        retrieved = self.source_retrieved_at
        if type(retrieved) is not datetime or retrieved.utcoffset() is None:
            raise DomainValidationError("source_retrieved_at", "expected an aware timestamp")
        object.__setattr__(self, "source_retrieved_at", retrieved.astimezone(UTC))
        if self.prizes is not None:
            validate_prizes(self.game, self.prizes)
            prize_time = self.prizes_retrieved_at or self.source_retrieved_at
            if prize_time.utcoffset() is None:
                raise DomainValidationError("prizes_retrieved_at", "expected aware timestamp")
            object.__setattr__(self, "prizes_retrieved_at", prize_time.astimezone(UTC))
        elif self.prizes_retrieved_at is not None:
            raise DomainValidationError("prizes", "timestamp requires a prize snapshot")

    @property
    def draw_seq(self) -> int:
        return int(self.draw_id)

    def canonical_payload(self) -> CanonicalPayload:
        return {
            "game": self.game,
            "draw_id": self.draw_id,
            "draw_date": self.draw_date.isoformat(),
            "draw_time": self.draw_time.isoformat() if self.draw_time is not None else None,
            "main_numbers": list(self.main_numbers),
            "special_number": self.special_number,
        }

    @property
    def source_sha256(self) -> str:
        encoded = json.dumps(self.canonical_payload(), sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(encoded.encode("utf-8")).hexdigest()

    def revision_payload(self) -> CanonicalPayload:
        payload = self.canonical_payload()
        if self.prizes is not None:
            payload["prizes"] = [tier.payload() for tier in self.prizes]
        return payload

    @property
    def revision_sha256(self) -> str:
        encoded = json.dumps(self.revision_payload(), sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(encoded.encode("utf-8")).hexdigest()

    @classmethod
    def from_canonical_payload(
        cls,
        payload: Mapping[str, object],
        *,
        source_url: str,
        source_retrieved_at: datetime,
    ) -> "Draw":
        game = payload.get("game")
        draw_id = payload.get("draw_id")
        raw_date = payload.get("draw_date")
        raw_time = payload.get("draw_time")
        raw_numbers = payload.get("main_numbers")
        special = payload.get("special_number")
        raw_prizes = payload.get("prizes")
        if raw_prizes is not None and not isinstance(raw_prizes, list):
            raise DomainValidationError("prizes", "expected prize list or null")
        prizes = (
            tuple(PrizeTier.from_payload(tier) for tier in cast(list[object], raw_prizes))
            if raw_prizes is not None
            else None
        )
        if not isinstance(game, str) or not isinstance(draw_id, str):
            raise DomainValidationError("payload", "missing game or draw_id")
        if not isinstance(raw_date, str) or not isinstance(raw_numbers, list):
            raise DomainValidationError("payload", "missing draw_date or main_numbers")
        numbers = cast(list[object], raw_numbers)
        if raw_time is not None and not isinstance(raw_time, str):
            raise DomainValidationError("draw_time", "expected string or null")
        try:
            parsed_date = date.fromisoformat(raw_date)
            parsed_time = time.fromisoformat(raw_time) if raw_time is not None else None
        except ValueError as exc:
            raise DomainValidationError("payload", "invalid draw date or time") from exc
        return cls(
            game=game,
            draw_id=draw_id,
            draw_date=parsed_date,
            draw_time=parsed_time,
            main_numbers=normalize_main_numbers(game, numbers),
            special_number=_validate_special(get_game(game), special),
            source_url=source_url,
            source_retrieved_at=source_retrieved_at,
            prizes=prizes,
        )
