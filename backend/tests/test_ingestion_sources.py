"""Captured official result blocks prove extraction without network dependence."""

from datetime import UTC, datetime
from pathlib import Path

import pytest

from app.ingestion.sources import SourceParseError, parse_result, result_url

FIXTURES = Path(__file__).parent / "fixtures" / "vietlott"
RETRIEVED_AT = datetime(2026, 10, 1, tzinfo=UTC)


@pytest.mark.parametrize(
    ("game", "draw_id", "draw_date", "main", "special"),
    [
        ("lotto_535", "00001", "2025-06-29", (7, 9, 10, 16, 19), 9),
        ("lotto_535", "00829", "2026-08-17", (7, 13, 19, 32, 33), 11),
        ("lotto_535", "00830", "2026-08-17", (3, 9, 13, 22, 30), 7),
        ("mega_645", "00001", "2016-07-20", (2, 17, 33, 37, 38, 45), None),
        ("mega_645", "01530", "2026-07-01", (20, 24, 25, 29, 40, 44), None),
    ],
)
def test_official_samples(game, draw_id, draw_date, main, special) -> None:
    code = "535" if game == "lotto_535" else "645"
    url = result_url(game, draw_id)
    assert "nocatche=1" in url
    draw = parse_result(
        (FIXTURES / f"{code}_{draw_id}.html").read_text(encoding="utf-8"),
        game=game,
        expected_id=draw_id,
        source_url=url,
        retrieved_at=RETRIEVED_AT,
    )
    assert (draw.draw_date.isoformat(), draw.main_numbers, draw.special_number) == (
        draw_date,
        main,
        special,
    )
    assert draw.source_url == url


def test_wrong_id_game_missing_fields_and_bad_numbers_are_errors() -> None:
    original = (FIXTURES / "535_00001.html").read_text(encoding="utf-8")
    arguments = dict(
        game="lotto_535",
        expected_id="00001",
        source_url=result_url("lotto_535", "00001"),
        retrieved_at=RETRIEVED_AT,
    )
    invalid = (
        original.replace("#00001", "#00002"),
        original.replace("lotto535", "mega645"),
        original.replace("Lotto 5/35", "Mega 6/45"),
        original.replace("Kỳ quay thưởng", "Kỳ khác"),
        original.replace('<span class="bong_tron small">07</span>', ""),
        original.replace("no-margin-right active", "no-margin-right"),
        "<html><body>HTTP 200 but no result</body></html>",
    )
    for page in invalid:
        with pytest.raises(SourceParseError):
            parse_result(page, **arguments)


def test_latest_page_parses_identity_from_content() -> None:
    html = (FIXTURES / "645_01530.html").read_text(encoding="utf-8")
    draw = parse_result(
        html,
        game="mega_645",
        expected_id=None,
        source_url=result_url("mega_645"),
        retrieved_at=RETRIEVED_AT,
    )
    assert draw.draw_id == "01530"
