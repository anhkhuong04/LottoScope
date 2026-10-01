"""Add validated draw storage, data version, and correction audit.

Revision ID: 0002_draw_storage
Revises: 0001_baseline
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_draw_storage"
down_revision: str | None = "0001_baseline"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "draws",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column("game", sa.String(length=16), nullable=False),
        sa.Column("draw_id", sa.CHAR(length=5), nullable=False),
        sa.Column("draw_seq", sa.Integer(), nullable=False),
        sa.Column("draw_date", sa.Date(), nullable=False),
        sa.Column("draw_time", sa.Time(), nullable=True),
        sa.Column("main_numbers", postgresql.ARRAY(sa.SmallInteger()), nullable=False),
        sa.Column("special_number", sa.SmallInteger(), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("source_retrieved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source_sha256", sa.CHAR(length=64), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("game IN ('lotto_535', 'mega_645')", name="ck_draws_game"),
        sa.CheckConstraint(
            "draw_id ~ '^[0-9]{5}$' AND draw_seq > 0 AND draw_seq = CAST(draw_id AS integer)",
            name="ck_draws_id_seq",
        ),
        sa.CheckConstraint(
            "(game = 'lotto_535' AND cardinality(main_numbers) = 5 "
            "AND special_number BETWEEN 1 AND 12) OR "
            "(game = 'mega_645' AND cardinality(main_numbers) = 6 "
            "AND special_number IS NULL)",
            name="ck_draws_game_numbers",
        ),
        sa.UniqueConstraint("game", "draw_id", name="uq_draws_game_draw_id"),
        sa.UniqueConstraint("game", "draw_seq", name="uq_draws_game_draw_seq"),
    )
    op.create_index(
        "ix_draws_game_date_seq",
        "draws",
        ["game", sa.text("draw_date DESC"), sa.text("draw_seq DESC")],
    )
    op.create_index("ix_draws_main_numbers_gin", "draws", ["main_numbers"], postgresql_using="gin")
    op.create_table(
        "game_data_state",
        sa.Column("game", sa.String(length=16), primary_key=True),
        sa.Column("version", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("game IN ('lotto_535', 'mega_645')", name="ck_game_data_state_game"),
        sa.CheckConstraint("version >= 0", name="ck_game_data_state_version"),
    )
    op.create_table(
        "draw_corrections",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column(
            "draw_pk",
            sa.BigInteger(),
            sa.ForeignKey("draws.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=12), nullable=False, server_default="pending"),
        sa.Column("old_payload", postgresql.JSONB(), nullable=False),
        sa.Column("new_payload", postgresql.JSONB(), nullable=False),
        sa.Column("new_sha256", sa.CHAR(length=64), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("source_retrieved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('pending', 'applied')", name="ck_draw_corrections_status"),
    )
    op.create_index(
        "uq_draw_corrections_pending_hash",
        "draw_corrections",
        ["draw_pk", "new_sha256"],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )


def downgrade() -> None:
    op.drop_index("uq_draw_corrections_pending_hash", table_name="draw_corrections")
    op.drop_table("draw_corrections")
    op.drop_table("game_data_state")
    op.drop_index("ix_draws_main_numbers_gin", table_name="draws")
    op.drop_index("ix_draws_game_date_seq", table_name="draws")
    op.drop_table("draws")
