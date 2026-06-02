"""activity items table

Revision ID: f6a7b8c9d0e1
Revises: e5b6c7d8f9a0
Create Date: 2026-04-06 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic.
revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5b6c7d8f9a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "activity_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("actor_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), index=True),
        sa.Column("activity_type", sa.Text(), nullable=False, index=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("body", sa.Text()),
        sa.Column("related_entity_type", sa.Text()),
        sa.Column("related_entity_id", UUID(as_uuid=True)),
        sa.Column("visibility", sa.Text(), nullable=False, server_default="all_users"),
        sa.Column("participant1_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("participant2_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("metadata", JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("related_entity_type", "related_entity_id", "activity_type", name="uq_activity_entity"),
        sa.CheckConstraint(
            "visibility IN ('all_users', 'participants_only', 'participants_and_friends')",
            name="ck_activity_visibility",
        ),
    )
    op.create_index("ix_activity_items_created_at", "activity_items", ["created_at"])


def downgrade() -> None:
    op.drop_table("activity_items")
