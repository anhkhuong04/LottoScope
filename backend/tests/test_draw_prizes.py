"""Official prize fixtures and persisted enrichment/correction contracts."""

from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from test_ingestion_service import FixtureFetcher
from test_ingestion_service import engine as engine

from app.domain.prizes import PrizeMatch, PrizeTier
from app.games.definitions import DomainValidationError
from app.ingestion.service import JobOverlapError
from app.ingestion.sources import SourceParseError, parse_result, result_url
from app.models.draw import DrawCorrectionRow
from app.repositories.draws import DrawRepository
from app.services.prizes import (
    DrawPrizeService,
    PrizeReviewPendingError,
    PrizeSourceUnavailableError,
)

FIXTURES = Path(__file__).parent / "fixtures" / "vietlott"
RETRIEVED_AT = datetime(2026, 10, 7, tzinfo=UTC)


def prize_draw(game: str):
    code, draw_id = ("535", "00922") if game == "lotto_535" else ("645", "01570")
    return parse_result(
        (FIXTURES / f"{code}_{draw_id}_prizes.html").read_text(encoding="utf-8"),
        game=game,
        expected_id=draw_id,
        source_url=result_url(game, draw_id),
        retrieved_at=RETRIEVED_AT,
    )


@pytest.mark.parametrize(
    ("game", "expected"),
    [
        (
            "lotto_535",
            [
                (0, 7749247500),
                (0, 10000000),
                (6, 5000000),
                (42, 500000),
                (155, 100000),
                (1663, 30000),
                (12312, 10000),
            ],
        ),
        ("mega_645", [(0, 178900548500), (95, 10000000), (5723, 300000), (95610, 30000)]),
    ],
)
def test_prize_rows_are_actual_per_draw_values(game, expected) -> None:
    draw = prize_draw(game)
    assert draw.prizes is not None
    assert [(prize.winner_count, prize.amount_vnd) for prize in draw.prizes] == expected
    assert draw.prizes_retrieved_at == RETRIEVED_AT


def test_lotto_special_match_is_separate_and_consolation_has_three_patterns() -> None:
    prizes = prize_draw("lotto_535").prizes
    assert [(m.main_count, m.special) for m in prizes[0].matches] == [(5, True)]
    assert [(m.main_count, m.special) for m in prizes[-1].matches] == [
        (2, True),
        (1, True),
        (0, True),
    ]


@pytest.mark.parametrize("bad_value", ["-155", "1.55", "không rõ", "155.0"])
def test_malformed_prize_count_does_not_silently_parse_as_success(bad_value) -> None:
    html = (FIXTURES / "535_00922_prizes.html").read_text(encoding="utf-8")
    html = html.replace('class="text-right">155</td>', f'class="text-right">{bad_value}</td>')
    with pytest.raises(SourceParseError):
        parse_result(
            html,
            game="lotto_535",
            expected_id="00922",
            source_url=result_url("lotto_535", "00922"),
            retrieved_at=RETRIEVED_AT,
        )


@pytest.mark.integration
@pytest.mark.parametrize("game", ["lotto_535", "mega_645"])
def test_legacy_draw_is_enriched_once_without_changing_result_hash(engine, game) -> None:
    draw = prize_draw(game)
    legacy = replace(draw, prizes=None, prizes_retrieved_at=None)
    with Session(engine) as session, session.begin():
        repo = DrawRepository(session)
        repo.add(legacy)
        assert repo.data_version(game) == 1
        assert repo.add(draw).status == "enriched"
        stored = repo.get_by_id(game, draw.draw_id)
        assert stored.prizes == draw.prizes
        assert stored.source_sha256 == legacy.source_sha256
        assert repo.data_version(game) == 2
        assert repo.add(draw).status == "unchanged"
        assert repo.add(legacy).status == "unchanged"
        assert repo.get_by_id(game, draw.draw_id).prizes == draw.prizes
        assert repo.data_version(game) == 2


@pytest.mark.integration
def test_prize_change_requires_review_and_is_applied_with_audit(engine) -> None:
    original = prize_draw("lotto_535")
    changed = replace(
        original, prizes=(replace(original.prizes[0], winner_count=1), *original.prizes[1:])
    )
    with Session(engine) as session, session.begin():
        repo = DrawRepository(session)
        repo.add(original)
        conflict = repo.add(changed)
        assert conflict.status == "conflict"
        assert repo.get_by_id(original.game, original.draw_id).prizes == original.prizes
        assert repo.add(changed).correction_id == conflict.correction_id
        audit = session.scalar(select(DrawCorrectionRow))
        assert audit.old_payload["prizes"][0]["winner_count"] == 0
        assert audit.new_payload["prizes"][0]["winner_count"] == 1
        applied = repo.apply_correction(conflict.correction_id, reason="Verified official source")
        assert applied.prizes == changed.prizes
        assert applied.source_sha256 == original.source_sha256
        assert repo.get_by_id(original.game, original.draw_id).prizes == changed.prizes
        assert repo.data_version(original.game) == 2


@pytest.mark.integration
@pytest.mark.parametrize("enrich_after_proposal", [False, True])
def test_core_correction_without_prizes_preserves_known_snapshot(engine, enrich_after_proposal):
    original = prize_draw("lotto_535")
    legacy = replace(original, prizes=None, prizes_retrieved_at=None)
    changed = replace(
        legacy,
        main_numbers=(6, 7, 10, 11, 34),
        source_retrieved_at=datetime(2026, 10, 8, tzinfo=UTC),
    )
    with Session(engine) as session, session.begin():
        repo = DrawRepository(session)
        repo.add(legacy if enrich_after_proposal else original)
        proposal = repo.add(changed)
        assert proposal.status == "conflict"
        if enrich_after_proposal:
            assert repo.add(original).status == "enriched"
        applied = repo.apply_correction(proposal.correction_id, reason="Verified core correction")
        assert applied.main_numbers == changed.main_numbers
        assert applied.prizes == original.prizes
        assert applied.prizes_retrieved_at == original.prizes_retrieved_at
        stored = repo.get_by_id(original.game, original.draw_id)
        assert stored == applied
        assert repo.data_version(original.game) == (3 if enrich_after_proposal else 2)


def test_missing_special_markup_is_rejected_instead_of_counted_as_main() -> None:
    html = (FIXTURES / "535_00922_prizes.html").read_text(encoding="utf-8")
    original = "<b>O O O + <span style='color:#faa61a'>O</span></b>"
    assert original in html
    with pytest.raises(SourceParseError):
        parse_result(
            html.replace(original, "<b>O O O + O</b>"),
            game="lotto_535",
            expected_id="00922",
            source_url=result_url("lotto_535", "00922"),
            retrieved_at=RETRIEVED_AT,
        )


def test_duplicate_prize_table_is_rejected() -> None:
    html = (FIXTURES / "535_00922_prizes.html").read_text(encoding="utf-8")
    table_start = html.index('<div class="chitietketqua_table maga535_table">')
    table_end = html.index("</table>", table_start) + len("</table>")
    with pytest.raises(SourceParseError):
        parse_result(
            html + html[table_start:table_end] + "</div>",
            game="lotto_535",
            expected_id="00922",
            source_url=result_url("lotto_535", "00922"),
            retrieved_at=RETRIEVED_AT,
        )


def test_legacy_html_without_prize_table_is_unknown_and_hash_stays_compatible() -> None:
    html = (FIXTURES / "535_00830.html").read_text(encoding="utf-8")
    draw = parse_result(
        html,
        game="lotto_535",
        expected_id="00830",
        source_url=result_url("lotto_535", "00830"),
        retrieved_at=RETRIEVED_AT,
    )
    assert draw.prizes is None and draw.prizes_retrieved_at is None
    assert draw.source_sha256 == draw.revision_sha256
    full = prize_draw("lotto_535")
    assert full.source_sha256 == replace(full, prizes=None, prizes_retrieved_at=None).source_sha256
    assert full.revision_sha256 != full.source_sha256


@pytest.mark.parametrize(
    "change",
    [
        ("Giải Nhất", "Giải Không Rõ"),
        ("maga535_table", "maga645_table"),
        ("7.749.247.500</td>", "-1</td>"),
        ("Số lượng giải", "Số khác"),
        ("</tbody>", ""),
    ],
)
def test_changed_prize_table_schema_is_rejected(change) -> None:
    html = (FIXTURES / "535_00922_prizes.html").read_text(encoding="utf-8")
    with pytest.raises(SourceParseError):
        parse_result(
            html.replace(*change),
            game="lotto_535",
            expected_id="00922",
            source_url=result_url("lotto_535", "00922"),
            retrieved_at=RETRIEVED_AT,
        )


@pytest.mark.parametrize("value", [-1, True, 1.5, "10"])
def test_prize_money_rejects_non_integer_or_negative_values(value) -> None:
    with pytest.raises(DomainValidationError):
        PrizeTier("Jackpot", (PrizeMatch(6, False),), 0, value)


@pytest.mark.integration
@pytest.mark.parametrize("game", ["lotto_535", "mega_645"])
def test_on_demand_enrichment_reads_source_once_then_works_offline(engine, game) -> None:
    original = prize_draw(game)
    with Session(engine) as session, session.begin():
        DrawRepository(session).add(replace(original, prizes=None, prizes_retrieved_at=None))
    code = "535" if game == "lotto_535" else "645"
    page = (FIXTURES / f"{code}_{original.draw_id}_prizes.html").read_text(encoding="utf-8")
    fetcher = FixtureFetcher(latest=original.draw_id, pages={original.draw_id: page})
    service = DrawPrizeService(engine, fetcher)
    details = service.get(game, original.draw_id)
    assert details.items == original.prizes
    assert fetcher.calls == [original.draw_id, original.draw_id]
    fetcher.pages.clear()
    assert service.get(game, original.draw_id).items == original.prizes
    assert len(fetcher.calls) == 2
    with Session(engine) as session:
        assert DrawRepository(session).data_version(game) == 2


@pytest.mark.integration
def test_source_failure_preserves_draw_and_can_retry(engine) -> None:
    draw = prize_draw("lotto_535")
    with Session(engine) as session, session.begin():
        DrawRepository(session).add(replace(draw, prizes=None, prizes_retrieved_at=None))
    fetcher = FixtureFetcher(latest=draw.draw_id, pages={})
    with pytest.raises(PrizeSourceUnavailableError):
        DrawPrizeService(engine, fetcher).get(draw.game, draw.draw_id)
    with Session(engine) as session:
        stored = DrawRepository(session).get_by_id(draw.game, draw.draw_id)
        assert stored.prizes is None and stored.main_numbers == draw.main_numbers
    fetcher.pages[draw.draw_id] = (FIXTURES / "535_00922_prizes.html").read_text(encoding="utf-8")
    assert DrawPrizeService(engine, fetcher).get(draw.game, draw.draw_id).items == draw.prizes


@pytest.mark.integration
def test_enrichment_overlap_and_changed_numbers_are_not_silently_accepted(engine) -> None:
    draw = prize_draw("lotto_535")
    with Session(engine) as session, session.begin():
        DrawRepository(session).add(replace(draw, prizes=None, prizes_retrieved_at=None))
    page = (FIXTURES / "535_00922_prizes.html").read_text(encoding="utf-8")
    fetcher = FixtureFetcher(latest=draw.draw_id, pages={draw.draw_id: page})
    with engine.connect() as lock:
        lock.execute(text("SELECT pg_advisory_lock(5043, hashtext('lotto_535'))"))
        try:
            with pytest.raises(JobOverlapError):
                DrawPrizeService(engine, fetcher).get(draw.game, draw.draw_id)
            assert fetcher.calls == []
        finally:
            lock.execute(text("SELECT pg_advisory_unlock(5043, hashtext('lotto_535'))"))
    fetcher.pages[draw.draw_id] = page.replace('small">05</span>', 'small">06</span>')
    with pytest.raises(PrizeReviewPendingError):
        DrawPrizeService(engine, fetcher).get(draw.game, draw.draw_id)
    with Session(engine) as session:
        assert DrawRepository(session).get_by_id(draw.game, draw.draw_id).prizes is None
