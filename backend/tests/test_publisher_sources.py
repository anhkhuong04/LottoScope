"""Publisher HTML is untrusted: identity, live placeholders and paging must fail closed."""

from datetime import UTC, date, datetime
from pathlib import Path

import httpx
import pytest
from test_community_fallback import html, record

from app.ingestion.community import feed_url, parse_feed
from app.ingestion.fetcher import SourceFetchError, VietlottFetcher
from app.ingestion.publishers import load_draws

NOW = datetime(2026, 11, 3, tzinfo=UTC)


@pytest.mark.parametrize(
    "game,file,identity,main,special",
    [
        ("lotto_535", "lotto535", 985, (4, 11, 21, 22, 33), 4),
        ("mega_645", "mega645", 1583, (5, 9, 17, 18, 34, 36), None),
        ("power_655", "power655", 1419, (10, 22, 31, 39, 43, 54), 14),
    ],
)
def test_frozen_real_result_card(game, file, identity, main, special):
    content = (Path(__file__).parent / "fixtures" / "publishers" / f"{file}.html").read_text(
        encoding="utf-8"
    )
    draw = parse_feed(content, game, 1, NOW)[identity]
    assert draw.main_numbers == main
    assert draw.special_number == special


def test_same_day_lotto_draws_keep_separate_identities():
    first, second = record("lotto_535", 100), record("lotto_535", 101)
    second["date"] = first["date"]
    draws = parse_feed(html("lotto_535", [first, second]), "lotto_535", 100, NOW)
    assert list(draws) == [100, 101]
    assert draws[100].draw_date == draws[101].draw_date


@pytest.mark.parametrize(
    "game,numbers",
    [
        ("power_655", [1, 2, 3, 4, 5, 6, 1]),
        ("power_655", [1, 2, 3, 4, 5, 6]),
        ("power_655", [1, 2, 3, 4, 5, 6, 10, 11]),
        ("mega_645", [1, 2, 3, 4, 5, 6, 10]),
        ("lotto_535", [1, 2, 3, 4, 5, 10, 11]),
    ],
)
def test_invalid_special_structure_rejected(game, numbers):
    row = record(game, 100)
    row["result"] = numbers
    with pytest.raises(ValueError):
        parse_feed(html(game, [row]), game, 100, NOW)


def test_full_twenty_anchor_twenty_new_window_covered_with_page_overlaps():
    game = "lotto_535"
    pages = {}
    url = feed_url(game)
    for upper in range(139, 100, -4):
        rows = [record(game, seq) for seq in range(max(100, upper - 5), upper + 1)]
        dated = date.fromisoformat(rows[0]["date"]).strftime("%d-%m-%Y")
        older = f"https://www.minhchinh.com/xs-lotto-535-ket-qua-lotto-535-ngay-{dated}.html"
        pages[url] = html(game, rows) + f'<a href="{older}">older</a>'
        url = older
    fetcher = Pages(pages)
    draws = load_draws(fetcher, game, 100)
    assert sorted(draws) == list(range(100, 140))
    assert len(fetcher.calls) == 10


@pytest.mark.parametrize(
    "game,host",
    [
        ("lotto_535", "https://www.minhchinh.com/"),
        ("mega_645", "https://www.minhngoc.net.vn/"),
        ("power_655", "https://www.minhngoc.net.vn/"),
    ],
)
def test_only_new_publishers_are_configured(game, host):
    assert feed_url(game).startswith(host)


def test_lotto_explicit_unpadded_id_normalized_and_special_can_match_main():
    content = """<div class="boxketqua_vl box_tructiep_vietlott_10">
      <div class="title">Kết quả Lotto5/35</div><div class="content_vl">
      <div class="ngay">Kết quả QSMT kỳ <a>#985</a> ngày <a>03/11/2026</a> - Lúc 13:00</div>
      <div class="box_ketqua"><span class="ball ball_lotto">04</span>
      <span class="ball ball_lotto">11</span><span class="ball ball_lotto">21</span>
      <span class="ball ball_lotto">22</span><span class="ball ball_lotto">33</span>
      <span class="ball ball_lotto_2">04</span></div>
      <table><tr><td>99999</td></tr></table></div></div>"""
    draw = parse_feed(content, "lotto_535", 965, NOW)[985]
    assert draw.draw_id == "00985"
    assert draw.draw_date.isoformat() == "2026-11-03"
    assert draw.main_numbers == (4, 11, 21, 22, 33)
    assert draw.special_number == 4
    assert draw.draw_time is None and draw.prizes is None


@pytest.mark.parametrize(
    "content",
    [
        "<html>Cloudflare challenge</html>",
        html("mega_645", [record("mega_645", 100)]).replace(">1<", ">...<"),
        html("mega_645", [record("mega_645", 100)]).replace("Mega 6/45", "Power 6/55"),
        "x" * 2_000_001,
    ],
    ids=["challenge", "placeholder", "wrong-game", "oversize"],
)
def test_unrecognized_wrong_game_incomplete_or_oversize_pages_rejected(content):
    with pytest.raises(ValueError):
        parse_feed(content, "mega_645", 100, NOW)


class Pages:
    def __init__(self, pages):
        self.pages = pages
        self.calls = []

    def fetch(self, url):
        self.calls.append(url)
        result = self.pages[url]
        if isinstance(result, SourceFetchError):
            raise result
        return result, NOW


def test_pagination_preserves_per_page_provenance_and_deduplicates_boundary():
    game = "lotto_535"
    older = "https://www.minhchinh.com/xs-lotto-535-ket-qua-lotto-535-ngay-02-01-2026.html"
    first = html(game, [record(game, 101), record(game, 102)])
    first += f'<a href="{older}">older</a>'
    second = html(game, [record(game, 100), record(game, 101)])
    fetcher = Pages({feed_url(game): first, older: second})
    draws = load_draws(fetcher, game, 100)
    assert sorted(draws) == [100, 101, 102]
    assert fetcher.calls == [feed_url(game), older]
    assert draws[100].source_url == older + "#draw=00100"
    assert draws[101].source_url == feed_url(game) + "#draw=00101"


@pytest.mark.parametrize("defect", ["external", "wrong-game", "missing", "conflict", "fetch-error"])
def test_pagination_failure_does_not_return_partial_results(defect):
    game = "mega_645"
    older = "https://www.minhngoc.net.vn/ket-qua-xo-so/dien-toan-vietlott/mega-6x45/02-01-2026.html"
    link = older
    if defect == "external":
        link = older.replace("www.minhngoc.net.vn", "evil.example")
    elif defect == "wrong-game":
        link = older.replace("mega-6x45", "power-6x55")
    elif defect == "missing":
        link = ""
    first = html(game, [record(game, 101), record(game, 102)]) + f'<a href="{link}">older</a>'
    row = record(game, 101)
    if defect == "conflict":
        row["result"] = [2, 3, 4, 5, 6, 7]
    second = html(game, [record(game, 100), row])
    if defect == "fetch-error":
        second = SourceFetchError(older, "HTTP 503")
    fetcher = Pages({feed_url(game): first, older: second})
    with pytest.raises((ValueError, SourceFetchError)):
        load_draws(fetcher, game, 100)
    assert all("evil.example" not in url and "power-6x55" not in url for url in fetcher.calls)


def test_conflicting_header_dates_are_rejected():
    content = html("power_655", [record("power_655", 100)])
    content = content.replace("Kỳ vé:", "Ngày quay thưởng 02/01/2026 Kỳ vé:")
    with pytest.raises(ValueError, match="date"):
        parse_feed(content, "power_655", 100, NOW)


def test_pagination_stops_at_twelve_pages():
    game = "lotto_535"
    pages = {}
    url = feed_url(game)
    for seq in range(115, 100, -1):
        row = record(game, seq)
        dated = date.fromisoformat(row["date"]).strftime("%d-%m-%Y")
        older = f"https://www.minhchinh.com/xs-lotto-535-ket-qua-lotto-535-ngay-{dated}.html"
        pages[url] = html(game, [row]) + f'<a href="{older}">older</a>'
        url = older
    fetcher = Pages(pages)
    with pytest.raises(ValueError, match="12 pages"):
        load_draws(fetcher, game, 100)
    assert len(fetcher.calls) == 12


@pytest.mark.parametrize("game", ["lotto_535", "mega_645", "power_655"])
def test_publisher_redirect_is_rejected_before_following_location(game):
    calls = []

    def handler(request):
        calls.append(str(request.url))
        if request.url.host in ("www.minhchinh.com", "www.minhngoc.net.vn"):
            return httpx.Response(302, headers={"Location": "http://127.0.0.1/private"})
        return httpx.Response(200, text=html(game, [record(game, 100)]))

    with httpx.Client(transport=httpx.MockTransport(handler), follow_redirects=True) as client:
        with pytest.raises(SourceFetchError, match="302"):
            load_draws(VietlottFetcher(client), game, 100)
    assert calls == [feed_url(game)]
