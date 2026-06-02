"""duel staking escrow

Revision ID: b8e2a1c3d4f5
Revises: 4f321176957a
Create Date: 2026-06-10 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b8e2a1c3d4f5"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- UserProfile: add duel_points_balance --
    op.add_column(
        "user_profiles",
        sa.Column("duel_points_balance", sa.Integer(), nullable=False, server_default="0"),
    )

    # -- DuelChallenge: add new columns --
    op.add_column(
        "duel_challenges",
        sa.Column("stake_points", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "duel_challenges",
        sa.Column("challenger_score", sa.Integer(), nullable=True),
    )
    op.add_column(
        "duel_challenges",
        sa.Column("opponent_score", sa.Integer(), nullable=True),
    )
    op.add_column(
        "duel_challenges",
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )

    # -- Drop old is_draw column --
    op.drop_column("duel_challenges", "is_draw")

    # -- Update status CHECK constraint --
    # Drop old constraint, create new one
    op.drop_constraint("ck_duels_status", "duel_challenges", type_="check")

    # Migrate existing status values: accepted -> active, scored -> completed
    op.execute("UPDATE duel_challenges SET status = 'active' WHERE status = 'accepted'")
    op.execute("UPDATE duel_challenges SET status = 'completed' WHERE status = 'scored'")

    op.create_check_constraint(
        "ck_duels_status",
        "duel_challenges",
        "status IN ('pending','active','declined','expired','completed')",
    )

    # -- Add stake CHECK constraint --
    op.create_check_constraint(
        "ck_duels_stake_positive",
        "duel_challenges",
        "stake_points >= 0",
    )


def downgrade() -> None:
    op.drop_constraint("ck_duels_stake_positive", "duel_challenges", type_="check")
    op.drop_constraint("ck_duels_status", "duel_challenges", type_="check")

    op.execute("UPDATE duel_challenges SET status = 'accepted' WHERE status = 'active'")
    op.execute("UPDATE duel_challenges SET status = 'scored' WHERE status = 'completed'")

    op.create_check_constraint(
        "ck_duels_status",
        "duel_challenges",
        "status IN ('pending','accepted','declined','expired','scored')",
    )

    op.add_column(
        "duel_challenges",
        sa.Column("is_draw", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.drop_column("duel_challenges", "resolved_at")
    op.drop_column("duel_challenges", "opponent_score")
    op.drop_column("duel_challenges", "challenger_score")
    op.drop_column("duel_challenges", "stake_points")
    op.drop_column("user_profiles", "duel_points_balance")
