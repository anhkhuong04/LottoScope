"""Latest-only task success is independent of an older historical backlog."""

import sys

import pytest

import app.commands.sync_games as sync_games
from app.ingestion.service import RunSummary


@pytest.mark.parametrize(
    ("status", "counts", "reconcile", "expected"),
    [
        ("partial", {"unchanged": 1, "remaining_unresolved": 1246}, False, 0),
        ("partial", {"created": 1, "remaining_unresolved": 1246}, False, 0),
        ("partial", {"unchanged": 1, "remaining_unresolved": 1246}, True, 1),
        ("failed", {}, False, 1),
        ("partial", {"remaining_unresolved": 1246}, False, 1),
        ("partial", {"created": 1, "failed": 1, "remaining_unresolved": 1}, False, 1),
        ("partial", {"unchanged": 1, "invalid": 1, "remaining_unresolved": 1}, False, 1),
        ("partial", {"unchanged": 1, "missing": 1, "remaining_unresolved": 1}, False, 1),
        ("partial", {"unchanged": 1, "conflict": 1, "remaining_unresolved": 1}, False, 1),
        ("success", {"unchanged": 1, "remaining_unresolved": 0}, False, 0),
    ],
)
def test_task_exit_distinguishes_latest_success_from_history_backlog(
    monkeypatch, status, counts, reconcile, expected
) -> None:
    summary = RunSummary(1, "power_655", "collector", status, counts)
    arguments = ["sync_games"] + (["--recheck-recent"] if reconcile else [])
    monkeypatch.setattr(sys, "argv", arguments)

    def run(*, recheck_recent):
        assert recheck_recent is reconcile
        return (summary,)

    monkeypatch.setattr(sync_games, "run_collections", run)
    assert sync_games.main() == expected
    assert summary.status == status  # Full-history incompleteness remains explicit.
