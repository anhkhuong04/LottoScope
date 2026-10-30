"""Nullable prize snapshots preserve all existing draw identities and result hashes."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004_draw_prizes"
down_revision = "0003_ingestion_tracking"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("draws", sa.Column("prizes", postgresql.JSONB(none_as_null=True), nullable=True))
    op.add_column(
        "draws", sa.Column("prizes_retrieved_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_check_constraint(
        "ck_draws_prizes_snapshot",
        "draws",
        "(prizes IS NULL AND prizes_retrieved_at IS NULL) OR "
        "(prizes IS NOT NULL AND prizes_retrieved_at IS NOT NULL "
        "AND jsonb_typeof(prizes) = 'array' AND jsonb_array_length(prizes) > 0)",
    )


def downgrade() -> None:
    # This removes collected prize snapshots; restore from a backup if they are needed.
    op.drop_constraint("ck_draws_prizes_snapshot", "draws", type_="check")
    op.drop_column("draws", "prizes_retrieved_at")
    op.drop_column("draws", "prizes")
