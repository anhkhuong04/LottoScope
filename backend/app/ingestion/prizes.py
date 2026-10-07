"""Extract only the official per-game prize table, preserving zero and special matches."""

import re
from html.parser import HTMLParser

from app.domain.prizes import PrizeMatch, PrizeTier, validate_prizes

_NAMES = {
    "lotto_535": (
        "Giải Độc Đắc",
        "Giải Nhất",
        "Giải Nhì",
        "Giải Ba",
        "Giải Tư",
        "Giải Năm",
        "Giải Khuyến Khích",
    ),
    "mega_645": ("Jackpot", "Giải Nhất", "Giải Nhì", "Giải Ba"),
}
_HEADERS = ("Giải thưởng", "Kết quả", "Số lượng giải", "Giá trị giải (đồng)")


def _integer(text: str) -> int:
    value = text.strip()
    if re.fullmatch(r"(?:0|[1-9][0-9]*|[1-9][0-9]{0,2}(?:\.[0-9]{3})+)", value) is None:
        raise ValueError("invalid prize integer")
    return int(value.replace(".", ""))


class _PrizeHTML(HTMLParser):
    def __init__(self, game: str) -> None:
        super().__init__(convert_charrefs=True)
        self.game = game
        self.depth = 0
        self.wrapper: int | None = None
        self.wrappers = 0
        self.tables = 0
        self.in_table = False
        self.in_body = False
        self.cell: list[str] | None = None
        self.cells: list[str] = []
        self.headers: list[tuple[str, ...]] = []
        self.rows: list[PrizeTier] = []
        self.matches: list[PrizeMatch] = []
        self.main_count = 0
        self.special_count = 0
        self.plus_count = 0
        self.span_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        classes = set((dict(attrs).get("class") or "").split())
        if tag == "div":
            self.depth += 1
            if "chitietketqua_table" in classes:
                expected = "maga535_table" if self.game == "lotto_535" else "maga645_table"
                if expected not in classes:
                    raise ValueError("prize table game mismatch")
                self.wrappers += 1
                self.wrapper = self.depth
        elif tag == "table" and self.wrapper is not None:
            self.tables += 1
            self.in_table = True
        if not self.in_table:
            return
        if tag == "tbody":
            self.in_body = True
        elif tag == "tr":
            self.cells = []
            self.matches = []
        elif tag in {"td", "th"}:
            self.cell = []
            self.span_depth = self.main_count = self.special_count = self.plus_count = 0
        elif self.cell is not None and len(self.cells) == 1 and self.in_body:
            if tag == "span":
                self.span_depth += 1
            elif tag == "br":
                self._finish_match()

    def handle_data(self, data: str) -> None:
        if self.cell is None:
            return
        self.cell.append(data)
        if self.in_body and len(self.cells) == 1:
            if re.search(r"[^O+\s]", data):
                raise ValueError("unknown prize match notation")
            for symbol in data:
                if symbol.isspace():
                    continue
                if symbol == "+":
                    if (
                        self.span_depth
                        or not self.main_count
                        or self.plus_count
                        or self.special_count
                    ):
                        raise ValueError("invalid special match separator")
                    self.plus_count += 1
                elif self.span_depth:
                    if self.main_count and not self.plus_count:
                        raise ValueError("missing special match separator")
                    self.special_count += 1
                else:
                    if self.plus_count or self.special_count:
                        raise ValueError("missing special match markup")
                    self.main_count += 1

    def _finish_match(self) -> None:
        if self.special_count > 1 or (self.plus_count and self.special_count != 1):
            raise ValueError("multiple special matches")
        if self.main_count or self.special_count:
            self.matches.append(PrizeMatch(self.main_count, self.special_count == 1))
        self.main_count = self.special_count = self.plus_count = 0

    def handle_endtag(self, tag: str) -> None:
        if tag == "div":
            if self.depth == self.wrapper:
                self.wrapper = None
            self.depth -= 1
        if not self.in_table:
            return
        if tag == "span" and self.cell is not None and self.span_depth:
            self.span_depth -= 1
        elif tag in {"td", "th"} and self.cell is not None:
            if self.in_body and len(self.cells) == 1:
                self._finish_match()
            self.cells.append(" ".join("".join(self.cell).split()))
            self.cell = None
        elif tag == "tr":
            if self.in_body:
                if len(self.cells) != 4:
                    raise ValueError("prize row must have four cells")
                name, _condition, count, amount = self.cells
                self.rows.append(
                    PrizeTier(name, tuple(self.matches), _integer(count), _integer(amount))
                )
            else:
                self.headers.append(tuple(self.cells))
        elif tag == "tbody":
            self.in_body = False
        elif tag == "table":
            self.in_table = False


def parse_prizes(html: str, game: str) -> tuple[PrizeTier, ...] | None:
    """Missing legacy table is unknown; a present but malformed table is an error."""
    parser = _PrizeHTML(game)
    parser.feed(html)
    if parser.wrappers == 0:
        return None
    if (
        parser.wrappers != 1
        or parser.tables != 1
        or parser.in_table
        or parser.in_body
        or parser.cell is not None
        or _HEADERS not in parser.headers
        or tuple(tier.name.casefold() for tier in parser.rows)
        != tuple(name.casefold() for name in _NAMES[game])
    ):
        raise ValueError("prize table structure/tiers changed")
    prizes = tuple(parser.rows)
    validate_prizes(game, prizes)
    return prizes
