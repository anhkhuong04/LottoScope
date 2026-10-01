"""Draw storage and correction audit tables."""

from datetime import date, datetime, time

from sqlalchemy import (
    CHAR,
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DrawRow(Base):
    __tablename__ = "draws"
    __table_args__ = (
        CheckConstraint("game IN ('lotto_535', 'mega_645')", name="ck_draws_game"),
        CheckConstraint(
            "draw_id ~ '^[0-9]{5}$' AND draw_seq > 0 AND draw_seq = CAST(draw_id AS integer)",
            name="ck_draws_id_seq",
        ),
        CheckConstraint(
            "(game = 'lotto_535' AND cardinality(main_numbers) = 5 "
            "AND special_number BETWEEN 1 AND 12) OR "
            "(game = 'mega_645' AND cardinality(main_numbers) = 6 "
            "AND special_number IS NULL)",
            name="ck_draws_game_numbers",
        ),
        UniqueConstraint("game", "draw_id", name="uq_draws_game_draw_id"),
        UniqueConstraint("game", "draw_seq", name="uq_draws_game_draw_seq"),
        Index("ix_draws_game_date_seq", "game", text("draw_date DESC"), text("draw_seq DESC")),
        Index("ix_draws_main_numbers_gin", "main_numbers", postgresql_using="gin"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    game: Mapped[str] = mapped_column(String(16), nullable=False)
    draw_id: Mapped[str] = mapped_column(CHAR(5), nullable=False)
    draw_seq: Mapped[int] = mapped_column(Integer, nullable=False)
    draw_date: Mapped[date] = mapped_column(Date, nullable=False)
    draw_time: Mapped[time | None] = mapped_column(nullable=True)
    main_numbers: Mapped[list[int]] = mapped_column(ARRAY(SmallInteger), nullable=False)
    special_number: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    source_retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source_sha256: Mapped[str] = mapped_column(CHAR(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class GameDataStateRow(Base):
    __tablename__ = "game_data_state"
    __table_args__ = (
        CheckConstraint("game IN ('lotto_535', 'mega_645')", name="ck_game_data_state_game"),
        CheckConstraint("version >= 0", name="ck_game_data_state_version"),
    )

    game: Mapped[str] = mapped_column(String(16), primary_key=True)
    version: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default="0")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class DrawCorrectionRow(Base):
    __tablename__ = "draw_corrections"
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'applied')", name="ck_draw_corrections_status"),
        Index(
            "uq_draw_corrections_pending_hash",
            "draw_pk",
            "new_sha256",
            unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    draw_pk: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("draws.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(12), nullable=False, server_default="pending")
    old_payload: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    new_payload: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    new_sha256: Mapped[str] = mapped_column(CHAR(64), nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    source_retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
