"""Add penalty_rush_scores table

Revision ID: p1e2n3a4l5t6
Revises: j0k1l2m3n4o5
Create Date: 2026-04-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "p1e2n3a4l5t6"
down_revision: Union[str, None] = "j0k1l2m3n4o5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "penalty_rush_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.Integer, nullable=False),
        sa.Column("best_streak", sa.Integer, nullable=False, server_default="0"),
        sa.Column("accuracy_pct", sa.Integer, nullable=False, server_default="0"),
        sa.Column("duration_secs", sa.Integer, nullable=False, server_default="0"),
        sa.Column("level_reached", sa.Integer, nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("score >= 0 AND score < 100000", name="ck_pr_score_range"),
        sa.CheckConstraint("accuracy_pct >= 0 AND accuracy_pct <= 100", name="ck_pr_accuracy"),
        sa.CheckConstraint("duration_secs >= 5", name="ck_pr_min_duration"),
    )
    op.create_index("ix_penalty_rush_scores_user_id", "penalty_rush_scores", ["user_id"])
    op.create_index("ix_penalty_rush_scores_score", "penalty_rush_scores", ["score"])


def downgrade() -> None:
    op.drop_index("ix_penalty_rush_scores_score")
    op.drop_index("ix_penalty_rush_scores_user_id")
    op.drop_table("penalty_rush_scores")
