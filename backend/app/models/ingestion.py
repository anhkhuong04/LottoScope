"""Persistent import/collector progress and run outcomes."""

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Integer,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class IngestionRunRow(Base):
    __tablename__ = "ingestion_runs"
    __table_args__ = (
        CheckConstraint("game IN ('lotto_535', 'mega_645')", name="ck_ingestion_runs_game"),
        CheckConstraint("kind IN ('import', 'collector')", name="ck_ingestion_runs_kind"),
        CheckConstraint(
            "status IN ('running', 'success', 'partial', 'failed')", name="ck_ingestion_runs_status"
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    game: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    scope: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(Text, nullable=False)
    counters: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    error_summary: Mapped[str | None] = mapped_column(Text)


class IngestionCheckpointRow(Base):
    __tablename__ = "ingestion_checkpoints"
    __table_args__ = (
        CheckConstraint("game IN ('lotto_535', 'mega_645')", name="ck_ingestion_checkpoints_game"),
        CheckConstraint("last_scanned_seq >= 0", name="ck_ingestion_checkpoints_seq"),
    )

    game: Mapped[str] = mapped_column(Text, primary_key=True)
    last_scanned_seq: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class IngestionItemRow(Base):
    __tablename__ = "ingestion_items"
    __table_args__ = (
        CheckConstraint("game IN ('lotto_535', 'mega_645')", name="ck_ingestion_items_game"),
        CheckConstraint("draw_seq > 0", name="ck_ingestion_items_seq"),
        CheckConstraint(
            "status IN ('found', 'missing', 'invalid', 'failed', 'excluded')",
            name="ck_ingestion_items_status",
        ),
    )

    game: Mapped[str] = mapped_column(Text, primary_key=True)
    draw_seq: Mapped[int] = mapped_column(Integer, primary_key=True)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    attempted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    error_summary: Mapped[str | None] = mapped_column(Text)
    last_run_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("ingestion_runs.id", ondelete="RESTRICT"), nullable=False
    )
