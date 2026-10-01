"""Typed runtime configuration; no settings are loaded at import time."""

from functools import lru_cache

from pydantic import PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LOTTO_", extra="ignore")

    database_url: PostgresDsn


@lru_cache
def get_settings() -> Settings:
    # BaseSettings supplies required fields from the environment at runtime.
    return Settings()  # pyright: ignore[reportCallIssue]
