"""Vietlott HTML adapter; no persistence or domain policy lives here."""

import re
from datetime import date, datetime
from html.parser import HTMLParser

from app.domain.draw import Draw, validate_draw_id
from app.games.definitions import DomainValidationError, get_game
from app.ingestion.prizes import parse_prizes


class SourceParseError(ValueError):
    """The source page is missing or contradicts a required result field."""


_HEADER = re.compile(r"Kỳ quay thưởng\s*#([0-9]{5})\s*ngày\s*(\d{2})/(\d{2})/(\d{4})", re.I)
_PATH = {"lotto_535": "535", "mega_645": "645"}


def result_url(game: str, draw_id: str | None = None) -> str:
    definition = get_game(game)
    if draw_id is not None:
        validate_draw_id(draw_id)
    base = f"https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/{_PATH[definition.id.value]}"
    return f"{base}?id={draw_id}&nocatche=1" if draw_id else f"{base}?nocatche=1"


class _ResultHTML(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.root_depth: int | None = None
        self.title_depth: int | None = None
        self.numbers_depth: int | None = None
        self.capture: str | None = None
        self.capture_text: list[str] = []
        self.game_marker: str | None = None
        self.game_title: str | None = None
        self.heading: str | None = None
        self.numbers: list[tuple[str, bool]] = []
        self.results_seen = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        classes = set((attributes.get("class") or "").split())
        if tag == "div":
            self.depth += 1
            if "chitietketqua" in classes:
                self.results_seen += 1
                self.root_depth = self.depth
                self.game_marker = (
                    "lotto_535"
                    if "lotto535" in classes
                    else ("mega_645" if "mega645" in classes else None)
                )
            elif self.root_depth is not None and "chitietketqua_title" in classes:
                self.title_depth = self.depth
            elif self.root_depth is not None and "day_so_ket_qua_v2" in classes:
                self.numbers_depth = self.depth
        if self.title_depth is not None and tag == "h5":
            self.capture = "heading"
            self.capture_text = []
        if self.title_depth is not None and tag == "h4":
            self.capture = "game_title"
            self.capture_text = []
        if self.numbers_depth is not None and tag == "span" and "bong_tron" in classes:
            self.capture = "number_active" if "active" in classes else "number"
            self.capture_text = []

    def handle_data(self, data: str) -> None:
        if self.capture is not None:
            self.capture_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "h5" and self.capture == "heading":
            self.heading = " ".join("".join(self.capture_text).split())
            self.capture = None
        elif tag == "h4" and self.capture == "game_title":
            self.game_title = " ".join("".join(self.capture_text).split())
            self.capture = None
        elif tag == "span" and self.capture in {"number", "number_active"}:
            self.numbers.append(
                ("".join(self.capture_text).strip(), self.capture == "number_active")
            )
            self.capture = None
        elif tag == "div":
            if self.depth == self.title_depth:
                self.title_depth = None
            if self.depth == self.numbers_depth:
                self.numbers_depth = None
            if self.depth == self.root_depth:
                self.root_depth = None
            self.depth -= 1


def parse_result(
    html: str,
    *,
    game: str,
    expected_id: str | None,
    source_url: str,
    retrieved_at: datetime,
) -> Draw:
    """Extract a single result and reject misleading HTTP 200 pages."""
    get_game(game)
    parser = _ResultHTML()
    parser.feed(html)
    expected_title = "Lotto 5/35" if game == "lotto_535" else "Mega 6/45"
    if (
        parser.results_seen != 1
        or parser.root_depth is not None
        or parser.game_marker != game
        or parser.game_title is None
        or expected_title.casefold() not in parser.game_title.casefold()
        or parser.heading is None
    ):
        raise SourceParseError(
            f"{game}/{expected_id or 'latest'}: result block/game/heading missing"
        )
    match = _HEADER.fullmatch(parser.heading)
    if match is None:
        raise SourceParseError(f"{game}/{expected_id or 'latest'}: draw ID/date format changed")
    draw_id, day, month, year = match.groups()
    if expected_id is not None and draw_id != expected_id:
        raise SourceParseError(f"{game}/{expected_id}: source returned draw {draw_id}")
    try:
        draw_date = date(int(year), int(month), int(day))
        numbers = [
            (int(value), active)
            for value, active in parser.numbers
            if value.isascii() and value.isdecimal()
        ]
        if len(numbers) != len(parser.numbers):
            raise ValueError("invalid number text")
        main = tuple(value for value, active in numbers if not active)
        specials = [value for value, active in numbers if active]
        if game == "lotto_535" and len(specials) != 1:
            raise ValueError("expected exactly one special number")
        if game == "mega_645" and specials:
            raise ValueError("unexpected special number")
        return Draw(
            game=game,
            draw_id=draw_id,
            draw_date=draw_date,
            draw_time=None,
            main_numbers=main,
            special_number=specials[0] if specials else None,
            source_url=source_url,
            source_retrieved_at=retrieved_at,
            prizes=parse_prizes(html, game),
        )
    except (ValueError, DomainValidationError) as exc:
        raise SourceParseError(f"{game}/{draw_id}: invalid source result: {exc}") from exc
