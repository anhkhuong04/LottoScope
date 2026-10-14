"""Extend game constraints without rewriting existing draws, hashes or audit."""

import sqlalchemy as sa
from alembic import op

revision = "0005_power_655"
down_revision = "0004_draw_prizes"
branch_labels = None
depends_on = None

GAME_TABLES = (
    "draws",
    "game_data_state",
    "ingestion_runs",
    "ingestion_checkpoints",
    "ingestion_items",
)
LEGACY_NUMBERS = (
    "(game = 'lotto_535' AND cardinality(main_numbers) = 5 "
    "AND special_number BETWEEN 1 AND 12) OR "
    "(game = 'mega_645' AND cardinality(main_numbers) = 6 AND special_number IS NULL)"
)


def _replace_games(allowed: str) -> None:
    for table in GAME_TABLES:
        name = f"ck_{table}_game"
        op.drop_constraint(name, table, type_="check")
        op.create_check_constraint(name, table, f"game IN ({allowed})")


def upgrade() -> None:
    _replace_games("'lotto_535', 'mega_645', 'power_655'")
    op.drop_constraint("ck_draws_game_numbers", "draws", type_="check")
    op.create_check_constraint(
        "ck_draws_game_numbers",
        "draws",
        LEGACY_NUMBERS + " OR "
        "(game = 'power_655' AND cardinality(main_numbers) = 6 "
        "AND special_number IS NOT NULL AND special_number BETWEEN 1 AND 55 "
        "AND special_number <> ALL(main_numbers))",
    )


def downgrade() -> None:
    connection = op.get_bind()
    for table in GAME_TABLES:
        # Constant table allowlist; no user input is interpolated into SQL.
        if connection.scalar(
            sa.text(f"SELECT EXISTS (SELECT 1 FROM {table} WHERE game = 'power_655')")
        ):
            raise RuntimeError(
                "Power data exists; restore a pre-Power backup instead of deleting it"
            )
    op.drop_constraint("ck_draws_game_numbers", "draws", type_="check")
    op.create_check_constraint("ck_draws_game_numbers", "draws", LEGACY_NUMBERS)
    _replace_games("'lotto_535', 'mega_645'")
