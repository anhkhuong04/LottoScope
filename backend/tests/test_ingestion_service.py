"""Import/collector behavior against migrated PostgreSQL with fixed source pages."""

import os
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime
from pathlib import Path
from threading import Event
from urllib.parse import parse_qs, urlsplit

import pytest
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.ingestion.audit import audit_history
from app.ingestion.fetcher import SourceDeferredError, SourceFetchError
from app.ingestion.service import IngestionService, JobOverlapError
from app.models.draw import DrawCorrectionRow, DrawRow, GameDataStateRow
from app.models.ingestion import IngestionCheckpointRow, IngestionItemRow, IngestionRunRow

FIXTURES = Path(__file__).parent / "fixtures" / "vietlott"
RETRIEVED_AT = datetime(2026, 10, 1, tzinfo=UTC)


class FixtureFetcher:
    def __init__(self, *, latest: str, pages: dict[str, str | SourceFetchError]) -> None:
        self.latest = latest
        self.pages = pages
        self.calls: list[str] = []

    def fetch(self, url: str) -> tuple[str, datetime]:
        draw_id = parse_qs(urlsplit(url).query).get("id", [self.latest])[0]
        self.calls.append(draw_id)
        page = self.pages.get(draw_id)
        if page is None:
            raise SourceFetchError(url, "HTTP 404", missing=True)
        if isinstance(page, SourceFetchError):
            raise page
        return page, RETRIEVED_AT


def fixture(game: str, draw_id: str) -> str:
    return (FIXTURES / f"{game}_{draw_id}.html").read_text(encoding="utf-8")


@pytest.fixture
def engine():
    url = os.getenv("LOTTO_TEST_DATABASE_URL", "")
    if not url or not urlsplit(url).path.endswith("_test"):
        pytest.fail("LOTTO_TEST_DATABASE_URL must point to a dedicated *_test database")
    db_engine = create_engine(url)
    with db_engine.begin() as connection:
        assert (
            connection.scalar(text("SELECT version_num FROM alembic_version")) == "0005_power_655"
        )
        connection.execute(
            text(
                "TRUNCATE ingestion_items, ingestion_runs, ingestion_checkpoints, "
                "draw_corrections, draws, game_data_state RESTART IDENTITY"
            )
        )
    yield db_engine
    db_engine.dispose()


@pytest.mark.integration
def test_import_resume_recheck_and_content_conflict(engine) -> None:
    first = fixture("535", "00829")
    second = fixture("535", "00830")
    fetcher = FixtureFetcher(latest="00830", pages={"00829": first, "00830": second})
    service = IngestionService(engine, fetcher)
    initial = service.import_history("lotto_535", start_id="00829", end_id="00830")
    assert initial.status == "success"
    assert initial.counters["created"] == 2
    assert initial.counters["inserted"] == 2
    with Session(engine) as session:
        assert session.get(IngestionRunRow, initial.run_id).scope["source_latest_id"] == "00830"
    resumed = service.import_history("lotto_535", start_id="00829", end_id="00830")
    assert resumed.counters["resumed"] == 2
    assert resumed.counters["skipped"] == 2
    assert (
        service.import_history(
            "lotto_535", start_id="00829", end_id="00830", recheck=True
        ).counters["unchanged"]
        == 2
    )
    changed = second.replace(
        '<span class="bong_tron small">03</span>', '<span class="bong_tron small">04</span>'
    )
    fetcher.pages["00830"] = changed
    conflict = service.import_history("lotto_535", start_id="00830", end_id="00830", recheck=True)
    assert conflict.status == "partial"
    assert conflict.counters["conflict"] == 1
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(DrawRow)) == 2
        assert session.scalar(select(DrawRow.main_numbers).where(DrawRow.draw_id == "00830")) == [
            3,
            9,
            13,
            22,
            30,
        ]
        assert session.scalar(select(func.count()).select_from(DrawCorrectionRow)) == 1
        assert session.get(GameDataStateRow, "lotto_535").version == 2
        assert session.get(IngestionCheckpointRow, "lotto_535").last_scanned_seq == 830
        assert session.get(IngestionItemRow, ("lotto_535", 830)).error_summary.startswith(
            "content_conflict"
        )


@pytest.mark.integration
def test_invalid_missing_failure_are_partial_and_resumable(engine) -> None:
    valid = fixture("535", "00830")
    fetcher = FixtureFetcher(
        latest="00830",
        pages={
            "00827": "<html>changed format</html>",
            "00828": SourceFetchError("source", "HTTP 503"),
            "00830": valid,
        },
    )
    service = IngestionService(engine, fetcher)
    summary = service.import_history("lotto_535", start_id="00827", end_id="00830")
    assert summary.status == "partial"
    assert (
        summary.counters["invalid"],
        summary.counters["failed"],
        summary.counters["missing"],
        summary.counters["created"],
    ) == (1, 1, 1, 1)
    with Session(engine) as session:
        assert [
            session.get(IngestionItemRow, ("lotto_535", seq)).status for seq in range(827, 831)
        ] == ["invalid", "failed", "missing", "found"]
        assert session.get(IngestionRunRow, summary.run_id).status == "partial"
        assert session.get(IngestionRunRow, summary.run_id).finished_at is not None
        assert session.get(IngestionCheckpointRow, "lotto_535").last_scanned_seq == 830
    corrected = fixture("535", "00829")
    fetcher.pages["00829"] = corrected
    rerun = service.import_history("lotto_535", start_id="00829", end_id="00830")
    assert rerun.counters["created"] == 1
    assert rerun.counters["resumed"] == 1


@pytest.mark.integration
def test_date_scope_excludes_without_claiming_persistence(engine) -> None:
    fetcher = FixtureFetcher(
        latest="00830", pages={"00829": fixture("535", "00829"), "00830": fixture("535", "00830")}
    )
    summary = IngestionService(engine, fetcher).import_history(
        "lotto_535", start_id="00829", end_id="00830", from_date=date(2026, 8, 18)
    )
    assert summary.counters["excluded"] == 2
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(DrawRow)) == 0
        assert session.get(IngestionItemRow, ("lotto_535", 830)).status == "excluded"


@pytest.mark.integration
def test_collector_requires_history_then_rechecks_last_draw(engine) -> None:
    page = fixture("645", "00001")
    service = IngestionService(engine, FixtureFetcher(latest="00001", pages={"00001": page}))
    absent = service.collect("mega_645")
    assert absent.status == "failed"
    assert service.status("mega_645").last_failed_ingestion_at is not None
    with Session(engine) as session:
        assert "no local history" in session.get(IngestionRunRow, absent.run_id).error_summary
    assert service.import_history("mega_645", end_id="00001").counters["created"] == 1
    collected = service.collect("mega_645")
    assert collected.status == "success"
    assert collected.counters["unchanged"] == 1
    freshness = service.status("mega_645")
    assert freshness.latest_draw_date == date(2016, 7, 20)
    assert freshness.last_successful_ingestion_at is not None
    assert freshness.unresolved_items == 0
    assert freshness.unscanned_ids_before_checkpoint == 0
    with Session(engine) as session:
        runs = session.scalars(select(IngestionRunRow).order_by(IngestionRunRow.id)).all()
        assert [row.status for row in runs] == ["failed", "success", "success"]
        assert runs[-1].finished_at is not None


@pytest.mark.integration
def test_collector_refuses_unscanned_history_gap(engine) -> None:
    fetcher = FixtureFetcher(latest="00830", pages={"00830": fixture("535", "00830")})
    service = IngestionService(engine, fetcher)
    assert service.import_history("lotto_535", start_id="00830", end_id="00830").status == "success"
    summary = service.collect("lotto_535")
    assert summary.status == "failed"
    assert service.status("lotto_535").unscanned_ids_before_checkpoint == 829
    with Session(engine) as session:
        assert (
            "history coverage incomplete"
            in session.get(IngestionRunRow, summary.run_id).error_summary
        )


@pytest.mark.integration
def test_advisory_lock_rejects_concurrent_job(engine) -> None:
    entered = Event()
    release = Event()
    page = fixture("535", "00001")

    class HoldingFetcher(FixtureFetcher):
        def fetch(self, url: str) -> tuple[str, datetime]:
            entered.set()
            assert release.wait(timeout=5)
            return super().fetch(url)

    service = IngestionService(engine, HoldingFetcher(latest="00001", pages={"00001": page}))
    other = IngestionService(engine, FixtureFetcher(latest="00001", pages={"00001": page}))
    with ThreadPoolExecutor(max_workers=2) as pool:
        future = pool.submit(service.import_history, "lotto_535", end_id="00001")
        assert entered.wait(timeout=5)
        with pytest.raises(JobOverlapError):
            other.import_history("lotto_535", end_id="00001")
        release.set()
        assert future.result().status == "success"
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(DrawRow)) == 1


@pytest.mark.integration
def test_collector_deduplicates_backfill_and_recent_recheck(engine) -> None:
    template = fixture("535", "00001")
    pages = {
        f"{sequence:05d}": template.replace("#00001", f"#{sequence:05d}")
        for sequence in range(1, 9)
    }
    fetcher = FixtureFetcher(latest="00008", pages=pages)
    service = IngestionService(engine, fetcher)
    assert service.import_history("lotto_535", end_id="00006").counters["created"] == 6
    fetcher.calls.clear()
    summary = service.collect("lotto_535")
    assert summary.status == "success"
    assert summary.counters["created"] == 2
    assert summary.counters["unchanged"] == 5
    assert fetcher.calls == ["00008", "00007", "00006", "00005", "00004", "00003", "00002"]


@pytest.mark.integration
def test_interrupted_run_is_marked_failed_before_resume(engine) -> None:
    with Session(engine) as session, session.begin():
        session.add(
            IngestionRunRow(game="mega_645", kind="import", scope={}, status="running", counters={})
        )
    fetcher = FixtureFetcher(latest="00001", pages={"00001": fixture("645", "00001")})
    summary = IngestionService(engine, fetcher).import_history("mega_645", end_id="00001")
    assert summary.status == "success"
    with Session(engine) as session:
        stale = session.get(IngestionRunRow, 1)
        assert stale.status == "failed"
        assert stale.finished_at is not None
        assert "interrupted" in stale.error_summary


@pytest.mark.integration
def test_requested_end_above_source_latest_is_not_reported_success(engine) -> None:
    fetcher = FixtureFetcher(latest="00001", pages={"00001": fixture("645", "00001")})
    summary = IngestionService(engine, fetcher).import_history("mega_645", end_id="00002")
    assert summary.status == "failed"
    with Session(engine) as session:
        assert "requested end" in session.get(IngestionRunRow, summary.run_id).error_summary
        assert session.scalar(select(func.count()).select_from(DrawRow)) == 0


@pytest.mark.integration
def test_audit_requires_full_coverage_and_matches_source_samples(engine) -> None:
    template = fixture("535", "00001")
    fetcher = FixtureFetcher(
        latest="00002", pages={"00001": template, "00002": template.replace("#00001", "#00002")}
    )
    service = IngestionService(engine, fetcher)
    assert service.import_history("lotto_535", end_id="00002").status == "success"
    report = audit_history(engine, fetcher, "lotto_535")
    assert report.complete
    assert report.stored_draws == report.scanned_ids == 2
    assert report.sample_mismatches == ()
    with Session(engine) as session, session.begin():
        session.delete(session.get(IngestionItemRow, ("lotto_535", 2)))
    incomplete = audit_history(engine, fetcher, "lotto_535")
    assert not incomplete.complete
    assert incomplete.unscanned_examples == ("00002",)

    class UnavailableSampleFetcher(FixtureFetcher):
        def fetch(self, url: str) -> tuple[str, datetime]:
            if "?nocatche=1" in url:
                return template.replace("#00001", "#00002"), RETRIEVED_AT
            return super().fetch(url)

    unavailable_fetcher = UnavailableSampleFetcher(
        latest="00002", pages={"00001": template, "00002": SourceFetchError("source", "HTTP 503")}
    )
    unavailable = audit_history(engine, unavailable_fetcher, "lotto_535")
    assert "00002:source_unavailable_or_invalid" in unavailable.sample_mismatches


@pytest.mark.integration
def test_latest_is_committed_before_backfill_and_not_fetched_twice(engine) -> None:
    template = fixture("535", "00001")
    pages = {f"{seq:05d}": template.replace("#00001", f"#{seq:05d}") for seq in range(1, 11)}

    class ObservingFetcher(FixtureFetcher):
        inspect_backfill = False

        def fetch(self, url: str) -> tuple[str, datetime]:
            if self.inspect_backfill and "?id=" in url:
                with Session(engine) as session:
                    assert session.scalar(select(func.max(DrawRow.draw_id))) == "00010"
            return super().fetch(url)

    fetcher = ObservingFetcher(latest="00010", pages=pages)
    service = IngestionService(engine, fetcher)
    service.import_history("lotto_535", end_id="00006")
    fetcher.calls.clear()
    fetcher.inspect_backfill = True
    result = service.collect("lotto_535")
    assert result.status == "success"
    assert fetcher.calls.count("00010") == 1
    assert result.counters["created"] == 4
    with Session(engine) as session:
        assert session.get(IngestionCheckpointRow, "lotto_535").last_scanned_seq == 10
        assert session.scalar(select(func.count()).select_from(DrawRow)) == 10
        assert session.scalar(select(DrawRow.source_url).where(DrawRow.draw_id == "00010")) == (
            "https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/535?id=00010&nocatche=1"
        )


@pytest.mark.integration
def test_deferred_batch_stops_and_checkpoint_resumes_unattempted_new_ids(engine) -> None:
    template = fixture("535", "00001")
    pages = {f"{seq:05d}": template.replace("#00001", f"#{seq:05d}") for seq in range(1, 11)}
    fetcher = FixtureFetcher(latest="00010", pages=pages.copy())
    service = IngestionService(engine, fetcher)
    service.import_history("lotto_535", end_id="00006")
    fetcher.calls.clear()
    fetcher.pages["00007"] = SourceDeferredError("source", "challenge; deferred")
    result = service.collect("lotto_535")
    assert result.status == "partial"
    assert fetcher.calls == ["00010", "00007"]
    assert result.counters["failed"] == 1
    with Session(engine) as session:
        assert session.get(IngestionCheckpointRow, "lotto_535").last_scanned_seq == 7
        assert session.get(IngestionItemRow, ("lotto_535", 8)) is None
        assert session.scalar(select(func.max(DrawRow.draw_id))) == "00010"
        assert "deferred" in session.get(IngestionRunRow, result.run_id).error_summary
    fetcher.pages = pages
    assert service.collect("lotto_535").status == "success"
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(DrawRow)) == 10


@pytest.mark.integration
def test_collector_bounds_large_retry_backlog_and_reports_remaining_history(engine) -> None:
    template = fixture("535", "00001")
    pages = {f"{seq:05d}": template.replace("#00001", f"#{seq:05d}") for seq in range(1, 51)}
    fetcher = FixtureFetcher(latest="00050", pages=pages)
    service = IngestionService(engine, fetcher)
    service.import_history("lotto_535", end_id="00050")
    with Session(engine) as session, session.begin():
        for seq in range(2, 50):
            session.get(IngestionItemRow, ("lotto_535", seq)).status = "failed"
    fetcher.calls.clear()
    result = service.collect("lotto_535")
    assert result.status == "partial"
    assert len(fetcher.calls) <= 20
    assert 0 < result.counters["remaining_unresolved"] < 48


@pytest.mark.integration
def test_import_stops_submitting_after_source_deferral_and_counts_inflight_results(engine) -> None:
    template = fixture("535", "00001")
    pages: dict[str, str | SourceFetchError] = {
        f"{seq:05d}": template.replace("#00001", f"#{seq:05d}") for seq in range(1, 31)
    }
    pages["00001"] = SourceDeferredError("source", "HTTP 429; deferred")
    fetcher = FixtureFetcher(latest="00030", pages=pages)
    result = IngestionService(engine, fetcher).import_history("lotto_535")
    assert result.status == "partial"
    assert len(fetcher.calls) <= 4  # upper-bound page + at most three in flight
    assert result.counters["failed"] == 1
    assert result.counters["created"] == 2


@pytest.mark.integration
def test_import_deferral_in_later_future_does_not_submit_more_ids(engine) -> None:
    blocked = Event()
    template = fixture("535", "00001")

    class OutOfOrderFetcher(FixtureFetcher):
        def fetch(self, url: str) -> tuple[str, datetime]:
            if "?id=00001" in url:
                assert blocked.wait(timeout=5)
            if "?id=00002" in url:
                blocked.set()
                raise SourceDeferredError(url, "challenge; deferred")
            return super().fetch(url)

    pages = {f"{seq:05d}": template.replace("#00001", f"#{seq:05d}") for seq in range(1, 11)}
    fetcher = OutOfOrderFetcher(latest="00010", pages=pages)
    result = IngestionService(engine, fetcher).import_history("lotto_535")
    assert result.counters["created"] == 2
    assert fetcher.calls == ["00010", "00001", "00003"] or fetcher.calls == [
        "00010",
        "00003",
        "00001",
    ]


@pytest.mark.integration
def test_latest_only_poll_uses_one_request_and_keeps_backfill_gaps_visible(engine) -> None:
    template = fixture("535", "00001")
    pages = {f"{seq:05d}": template.replace("#00001", f"#{seq:05d}") for seq in range(1, 4)}
    fetcher = FixtureFetcher(latest="00003", pages=pages)
    service = IngestionService(engine, fetcher)
    service.import_history("lotto_535")
    fetcher.calls.clear()
    assert service.collect("lotto_535", recheck_recent=False).status == "success"
    assert fetcher.calls == ["00003"]


@pytest.mark.integration
@pytest.mark.parametrize("failure", ["chronology", "database"])
def test_prefetched_write_failure_never_advances_over_unattempted_ids(engine, monkeypatch, failure):
    from app.repositories.draws import DrawRepository

    template = fixture("535", "00001")
    pages = {f"{seq:05d}": template.replace("#00001", f"#{seq:05d}") for seq in range(1, 101)}
    fetcher = FixtureFetcher(latest="00100", pages=pages)
    service = IngestionService(engine, fetcher)
    service.import_history("lotto_535", end_id="00001")
    if failure == "chronology":
        assert "29/06/2025" in pages["00100"]
        fetcher.pages["00100"] = pages["00100"].replace("29/06/2025", "28/06/2025")
    else:
        original_add = DrawRepository.add

        def fail_latest(repo, draw):
            if draw.draw_id == "00100":
                raise SQLAlchemyError("injected database failure")
            return original_add(repo, draw)

        monkeypatch.setattr(DrawRepository, "add", fail_latest)
    first = service.collect("lotto_535")
    assert first.status == "partial"
    with Session(engine) as session:
        assert session.get(IngestionCheckpointRow, "lotto_535").last_scanned_seq == 20
        assert session.get(IngestionItemRow, ("lotto_535", 21)) is None
    second = service.collect("lotto_535")
    with Session(engine) as session:
        assert session.get(IngestionRunRow, second.run_id).error_summary is None
        assert session.get(IngestionCheckpointRow, "lotto_535").last_scanned_seq > 20


@pytest.mark.integration
def test_permanent_recent_failures_do_not_starve_older_recoverable_ids(engine):
    template = fixture("535", "00001")
    pages = {f"{seq:05d}": template.replace("#00001", f"#{seq:05d}") for seq in range(1, 51)}
    fetcher = FixtureFetcher(latest="00050", pages=pages)
    service = IngestionService(engine, fetcher)
    service.import_history("lotto_535")
    with Session(engine) as session, session.begin():
        for seq in range(2, 50):
            item = session.get(IngestionItemRow, ("lotto_535", seq))
            item.status = "failed"
            item.attempted_at = datetime(2000, 1, 1, tzinfo=UTC)
    for seq in range(4, 50):
        del fetcher.pages[f"{seq:05d}"]
    for _ in range(2):
        assert service.collect("lotto_535").status == "partial"
    with Session(engine) as session:
        assert session.get(IngestionItemRow, ("lotto_535", 2)).status == "found"
        assert session.get(IngestionItemRow, ("lotto_535", 3)).status == "found"
