"""Session advisory lock shared by official and fallback ingestion."""

from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy import Engine, text


class JobOverlapError(RuntimeError):
    """Another ingestion job holds the required advisory lock."""


@contextmanager
def game_ingestion_lock(engine: Engine, game: str, overlap_message: str) -> Generator[None]:
    parameters = {"game": game}
    with engine.connect() as connection:
        acquired = connection.scalar(
            text("SELECT pg_try_advisory_lock(5043, hashtext(:game))"), parameters
        )
        if not acquired:
            raise JobOverlapError(overlap_message)
        try:
            yield
        finally:
            connection.scalar(text("SELECT pg_advisory_unlock(5043, hashtext(:game))"), parameters)
