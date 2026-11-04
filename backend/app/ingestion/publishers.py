"""Bounded result-only HTML adapters for the approved fallback publishers."""

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit
from zoneinfo import ZoneInfo

from app.domain.draw import Draw
from app.games.definitions import get_game
from app.ingestion.service import PageFetcher

MAX_PAGES = 12
_URLS = {
    "lotto_535": "https://www.minhchinh.com/xo-so-dien-toan-lotto-535.html",
    "mega_645": "https://www.minhngoc.net.vn/ket-qua-xo-so/dien-toan-vietlott/mega-6x45.html",
    "power_655": "https://www.minhngoc.net.vn/ket-qua-xo-so/dien-toan-vietlott/power-6x55.html",
}


def feed_url(game: str) -> str:
    get_game(game)
    return _URLS[game]


@dataclass
class _Card:
    text: list[str] = field(default_factory=lambda: list[str]())
    numbers: list[tuple[str, bool]] = field(default_factory=lambda: list[tuple[str, bool]]())


class _Page(HTMLParser):
    """Scope balls to result cards; never read prize tables or statistics as results."""

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
            marker = "boxketqua_vl" if self.game == "lotto_535" else "boxkqxsdientoan"
            if marker in classes:
                if self.card is not None or len(self.cards) >= 200:
                    raise ValueError("nested or excessive publisher result cards")
                self.root = self.depth
                self.card = _Card()
            if self.card is not None and "box_ketqua" in classes:
                self.number_root = self.depth
        if self.card is None:
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

    def handle_data(self, data: str) -> None:
        if self.card is not None and not self.ignored:
            self.card.text.append(data)
            if self.capture is not None:
                self.capture[1].append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style"):
            self.ignored = max(0, self.ignored - 1)
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
            draws.setdefault(sequence, draw)
        if lower in draws:
            return {sequence: draw for sequence, draw in draws.items() if sequence >= lower}
        oldest = min(draw.draw_date for draw in page.values())
        candidates = [(day, link) for day, link in links if day <= oldest and link not in visited]
        if not candidates:
            raise ValueError("publisher history does not cover reference draws")
        _, url = max(candidates)
    raise ValueError("publisher pagination exceeds 12 pages")
