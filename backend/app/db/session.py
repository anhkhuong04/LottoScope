"""Create a session per operation; never share a mutable session globally."""

from collections.abc import Generator
from contextlib import contextmanager
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from app.core.config import get_settings


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    return create_engine(str(get_settings().database_url), pool_pre_ping=True)


@contextmanager
def session_scope() -> Generator[Session]:
    with Session(get_engine()) as session, session.begin():
        yield session
