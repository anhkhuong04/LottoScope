"""Add ingestion run, checkpoint, and item tracking.

Revision ID: 0003_ingestion_tracking
Revises: 0002_draw_storage
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_ingestion_tracking"
down_revision: str | None = "0002_draw_storage"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ingestion_runs",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column("game", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("scope", postgresql.JSONB(), nullable=False),
        sa.Column(
            "started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("counters", postgresql.JSONB(), nullable=False),
        sa.Column("error_summary", sa.Text()),
        sa.CheckConstraint("game IN ('lotto_535', 'mega_645')", name="ck_ingestion_runs_game"),
        sa.CheckConstraint("kind IN ('import', 'collector')", name="ck_ingestion_runs_kind"),
        sa.CheckConstraint(
            "status IN ('running', 'success', 'partial', 'failed')", name="ck_ingestion_runs_status"
        ),
    )
    op.create_table(
        "ingestion_checkpoints",
        sa.Column("game", sa.Text(), primary_key=True),
        sa.Column("last_scanned_seq", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "game IN ('lotto_535', 'mega_645')", name="ck_ingestion_checkpoints_game"
        ),
        sa.CheckConstraint("last_scanned_seq >= 0", name="ck_ingestion_checkpoints_seq"),
    )
    op.create_table(
        "ingestion_items",
        sa.Column("game", sa.Text(), primary_key=True),
        sa.Column("draw_seq", sa.Integer(), primary_key=True),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column(
            "attempted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("error_summary", sa.Text()),
        sa.Column(
            "last_run_id",
            sa.BigInteger(),
            sa.ForeignKey("ingestion_runs.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.CheckConstraint("game IN ('lotto_535', 'mega_645')", name="ck_ingestion_items_game"),
        sa.CheckConstraint("draw_seq > 0", name="ck_ingestion_items_seq"),
        sa.CheckConstraint(
            "status IN ('found', 'missing', 'invalid', 'failed', 'excluded')",
            name="ck_ingestion_items_status",
        ),
    )


def downgrade() -> None:
    op.drop_table("ingestion_items")
    op.drop_table("ingestion_checkpoints")
    op.drop_table("ingestion_runs")
