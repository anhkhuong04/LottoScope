"""One source for the rules of each supported game."""

from dataclasses import dataclass
from enum import StrEnum


class DomainValidationError(ValueError):
    def __init__(self, field: str, message: str) -> None:
        super().__init__(f"{field}: {message}")
        self.field = field


class GameId(StrEnum):
    LOTTO_535 = "lotto_535"
    MEGA_645 = "mega_645"


@dataclass(frozen=True, slots=True)
class GameDefinition:
    id: GameId
    label: str
    main_count: int
    main_max: int
    special_max: int | None

    @property
    def main_min(self) -> int:
        return 1

    @property
    def special_min(self) -> int | None:
        return 1 if self.special_max is not None else None


GAMES: dict[GameId, GameDefinition] = {
    GameId.LOTTO_535: GameDefinition(GameId.LOTTO_535, "Lotto 5/35", 5, 35, 12),
    GameId.MEGA_645: GameDefinition(GameId.MEGA_645, "Mega 6/45", 6, 45, None),
}


def get_game(value: str) -> GameDefinition:
    try:
        return GAMES[GameId(value)]
    except ValueError as exc:
        raise DomainValidationError("game", "unsupported game") from exc
