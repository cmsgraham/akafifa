"""add comment_id to activity_items

Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
Create Date: 2026-04-06 03:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "g7h8i9j0k1l2"
down_revision: Union[str, None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "activity_items",
        sa.Column("comment_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_activity_items_comment_id",
        "activity_items",
        "comments",
        ["comment_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_activity_items_comment_id", "activity_items", type_="foreignkey")
    op.drop_column("activity_items", "comment_id")
