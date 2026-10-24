"""Vietlott HTML adapter; no persistence or domain policy lives here."""

import re
from datetime import date, datetime
from html.parser import HTMLParser
from urllib.parse import parse_qs, urlsplit

from app.domain.draw import Draw, validate_draw_id
from app.games.definitions import DomainValidationError, get_game
from app.ingestion.metadata import get_source
from app.ingestion.prizes import parse_prizes


class SourceParseError(ValueError):
    """The source page is missing or contradicts a required result field."""


_HEADER = re.compile(r"Kỳ quay thưởng\s*#([0-9]{5})\s*ngày\s*(\d{2})/(\d{2})/(\d{4})", re.I)


def result_url(game: str, draw_id: str | None = None) -> str:
    source = get_source(game)
    if draw_id is not None:
        validate_draw_id(draw_id)
    base = f"https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/{source.code}"
    return f"{base}?id={draw_id}&nocatche=1" if draw_id else f"{base}?nocatche=1"


class _ResultHTML(HTMLParser):
    def __init__(self, result_class: str) -> None:
        super().__init__(convert_charrefs=True)
        self.result_class = result_class
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
                self.game_marker = self.result_class if self.result_class in classes else None
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
    include_prizes: bool = True,
) -> Draw:
    """Extract a single result and reject misleading HTTP 200 pages."""
    definition = get_game(game)
    source = get_source(game)
    parsed_url = urlsplit(source_url)
    if (
        parsed_url.hostname != "vietlott.vn"
        or parsed_url.path != f"/vi/trung-thuong/ket-qua-trung-thuong/{source.code}"
        or (expected_id is not None and parse_qs(parsed_url.query).get("id") != [expected_id])
    ):
        raise SourceParseError(f"{game}/{expected_id or 'latest'}: source URL game/ID mismatch")
    parser = _ResultHTML(source.result_class)
    parser.feed(html)
    expected_title = f"Kết quả quay số mở thưởng {definition.label}"
    if (
        parser.results_seen != 1
        or parser.root_depth is not None
        or parser.game_marker != source.result_class
        or parser.game_title is None
        or expected_title.casefold() != parser.game_title.casefold()
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
        if definition.special_max is not None and len(specials) != 1:
            raise ValueError("expected exactly one special number")
        if definition.special_max is None and specials:
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
            prizes=parse_prizes(html, game) if include_prizes else None,
        )
    except (ValueError, DomainValidationError) as exc:
        raise SourceParseError(f"{game}/{draw_id}: invalid source result: {exc}") from exc
