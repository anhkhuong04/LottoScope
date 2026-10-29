"""Typed runtime configuration; no settings are loaded at import time."""

from functools import lru_cache
from typing import Literal, Self

from pydantic import Field, PostgresDsn, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class IngressSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="LOTTO_", extra="ignore", hide_input_in_errors=True
    )

    deployment_mode: Literal["local", "cloud"] = "local"
    origin_token: SecretStr | None = Field(default=None, min_length=32)

    @model_validator(mode="after")
    def require_cloud_token(self) -> Self:
        if self.deployment_mode == "cloud" and self.origin_token is None:
            raise ValueError(
                "Cloud deployment requires LOTTO_ORIGIN_TOKEN (at least 32 characters)"
            )
        return self


class Settings(IngressSettings):
    database_url: PostgresDsn
    scheduler_enabled: bool = False
    lotto_poll_first: str = "14:00"
    lotto_poll_second: str = "22:30"
    mega_poll: str = "19:30"
    power_poll: str = "19:30"
    reconcile_poll: str = "07:00"
    source_request_interval: float = Field(default=1.0, ge=1.0, allow_inf_nan=False)
    latest_poll_minutes: int = Field(default=5, ge=5, le=60)

    @field_validator("database_url", mode="before")
    @classmethod
    def use_psycopg_driver(cls, value: object) -> object:
        if isinstance(value, str):
            for prefix in ("postgres://", "postgresql://"):
                if value.startswith(prefix):
                    return "postgresql+psycopg://" + value[len(prefix) :]
        return value

    @model_validator(mode="after")
    def validate_cloud_database(self) -> Self:
        if self.deployment_mode == "cloud":
            if self.scheduler_enabled:
                raise ValueError("Cloud free-tier deployment requires scheduler disabled")
            if "-pooler." in str(self.database_url):
                raise ValueError("Use a direct PostgreSQL endpoint for session advisory locks")
        return self


class SchedulerSwitch(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LOTTO_", extra="ignore")

    scheduler_enabled: bool = False


@lru_cache
def get_settings() -> Settings:
    # BaseSettings supplies required fields from the environment at runtime.
    return Settings()  # pyright: ignore[reportCallIssue]


def scheduler_enabled() -> bool:
    return SchedulerSwitch().scheduler_enabled
