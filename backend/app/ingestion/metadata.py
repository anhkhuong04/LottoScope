"""Official HTML conventions stay in the source adapter, separate from game rules."""

from dataclasses import dataclass

from app.games.definitions import GameId, get_game


@dataclass(frozen=True, slots=True)
class SourceDefinition:
    code: str
    result_class: str
    prize_class: str
    special_separator: str
    prize_names: tuple[str, ...]
    prize_matches: tuple[tuple[tuple[int, bool], ...], ...]


SOURCES: dict[GameId, SourceDefinition] = {
    GameId.LOTTO_535: SourceDefinition(
        "535",
        "lotto535",
        "maga535_table",
        "+",
        (
            "Giải Độc Đắc",
            "Giải Nhất",
            "Giải Nhì",
            "Giải Ba",
            "Giải Tư",
            "Giải Năm",
            "Giải Khuyến Khích",
        ),
        (
            ((5, True),),
            ((5, False),),
            ((4, True),),
            ((4, False),),
            ((3, True),),
            ((3, False),),
            ((2, True), (1, True), (0, True)),
        ),
    ),
    GameId.MEGA_645: SourceDefinition(
        "645",
        "mega645",
        "maga645_table",
        "+",
        ("Jackpot", "Giải Nhất", "Giải Nhì", "Giải Ba"),
        (((6, False),), ((5, False),), ((4, False),), ((3, False),)),
    ),
    GameId.POWER_655: SourceDefinition(
        "655",
        "mega645",
        "maga645_table",
        "|",
        ("Jackpot 1", "Jackpot 2", "Giải Nhất", "Giải Nhì", "Giải Ba"),
        (((6, False),), ((5, True),), ((5, False),), ((4, False),), ((3, False),)),
    ),
}


def get_source(game: str) -> SourceDefinition:
    return SOURCES[get_game(game).id]
