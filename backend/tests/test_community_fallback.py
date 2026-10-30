"""Fixed untrusted feeds and real PostgreSQL append-only fallback regression checks."""

import json
from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session
from test_ingestion_service import engine as engine

from app.domain.draw import Draw
from app.ingestion.community import CommunityFallbackService, feed_url, parse_feed
from app.ingestion.fetcher import SourceDeferredError, SourceFetchError
from app.ingestion.service import JobOverlapError
from app.models.draw import DrawRow
from app.models.ingestion import IngestionCheckpointRow, IngestionItemRow, IngestionRunRow
from app.repositories.draws import DrawRepository
from app.services.sync import ManualSyncService, SyncSourceUnavailableError

NOW = datetime(2026, 10, 30, tzinfo=UTC)
GAMES = ("lotto_535", "mega_645", "power_655")


def record(game, sequence):
    main = [1, 2, 3, 4, 5] if game == "lotto_535" else [1, 2, 3, 4, 5, 6]
    return {
        "id": f"{sequence:05d}",
        "date": (date(2026, 1, 1) + timedelta(days=sequence - 100)).isoformat(),
        "result": main + ([] if game == "mega_645" else [10]),
    }


def body(game, end=121):
    return "\n".join(json.dumps(record(game, seq)) for seq in range(100, end + 1))


class FeedFetcher:
    def __init__(self, content, *, challenge=True):
        self.content = content
        self.challenge = challenge
        self.calls = []

    def fetch(self, url):
        self.calls.append(url)
        if url.startswith("https://vietlott.vn/"):
            if self.challenge:
                raise SourceDeferredError(url, "Cloudflare challenge; deferred")
            raise SourceFetchError(url, "HTTP 503")
        return self.content, NOW


def seed(db, game):
    draws = parse_feed(body(game, 119), game, 100, NOW)
    with Session(db) as session, session.begin():
        run = IngestionRunRow(game=game, kind="import", status="success", counters={}, scope={})
        session.add(run)
        session.flush()
        session.add_all(
            IngestionItemRow(game=game, draw_seq=seq, status="found", last_run_id=run.id)
            for seq in range(1, 120)
        )
        for draw in draws.values():
            DrawRepository(session).add(
                Draw(
                    game=game,
                    draw_id=draw.draw_id,
                    draw_date=draw.draw_date,
                    draw_time=None,
                    main_numbers=draw.main_numbers,
                    special_number=draw.special_number,
                    source_url="https://vietlott.vn/reference",
                    source_retrieved_at=NOW,
                )
            )
        session.add(IngestionCheckpointRow(game=game, last_scanned_seq=119))


@pytest.mark.parametrize("game", GAMES)
def test_parse_preserves_separate_main_special_and_unknown_time(game):
    draw = parse_feed(body(game, 100), game, 100, NOW)[100]
    assert draw.main_numbers == ((1, 2, 3, 4, 5) if game == "lotto_535" else (1, 2, 3, 4, 5, 6))
    assert draw.special_number == (None if game == "mega_645" else 10)
    assert draw.draw_time is None
    assert draw.source_url == feed_url(game) + "#draw=00100"


@pytest.mark.parametrize(
    "field,value",
    [
        ("result", [True, 2, 3, 4, 5, 10]),
        ("result", [1, 1, 3, 4, 5, 10]),
        ("result", [1, 2, 3, 4, 36, 10]),
        ("result", [1, 2, 3, 4, 5, 13]),
        ("result", [1, 2, 3, 4, 5]),
        ("date", "2099-01-01"),
        ("date", 20260101),
        ("id", "100"),
    ],
)
def test_invalid_recent_record_rejected(field, value):
    row = record("lotto_535", 100)
    row[field] = value
    with pytest.raises(ValueError):
        parse_feed(json.dumps(row), "lotto_535", 100, NOW)


def test_duplicate_ids_rejected_but_old_bad_content_not_imported():
    content = body("power_655", 100)
    old_bad = '{"id":"00099","date":"wrong","result":[1]}'
    assert list(parse_feed(old_bad + "\n" + content, "power_655", 100, NOW)) == [100]
    with pytest.raises(ValueError, match="duplicate"):
        parse_feed(content + "\n" + content, "power_655", 100, NOW)


@pytest.mark.integration
@pytest.mark.parametrize("game", GAMES)
def test_append_and_repeat_preserve_official_history(engine, game):
    seed(engine, game)
    service = CommunityFallbackService(engine, FeedFetcher(body(game)))
    result = service.collect(game)
    assert result.status == "success" and result.source == "community"
    assert result.counters["created"] == 2
    assert service.collect(game).counters["created"] == 0
    with Session(engine) as session:
        rows = session.scalars(select(DrawRow).order_by(DrawRow.draw_seq)).all()
        assert len(rows) == 22
        assert all(row.source_url == "https://vietlott.vn/reference" for row in rows[:20])
        assert all(row.source_url.startswith(feed_url(game)) for row in rows[20:])
        assert session.get(IngestionCheckpointRow, game).last_scanned_seq == 121
        assert session.get(IngestionRunRow, result.run_id).scope["source"] == "community"


@pytest.mark.integration
@pytest.mark.parametrize("defect", ["anchor", "gap", "invalid", "chronology", "too_many"])
def test_bad_feed_is_atomic_and_audited(engine, defect):
    game = "power_655"
    seed(engine, game)
    records = [record(game, seq) for seq in range(100, 122)]
    if defect == "anchor":
        records[0]["result"] = [2, 3, 4, 5, 6, 7, 10]
    elif defect == "gap":
        records.pop(20)
    elif defect == "invalid":
        records[-1]["result"] = [1, 2]
    elif defect == "chronology":
        records[-1]["date"] = "2026-01-01"
    else:
        records.extend(record(game, seq) for seq in range(122, 141))
    result = CommunityFallbackService(
        engine, FeedFetcher("\n".join(json.dumps(row) for row in records))
    ).collect(game)
    assert result.status == "failed" and result.counters["created"] == 0
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(DrawRow)) == 20
        assert session.get(IngestionCheckpointRow, game).last_scanned_seq == 119
        run = session.get(IngestionRunRow, result.run_id)
        assert run.error_summary and run.finished_at


@pytest.mark.integration
@pytest.mark.parametrize(
    "enabled,challenge,success",
    [
        (False, True, False),
        (True, False, False),
        (True, True, True),
    ],
)
def test_only_opted_in_official_challenge_triggers_fallback(engine, enabled, challenge, success):
    seed(engine, "mega_645")
    fetcher = FeedFetcher(body("mega_645"), challenge=challenge)
    service = ManualSyncService(engine, fetcher, community_fallback_enabled=enabled)
    if success:
        result = service.sync("mega_645")
        assert result.source == "community" and result.created == 2
    else:
        with pytest.raises(SyncSourceUnavailableError):
            service.sync("mega_645")
    assert (feed_url("mega_645") in fetcher.calls) is success


@pytest.mark.integration
def test_fallback_respects_per_game_lock(engine):
    with engine.connect() as lock:
        lock.execute(text("SELECT pg_advisory_lock(5043, hashtext('lotto_535'))"))
        try:
            with pytest.raises(JobOverlapError):
                CommunityFallbackService(engine, FeedFetcher("")).collect("lotto_535")
        finally:
            lock.execute(text("SELECT pg_advisory_unlock(5043, hashtext('lotto_535'))"))


@pytest.mark.integration
def test_existing_backlog_remains_visible_without_advancing_across_unscanned_id(engine):
    seed(engine, "mega_645")
    with Session(engine) as session, session.begin():
        session.delete(session.get(IngestionItemRow, ("mega_645", 1)))
    result = CommunityFallbackService(engine, FeedFetcher(body("mega_645"))).collect("mega_645")
    assert result.status == "partial" and result.latest_poll_succeeded
    assert result.counters["remaining_unresolved"] == 1
    with Session(engine) as session:
        assert session.get(IngestionCheckpointRow, "mega_645").last_scanned_seq == 119


@pytest.mark.integration
def test_no_reference_history_refuses_fallback_before_network_io(engine):
    fetcher = FeedFetcher(body("lotto_535"))
    result = CommunityFallbackService(engine, fetcher).collect("lotto_535")
    assert result.status == "failed" and fetcher.calls == []
