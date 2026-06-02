"""user follows table

Revision ID: e5b6c7d8f9a0
Revises: d4a5b6c7e8f9
Create Date: 2026-04-04 18:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "e5b6c7d8f9a0"
down_revision: Union[str, None] = "d4a5b6c7e8f9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_follows",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("follower_id", UUID(as_uuid=True), nullable=False),
        sa.Column("followed_id", UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["follower_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["followed_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("follower_id", "followed_id", name="uq_user_follows_pair"),
    )
    op.create_index("ix_user_follows_follower_id", "user_follows", ["follower_id"])
    op.create_index("ix_user_follows_followed_id", "user_follows", ["followed_id"])


def downgrade() -> None:
    op.drop_index("ix_user_follows_followed_id")
    op.drop_index("ix_user_follows_follower_id")
    op.drop_table("user_follows")
