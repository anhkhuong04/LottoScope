"""Small hand-checked examples for the two game boundaries."""

from dataclasses import replace
from datetime import UTC, date, datetime, time

import pytest

from app.domain.draw import Combination, Draw, normalize_pair, validate_draw_id
from app.games.definitions import DomainValidationError, get_game


def draw(game: str = "lotto_535") -> Draw:
    return Draw(
        game=game,
        draw_id="00001",
        draw_date=date(2026, 1, 1),
        draw_time=time(13, 0),
        main_numbers=(5, 1, 4, 2, 3) if game == "lotto_535" else (6, 1, 5, 2, 4, 3),
        special_number=12 if game == "lotto_535" else None,
        source_url="https://example.test/draw/1",
        source_retrieved_at=datetime(2026, 1, 1, tzinfo=UTC),
    )


def test_game_rules_and_canonical_identity() -> None:
    assert (get_game("lotto_535").main_count, get_game("lotto_535").special_max) == (5, 12)
    assert (get_game("mega_645").main_count, get_game("mega_645").special_max) == (6, None)
    assert draw().main_numbers == (1, 2, 3, 4, 5)
    assert draw("mega_645").main_numbers == (1, 2, 3, 4, 5, 6)
    assert draw().source_sha256 == replace(draw(), main_numbers=(3, 2, 1, 5, 4)).source_sha256
    assert Combination("lotto_535", (5, 4, 3, 2, 1)) == Combination("lotto_535", (1, 2, 3, 4, 5))
    assert normalize_pair("lotto_535", 35, 1) == (1, 35)
    assert validate_draw_id("00001") == 1


@pytest.mark.parametrize("game", ["unknown", "lotto_535_extra", ""])
def test_reject_unknown_game(game: str) -> None:
    with pytest.raises(DomainValidationError, match="game"):
        get_game(game)
    with pytest.raises(DomainValidationError, match="game"):
        replace(draw(), game=game)


@pytest.mark.parametrize(
    ("numbers", "message"),
    [
        ((1, 2, 3, 4), "expected 5"),
        ((1, 2, 3, 4, 4), "duplicate"),
        ((1, 2, 3, 4, 36), "1..35"),
        ((1, 2, 3, 4, True), "integer"),
        ((1, 2, 3, 4, 5.0), "integer"),
    ],
)
def test_reject_invalid_main(numbers: tuple[object, ...], message: str) -> None:
    with pytest.raises(DomainValidationError, match=message):
        Combination("lotto_535", numbers)  # type: ignore[arg-type]


def test_game_specific_special_and_main_are_independent() -> None:
    assert draw().special_number == 12
    with pytest.raises(DomainValidationError, match="special_number"):
        replace(draw(), special_number=13)
    with pytest.raises(DomainValidationError, match="special_number"):
        replace(draw("mega_645"), special_number=1)
    with pytest.raises(DomainValidationError, match="main_numbers"):
        replace(draw("mega_645"), main_numbers=(1, 2, 3, 4, 5, 46))
    with pytest.raises(DomainValidationError, match="pair"):
        normalize_pair("lotto_535", 12, 12)
    with pytest.raises(DomainValidationError, match="pair"):
        normalize_pair("mega_645", 1, 46)


@pytest.mark.parametrize("draw_id", ["00000", "1", "123456", "0000a", "１２３４５"])
def test_reject_invalid_draw_id(draw_id: str) -> None:
    with pytest.raises(DomainValidationError, match="draw_id"):
        validate_draw_id(draw_id)


def test_reject_invalid_provenance() -> None:
    with pytest.raises(DomainValidationError, match="source_url"):
        replace(draw(), source_url="file:///tmp/a")
    with pytest.raises(DomainValidationError, match="source_retrieved_at"):
        replace(draw(), source_retrieved_at=datetime(2026, 1, 1))
    with pytest.raises(DomainValidationError, match="draw_time"):
        replace(draw(), draw_time=time(13, 0, tzinfo=UTC))
