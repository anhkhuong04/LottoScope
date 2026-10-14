"""Typed runtime configuration; no settings are loaded at import time."""

from functools import lru_cache

from pydantic import Field, PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LOTTO_", extra="ignore")

    database_url: PostgresDsn
    scheduler_enabled: bool = False
    lotto_poll_first: str = "14:00"
    lotto_poll_second: str = "22:30"
    mega_poll: str = "19:30"
    power_poll: str = "19:30"
    reconcile_poll: str = "07:00"
    source_request_interval: float = Field(default=1.0, ge=1.0, allow_inf_nan=False)


class SchedulerSwitch(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LOTTO_", extra="ignore")

    scheduler_enabled: bool = False


@lru_cache
def get_settings() -> Settings:
    # BaseSettings supplies required fields from the environment at runtime.
    return Settings()  # pyright: ignore[reportCallIssue]


def scheduler_enabled() -> bool:
    return SchedulerSwitch().scheduler_enabled
