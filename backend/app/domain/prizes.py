"""Published prize snapshots; conditions describe matches, never predict a result."""

from collections.abc import Mapping
from dataclasses import dataclass
from typing import cast

from app.games.definitions import DomainValidationError, get_game


@dataclass(frozen=True, slots=True)
class PrizeMatch:
    main_count: int
    special: bool

    def __post_init__(self) -> None:
        if (
            type(self.main_count) is not int
            or self.main_count < 0
            or type(self.special) is not bool
        ):
            raise DomainValidationError("prizes", "invalid match condition")
        if self.main_count == 0 and not self.special:
            raise DomainValidationError("prizes", "empty match condition")


@dataclass(frozen=True, slots=True)
class PrizeTier:
    name: str
    matches: tuple[PrizeMatch, ...]
    winner_count: int
    amount_vnd: int

    def __post_init__(self) -> None:
        if type(self.name) is not str or not self.name.strip() or len(self.name) > 100:
            raise DomainValidationError("prizes", "invalid prize name")
        for value in (self.winner_count, self.amount_vnd):
            if type(value) is not int or value < 0:
                raise DomainValidationError("prizes", "counts and VND must be nonnegative integers")
        if not self.matches or any(type(match) is not PrizeMatch for match in self.matches):
            raise DomainValidationError("prizes", "missing match conditions")
        if len(set(self.matches)) != len(self.matches):
            raise DomainValidationError("prizes", "duplicate match conditions")

    def payload(self) -> dict[str, object]:
        return {
            "name": self.name,
            "matches": [
                {"main_count": match.main_count, "special": match.special} for match in self.matches
            ],
            "winner_count": self.winner_count,
            "amount_vnd": self.amount_vnd,
        }

    @classmethod
    def from_payload(cls, raw: object) -> "PrizeTier":
        if not isinstance(raw, Mapping):
            raise DomainValidationError("prizes", "expected prize object")
        payload = cast(Mapping[str, object], raw)
        name, count, amount = (
            payload.get("name"),
            payload.get("winner_count"),
            payload.get("amount_vnd"),
        )
        raw_matches = payload.get("matches")
        if (
            not isinstance(name, str)
            or type(count) is not int
            or type(amount) is not int
            or not isinstance(raw_matches, list)
        ):
            raise DomainValidationError("prizes", "invalid prize payload")
        matches: list[PrizeMatch] = []
        for raw_match in cast(list[object], raw_matches):
            if not isinstance(raw_match, Mapping):
                raise DomainValidationError("prizes", "invalid match payload")
            match = cast(Mapping[str, object], raw_match)
            main, special = match.get("main_count"), match.get("special")
            if type(main) is not int or type(special) is not bool:
                raise DomainValidationError("prizes", "invalid match payload")
            matches.append(PrizeMatch(main, special))
        return cls(name, tuple(matches), count, amount)


def validate_prizes(game: str, prizes: tuple[PrizeTier, ...]) -> None:
    definition = get_game(game)
    if not prizes or len({tier.name.casefold() for tier in prizes}) != len(prizes):
        raise DomainValidationError("prizes", "empty or duplicate prize tiers")
    for tier in prizes:
        for match in tier.matches:
            if match.main_count > definition.main_count or (
                match.special and definition.special_max is None
            ):
                raise DomainValidationError("prizes", "match condition does not belong to game")
