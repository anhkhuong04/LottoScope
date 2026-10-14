"""Official Power fixtures guard shared Mega CSS, special and Jackpot 2 semantics."""

from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_ingestion_service import FixtureFetcher
from test_ingestion_service import engine as engine

from app.ingestion.service import IngestionService
from app.ingestion.sources import SourceParseError, parse_result, result_url
from app.models.draw import DrawCorrectionRow
from app.repositories.draws import DrawRepository
from app.services.prizes import DrawPrizeService

FIXTURES = Path(__file__).parent / "fixtures" / "vietlott"
RETRIEVED_AT = datetime(2026, 10, 14, tzinfo=UTC)


def power_html(draw_id: str = "00001") -> str:
    return (FIXTURES / f"655_{draw_id}_prizes.html").read_text(encoding="utf-8")


def parse_power(html: str, draw_id: str = "00001"):
    return parse_result(
        html,
        game="power_655",
        expected_id=draw_id,
        source_url=result_url("power_655", draw_id),
        retrieved_at=RETRIEVED_AT,
    )


@pytest.mark.parametrize(
    ("draw_id", "day", "main", "special", "values"),
    [
        (
            "00001",
            "2017-08-01",
            (5, 10, 14, 23, 24, 38),
            35,
            [(0, 30528493950), (0, 3058721550), (3, 40000000), (170, 500000), (4024, 50000)],
        ),
        (
            "01385",
            "2026-08-15",
            (16, 20, 25, 27, 30, 50),
            2,
            [(0, 32326470750), (0, 3258496750), (5, 40000000), (551, 500000), (12298, 50000)],
        ),
    ],
)
def test_power_official_fixtures(draw_id, day, main, special, values) -> None:
    draw = parse_power(power_html(draw_id), draw_id)
    assert (draw.draw_date.isoformat(), draw.main_numbers, draw.special_number) == (
        day,
        main,
        special,
    )
    assert draw.draw_time is None
    assert [(tier.winner_count, tier.amount_vnd) for tier in draw.prizes] == values
    assert [[(m.main_count, m.special) for m in tier.matches] for tier in draw.prizes] == [
        [(6, False)],
        [(5, True)],
        [(5, False)],
        [(4, False)],
        [(3, False)],
    ]


@pytest.mark.parametrize(
    "change",
    [
        ("POWER 6/55", "MEGA 6/45"),
        ("#00001", "#00002"),
        ('no-margin-right active">35', 'no-margin-right">35'),
        ('no-margin-right active">35', 'no-margin-right active">05'),
        ('no-margin-right active">35', 'no-margin-right active">56'),
        ('small">05', 'small active">05'),
        ('O O O O O | <span class="active">O</span>', "O O O O O | O"),
        ('O O O O O | <span class="active">O</span>', 'O O O O | <span class="active">O</span>'),
        ('O O O O O | <span class="active">O</span>', 'O O O O O + <span class="active">O</span>'),
        ("<td>Jackpot 2</td>", "<td>Jackpot 1</td>"),
    ],
)
def test_power_rejects_changed_result_or_prize_semantics(change) -> None:
    html = power_html()
    assert change[0] in html
    with pytest.raises(SourceParseError):
        parse_power(html.replace(*change))


def test_source_path_and_title_disambiguate_shared_mega_css() -> None:
    with pytest.raises(SourceParseError):
        parse_result(
            power_html(),
            game="mega_645",
            expected_id="00001",
            source_url=result_url("mega_645", "00001"),
            retrieved_at=RETRIEVED_AT,
        )
    with pytest.raises(SourceParseError):
        parse_result(
            power_html(),
            game="power_655",
            expected_id="00001",
            source_url=result_url("mega_645", "00001"),
            retrieved_at=RETRIEVED_AT,
        )


@pytest.mark.integration
def test_power_import_resume_collect_and_prize_correction(engine) -> None:
    fetcher = FixtureFetcher(latest="00001", pages={"00001": power_html()})
    service = IngestionService(engine, fetcher)
    assert service.import_history("power_655").counters["created"] == 1
    assert service.import_history("power_655").counters["resumed"] == 1
    for _ in range(2):
        summary = service.collect("power_655")
        assert summary.status == "success" and summary.counters["unchanged"] == 1
    with Session(engine) as session:
        repo = DrawRepository(session)
        original = repo.get_by_id("power_655", "00001")
        assert repo.list_draws("power_655").total == repo.data_version("power_655") == 1
    fetcher.pages["00001"] = power_html().replace("30.528.493.950", "30.528.493.951")
    conflict = service.collect("power_655")
    assert conflict.status == "partial" and conflict.counters["conflict"] == 1
    with Session(engine) as session, session.begin():
        repo = DrawRepository(session)
        assert repo.get_by_id("power_655", "00001") == original
        correction = session.scalar(select(DrawCorrectionRow))
        assert correction.new_payload["prizes"][0]["amount_vnd"] == 30528493951
        applied = repo.apply_correction(correction.id, reason="Verified fixture")
        assert applied.prizes[0].amount_vnd == 30528493951
        assert repo.data_version("power_655") == 2


@pytest.mark.integration
def test_power_prizes_enrich_once_then_read_without_source(engine) -> None:
    original = parse_power(power_html())
    with Session(engine) as session, session.begin():
        DrawRepository(session).add(replace(original, prizes=None, prizes_retrieved_at=None))
    fetcher = FixtureFetcher(latest="00001", pages={"00001": power_html()})
    service = DrawPrizeService(engine, fetcher)
    assert service.get("power_655", "00001").items == original.prizes
    assert len(fetcher.calls) == 2
    fetcher.pages.clear()
    assert service.get("power_655", "00001").items == original.prizes
    assert len(fetcher.calls) == 2
    with Session(engine) as session:
        assert DrawRepository(session).data_version("power_655") == 2
