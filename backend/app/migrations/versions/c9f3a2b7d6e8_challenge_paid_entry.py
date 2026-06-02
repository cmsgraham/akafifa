"""challenge paid entry system

Revision ID: c9f3a2b7d6e8
Revises: b8e2a1c3d4f5
Create Date: 2026-06-11 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = "c9f3a2b7d6e8"
down_revision: Union[str, None] = "b8e2a1c3d4f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- UserProfile: add challenge_points_balance --
    op.add_column(
        "user_profiles",
        sa.Column("challenge_points_balance", sa.Integer(), nullable=False, server_default="0"),
    )

    # -- FlashChallenge: replace points_value with participation_cost + reward_points --
    op.add_column(
        "flash_challenges",
        sa.Column("participation_cost", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "flash_challenges",
        sa.Column("reward_points", sa.Integer(), nullable=False, server_default="3"),
    )
    # Migrate data: set reward_points = old points_value, participation_cost = 1
    op.execute("UPDATE flash_challenges SET reward_points = points_value")
    op.drop_column("flash_challenges", "points_value")

    # -- FlashChallenge: update status check constraint --
    # Drop old constraint first, then migrate data, then add new constraint
    op.drop_constraint("ck_flash_status", "flash_challenges", type_="check")
    op.execute("UPDATE flash_challenges SET status = 'active' WHERE status = 'open'")
    op.execute("UPDATE flash_challenges SET status = 'locked' WHERE status = 'closed'")
    op.create_check_constraint(
        "ck_flash_status",
        "flash_challenges",
        "status IN ('draft','active','locked','resolved','cancelled')",
    )

    # -- FlashChallengeAnswer: add paid_points, reward_points_awarded, outcome_status --
    op.add_column(
        "flash_challenge_answers",
        sa.Column("paid_points", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "flash_challenge_answers",
        sa.Column("reward_points_awarded", sa.Integer(), nullable=True),
    )
    op.add_column(
        "flash_challenge_answers",
        sa.Column("outcome_status", sa.Text(), nullable=False, server_default="pending"),
    )
    # Migrate old resolved answers
    op.execute("""
        UPDATE flash_challenge_answers
        SET outcome_status = 'won', reward_points_awarded = points_awarded
        WHERE points_awarded IS NOT NULL AND points_awarded > 0
    """)
    op.execute("""
        UPDATE flash_challenge_answers
        SET outcome_status = 'lost', reward_points_awarded = 0
        WHERE points_awarded IS NOT NULL AND points_awarded = 0
    """)
    op.drop_column("flash_challenge_answers", "points_awarded")
    op.create_check_constraint(
        "ck_flash_answer_outcome",
        "flash_challenge_answers",
        "outcome_status IN ('pending','won','lost','refunded')",
    )

    # -- PointsLedger: new table --
    op.create_table(
        "points_ledger",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("transaction_type", sa.Text(), nullable=False),
        sa.Column("reference_type", sa.Text(), nullable=True),
        sa.Column("reference_id", UUID(as_uuid=True), nullable=True),
        sa.Column("points_delta", sa.Integer(), nullable=False),
        sa.Column("balance_after", sa.Integer(), nullable=False),
        sa.Column("metadata", JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "transaction_type IN ('challenge_entry','challenge_reward','challenge_refund',"
            "'duel_stake','duel_win','duel_refund','admin_adjustment')",
            name="ck_ledger_transaction_type",
        ),
    )


def downgrade() -> None:
    op.drop_table("points_ledger")

    op.drop_constraint("ck_flash_answer_outcome", "flash_challenge_answers", type_="check")
    op.add_column(
        "flash_challenge_answers",
        sa.Column("points_awarded", sa.Integer(), nullable=True),
    )
    op.execute("""
        UPDATE flash_challenge_answers SET points_awarded = reward_points_awarded
        WHERE outcome_status IN ('won', 'lost')
    """)
    op.drop_column("flash_challenge_answers", "outcome_status")
    op.drop_column("flash_challenge_answers", "reward_points_awarded")
    op.drop_column("flash_challenge_answers", "paid_points")

    op.execute("UPDATE flash_challenges SET status = 'open' WHERE status = 'active'")
    op.execute("UPDATE flash_challenges SET status = 'closed' WHERE status = 'locked'")
    op.drop_constraint("ck_flash_status", "flash_challenges", type_="check")
    op.create_check_constraint(
        "ck_flash_status",
        "flash_challenges",
        "status IN ('draft','open','closed','resolved','cancelled')",
    )

    op.add_column(
        "flash_challenges",
        sa.Column("points_value", sa.Integer(), nullable=False, server_default="1"),
    )
    op.execute("UPDATE flash_challenges SET points_value = reward_points")
    op.drop_column("flash_challenges", "reward_points")
    op.drop_column("flash_challenges", "participation_cost")

    op.drop_column("user_profiles", "challenge_points_balance")
