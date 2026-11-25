"""Bounded result-only HTML adapters for the approved fallback publishers."""

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit
from zoneinfo import ZoneInfo

from app.domain.draw import Draw
from app.domain.prizes import PrizeMatch, PrizeTier, validate_prizes
from app.games.definitions import get_game
from app.ingestion.metadata import get_source
from app.ingestion.service import PageFetcher

MAX_PAGES = 12
_URLS = {
    "lotto_535": "https://www.minhchinh.com/xo-so-dien-toan-lotto-535.html",
    "mega_645": "https://www.minhngoc.net.vn/ket-qua-xo-so/dien-toan-vietlott/mega-6x45.html",
    "power_655": "https://www.minhngoc.net.vn/ket-qua-xo-so/dien-toan-vietlott/power-6x55.html",
}
_MINHCHINH_HEADERS = ("giải", "trùng khớp", "số lượng", "giá trị")
_MINHNGOC_HEADERS = ("giải thưởng", "trùng khớp", "số lượng giải", "giá trị giải (đồng)")
_TIER_ALIASES = {
    "độc đắc": "giải độc đắc",
    "giải kk": "giải khuyến khích",
    "kk": "giải khuyến khích",
}


def feed_url(game: str) -> str:
    get_game(game)
    return _URLS[game]


def _fallback_integer(text: str, *, allow_currency: bool = False) -> int:
    value = " ".join(text.split())
    if allow_currency:
        value = re.sub(r"\s*(?:vnđ|vnd|đ)$", "", value, flags=re.IGNORECASE).strip()
    if re.fullmatch(r"(?:0|[1-9][0-9]*|[1-9][0-9]{0,2}(?:,[0-9]{3})+)", value) is None:
        raise ValueError(f"invalid fallback prize integer: {text!r}")
    return int(value.replace(",", ""))


def _is_prize_header(header: tuple[str, ...]) -> bool:
    return header in (_MINHCHINH_HEADERS, _MINHNGOC_HEADERS)


def _looks_like_prize_header(header: tuple[str, ...]) -> bool:
    return len(header) >= 2 and (
        "trùng khớp" in header
        or "số lượng giải" in header
        or any(col in ("giải thưởng", "giải") for col in header)
    )


def _parse_prize_rows(
    game: str, rows: list[tuple[tuple[str, ...], tuple[PrizeMatch, ...]]]
) -> tuple[PrizeTier, ...]:
    source = get_source(game)
    if len(rows) != len(source.prize_names):
        raise ValueError("fallback prize tier count mismatch")
    tiers: list[PrizeTier] = []
    for index, (cells, matches) in enumerate(rows):
        if len(cells) != 4:
            raise ValueError("fallback prize row must have 4 cells")
        raw_name, _condition, raw_count, raw_amount = cells
        normalized = " ".join(raw_name.split()).casefold()
        normalized = _TIER_ALIASES.get(normalized, normalized)
        canonical_name = source.prize_names[index]
        if normalized != canonical_name.casefold():
            raise ValueError(f"fallback prize tier mismatch: {raw_name}")
        if (
            tuple((match.main_count, match.special) for match in matches)
            != source.prize_matches[index]
        ):
            raise ValueError(f"fallback prize match mismatch for {canonical_name}")
        tiers.append(
            PrizeTier(
                canonical_name,
                matches,
                _fallback_integer(raw_count),
                _fallback_integer(raw_amount, allow_currency=True),
            )
        )
    prizes = tuple(tiers)
    validate_prizes(game, prizes)
    return prizes


@dataclass
class _TableCell:
    is_header: bool
    text: list[str] = field(default_factory=lambda: list[str]())
    matches: list[PrizeMatch] = field(default_factory=lambda: list[PrizeMatch]())
    line_depth: int | None = None
    ball_zone: str | None = None
    zone_depth: int | None = None
    line_main: int = 0
    line_special: bool = False
    has_sep: bool = False
    saw_line_circle: bool = False
    saw_italic: bool = False
    invalid_match: bool = False


@dataclass
class _TableRow:
    cells: list[str] = field(default_factory=lambda: list[str]())
    cell_is_header: list[bool] = field(default_factory=lambda: list[bool]())
    matches: tuple[PrizeMatch, ...] = ()
    cell: _TableCell | None = None
    invalid_match: bool = False


@dataclass
class _TableState:
    in_body: bool = False
    headers: list[tuple[str, ...]] = field(default_factory=lambda: list[tuple[str, ...]]())
    rows: list[tuple[tuple[str, ...], tuple[PrizeMatch, ...]]] = field(
        default_factory=lambda: list[tuple[tuple[str, ...], tuple[PrizeMatch, ...]]]()
    )
    row: _TableRow | None = None
    invalid_match: bool = False


@dataclass
class _Card:
    text: list[str] = field(default_factory=lambda: list[str]())
    numbers: list[tuple[str, bool]] = field(default_factory=lambda: list[tuple[str, bool]]())
    prizes: tuple[PrizeTier, ...] | None = None
    table_stack: list[_TableState] = field(default_factory=lambda: list[_TableState]())


class _Page(HTMLParser):
    """Scope balls and prize tables to result cards; reject structural drift."""

    def __init__(self, game: str) -> None:
        super().__init__(convert_charrefs=True)
        self.game = game
        self.depth = 0
        self.root: int | None = None
        self.number_root: int | None = None
        self.number_list = False
        self.special = False
        self.capture: tuple[str, list[str], bool] | None = None
        self.card: _Card | None = None
        self.cards: list[_Card] = []
        self.links: list[str] = []
        self.ignored = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        classes = set((values.get("class") or "").split())
        if tag in ("script", "style"):
            self.ignored += 1
        if tag == "a" and (href := values.get("href")):
            self.links.append(href)
        if tag == "div":
            self.depth += 1
            if self.card is None or not self.card.table_stack:
                marker = "boxketqua_vl" if self.game == "lotto_535" else "boxkqxsdientoan"
                if marker in classes:
                    if self.card is not None or len(self.cards) >= 200:
                        raise ValueError("nested or excessive publisher result cards")
                    self.root = self.depth
                    self.card = _Card()
                if self.card is not None and "box_ketqua" in classes:
                    self.number_root = self.depth
            else:
                table = self.card.table_stack[-1]
                if (
                    table.row is not None
                    and table.row.cell is not None
                    and not table.row.cell.is_header
                    and len(table.row.cells) == 1
                ):
                    cell = table.row.cell
                    if "line-circle-num" in classes:
                        if cell.line_depth is not None or cell.saw_italic:
                            cell.invalid_match = True
                        else:
                            cell.line_depth = self.depth
                            cell.saw_line_circle = True
                            cell.line_main = 0
                            cell.line_special = False
                            cell.ball_zone = None
                            cell.zone_depth = None
                    elif cell.line_depth is not None and "circle-line-normal" in classes:
                        cell.ball_zone = "normal"
                        cell.zone_depth = self.depth
                    elif cell.line_depth is not None and "circle-line-special" in classes:
                        cell.ball_zone = "special"
                        cell.zone_depth = self.depth
        if self.card is None:
            return
        if tag == "table":
            self.card.table_stack.append(_TableState())
            return
        if self.card.table_stack:
            self._start_prize_tag(self.card.table_stack[-1], tag, classes)
            return
        if tag == "ul" and "result-number" in classes:
            self.number_list = True
        if self.number_list and tag == "li":
            self.special = "number_special" in classes
        if (self.number_root is not None and tag == "span" and "ball" in classes) or (
            self.number_list and tag == "div" and "bool" in classes
        ):
            if self.capture is not None:
                raise ValueError("nested publisher ball")
            self.capture = (tag, [], self.special or "ball_lotto_2" in classes)

    def _start_prize_tag(self, table: _TableState, tag: str, classes: set[str]) -> None:
        if tag == "tbody":
            table.in_body = True
        elif tag == "thead":
            table.in_body = False
        elif tag == "tr":
            table.row = _TableRow()
        elif tag in {"td", "th"} and table.row is not None:
            table.row.cell = _TableCell(is_header=(tag == "th"))
        elif (
            table.row is not None
            and table.row.cell is not None
            and not table.row.cell.is_header
            and len(table.row.cells) == 1
        ):
            cell = table.row.cell
            if tag == "span" and "ball" in classes and cell.line_depth is not None:
                if "ball_lotto_2" in classes:
                    if cell.ball_zone == "normal" or cell.line_special:
                        cell.invalid_match = True
                    else:
                        cell.line_special = True
                elif "ball_lotto" in classes:
                    if cell.ball_zone == "special":
                        cell.invalid_match = True
                    else:
                        cell.line_main += 1
            elif tag == "i" and not cell.saw_line_circle:
                cell.saw_italic = True
                if "number_device_i" in classes:
                    if cell.has_sep or cell.line_special or cell.line_main == 0:
                        cell.invalid_match = True
                    else:
                        cell.has_sep = True
                elif "number_special_i" in classes:
                    if cell.line_special or (cell.line_main > 0 and not cell.has_sep):
                        cell.invalid_match = True
                    else:
                        cell.line_special = True
                elif cell.has_sep or cell.line_special:
                    cell.invalid_match = True
                else:
                    cell.line_main += 1

    def handle_data(self, data: str) -> None:
        if self.card is not None and not self.ignored:
            self.card.text.append(data)
            if self.capture is not None:
                self.capture[1].append(data)
            if (
                self.card.table_stack
                and (row := self.card.table_stack[-1].row) is not None
                and row.cell is not None
            ):
                row.cell.text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style"):
            self.ignored = max(0, self.ignored - 1)
        if self.card is not None and self.card.table_stack:
            self._end_prize_tag(self.card, tag)
            return
        if self.capture is not None and tag == self.capture[0]:
            if self.card is None:
                raise ValueError("publisher ball outside card")
            self.card.numbers.append(("".join(self.capture[1]).strip(), self.capture[2]))
            self.capture = None
        if tag == "li":
            self.special = False
        if tag == "ul":
            self.number_list = False
        if tag == "div":
            if self.depth == self.number_root:
                self.number_root = None
            if self.depth == self.root:
                if self.card is not None:
                    self.cards.append(self.card)
                self.card = None
                self.root = None
            self.depth -= 1

    def _end_prize_tag(self, card: _Card, tag: str) -> None:
        table = card.table_stack[-1]
        if tag == "div":
            if (row := table.row) is not None and (cell := row.cell) is not None:
                if cell.zone_depth == self.depth:
                    cell.ball_zone = None
                    cell.zone_depth = None
                if cell.line_depth == self.depth:
                    if cell.line_main or cell.line_special:
                        cell.matches.append(PrizeMatch(cell.line_main, cell.line_special))
                    cell.line_depth = None
                    cell.line_main = 0
                    cell.line_special = False
            self.depth -= 1
            return
        if tag in {"td", "th"} and table.row is not None and table.row.cell is not None:
            cell = table.row.cell
            if cell.line_depth is not None:
                cell.invalid_match = True
            if not cell.is_header and len(table.row.cells) == 1:
                if (
                    cell.saw_italic
                    and not cell.saw_line_circle
                    and (cell.line_main or cell.line_special)
                ):
                    cell.matches.append(PrizeMatch(cell.line_main, cell.line_special))
                table.row.matches = tuple(cell.matches)
                if cell.invalid_match:
                    table.row.invalid_match = True
            table.row.cells.append(" ".join("".join(cell.text).split()))
            table.row.cell_is_header.append(cell.is_header)
            table.row.cell = None
            return
        if tag == "tr" and table.row is not None:
            row = table.row
            if row.cells:
                if not table.in_body or all(row.cell_is_header):
                    table.headers.append(tuple(cell.casefold() for cell in row.cells))
                else:
                    if row.invalid_match:
                        table.invalid_match = True
                    table.rows.append((tuple(row.cells), row.matches))
            table.row = None
            return
        if tag == "tbody":
            table.in_body = False
            return
        if tag == "table":
            finished = card.table_stack.pop()
            if any(_is_prize_header(header) for header in finished.headers):
                if card.prizes is not None:
                    raise ValueError("duplicate fallback prize table")
                if finished.invalid_match or finished.in_body or finished.row is not None:
                    raise ValueError("malformed fallback prize table")
                card.prizes = _parse_prize_rows(self.game, finished.rows)
            elif any(_looks_like_prize_header(header) for header in finished.headers):
                raise ValueError("fallback prize table structure changed")
            return


def _page(
    body: str, game: str, retrieved: datetime, source_url: str
) -> tuple[dict[int, Draw], list[tuple[date, str]]]:
    if len(body.encode("utf-8")) > 2_000_000:
        raise ValueError("publisher page exceeds bounds")
    definition = get_game(game)
    parser = _Page(game)
    parser.feed(body)
    if parser.card is not None or not parser.cards:
        raise ValueError("missing or incomplete publisher result cards")
    today = retrieved.astimezone(ZoneInfo("Asia/Ho_Chi_Minh")).date()
    draws: dict[int, Draw] = {}
    for card in parser.cards:
        text = " ".join(card.text)
        label = re.sub(r"\s", "", text).casefold()
        if re.sub(r"\s", "", definition.label).casefold() not in label:
            raise ValueError("publisher card game mismatch")
        identities = re.findall(r"#([0-9]+)\b", text)
        dates = re.findall(r"\b([0-9]{2})/([0-9]{2})/([0-9]{4})\b", text)
        if len(identities) != 1 or len(set(dates)) != 1 or not 1 <= len(identities[0]) <= 5:
            raise ValueError("publisher identity/date missing or ambiguous")
        identity = identities[0].zfill(5)
        day, month, year = dates[0]
        draw_date = date(int(year), int(month), int(day))
        if draw_date > today:
            raise ValueError("publisher result date is in the future")
        if card.table_stack:
            raise ValueError("unclosed fallback prize table")
        if any(re.fullmatch(r"[0-9]{1,2}", value) is None for value, _ in card.numbers):
            raise ValueError("publisher result contains unfinished or invalid balls")
        main = tuple(int(value) for value, special in card.numbers if not special)
        special = [int(value) for value, special in card.numbers if special]
        if len(special) != int(definition.special_max is not None):
            raise ValueError("publisher special number count mismatch")
        draw = Draw(
            game=game,
            draw_id=identity,
            draw_date=draw_date,
            draw_time=None,
            main_numbers=main,
            special_number=special[0] if special else None,
            source_url=f"{source_url}#draw={identity}",
            source_retrieved_at=retrieved,
            prizes=card.prizes,
            prizes_retrieved_at=retrieved if card.prizes is not None else None,
        )
        if draw.draw_seq in draws:
            raise ValueError("duplicate publisher identity")
        draws[draw.draw_seq] = draw
    links: list[tuple[date, str]] = []
    base = urlsplit(feed_url(game))
    product = "mega-6x45" if game == "mega_645" else "power-6x55"
    pattern = (
        r"/xs-lotto-535-ket-qua-lotto-535-ngay-([0-9]{2})-([0-9]{2})-([0-9]{4})\.html"
        if game == "lotto_535"
        else rf"/ket-qua-xo-so/dien-toan-vietlott/{product}/"
        r"([0-9]{2})-([0-9]{2})-([0-9]{4})\.html"
    )
    for href in parser.links:
        url = urljoin(source_url, href)
        parts = urlsplit(url)
        match = re.fullmatch(pattern, parts.path)
        if (
            match is None
            or parts.scheme != "https"
            or parts.netloc != base.netloc
            or parts.query
            or parts.fragment
        ):
            continue
        day, month, year = match.groups()
        links.append((date(int(year), int(month), int(day)), url))
    return draws, links


def parse_feed(body: str, game: str, lower: int, retrieved: datetime) -> dict[int, Draw]:
    draws, _ = _page(body, game, retrieved, feed_url(game))
    return {sequence: draw for sequence, draw in draws.items() if sequence >= lower}


def load_draws(fetcher: PageFetcher, game: str, lower: int) -> dict[int, Draw]:
    """Follow observed dated links until the oldest reference is covered, at most 12 pages."""
    url = feed_url(game)
    visited: set[str] = set()
    draws: dict[int, Draw] = {}
    for _ in range(MAX_PAGES):
        visited.add(url)
        body, retrieved = fetcher.fetch(url)
        page, links = _page(body, game, retrieved, url)
        for sequence, draw in page.items():
            previous = draws.get(sequence)
            if previous is not None and (
                previous.draw_date,
                previous.main_numbers,
                previous.special_number,
            ) != (draw.draw_date, draw.main_numbers, draw.special_number):
                raise ValueError("conflicting publisher result across pages")
            if (
                previous is not None
                and previous.prizes is not None
                and draw.prizes is not None
                and previous.prizes != draw.prizes
            ):
                raise ValueError("conflicting publisher prizes across pages")
            draws.setdefault(sequence, draw)
        if lower in draws:
            return {sequence: draw for sequence, draw in draws.items() if sequence >= lower}
        oldest = min(draw.draw_date for draw in page.values())
        candidates = [(day, link) for day, link in links if day <= oldest and link not in visited]
        if not candidates:
            raise ValueError("publisher history does not cover reference draws")
        _, url = max(candidates)
    raise ValueError("publisher pagination exceeds 12 pages")
