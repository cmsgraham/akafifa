"""in-app notifications table

Revision ID: d4a5b6c7e8f9
Revises: c9f3a2b7d6e8
Create Date: 2026-04-04 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = "d4a5b6c7e8f9"
down_revision: Union[str, None] = "c9f3a2b7d6e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "in_app_notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("priority", sa.Text(), nullable=False, server_default="normal"),
        sa.Column("status", sa.Text(), nullable=False, server_default="unread"),
        sa.Column("actor_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("related_entity_type", sa.Text(), nullable=True),
        sa.Column("related_entity_id", UUID(as_uuid=True), nullable=True),
        sa.Column("action_url", sa.Text(), nullable=True),
        sa.Column("data", JSONB(), nullable=True),
        sa.Column("dedup_key", sa.Text(), nullable=True, index=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "category IN ('social','match','duel','challenge','system')",
            name="ck_inapp_category",
        ),
        sa.CheckConstraint(
            "priority IN ('low','normal','high')",
            name="ck_inapp_priority",
        ),
        sa.CheckConstraint(
            "status IN ('unread','read','archived')",
            name="ck_inapp_status",
        ),
    )
    # Composite index for listing user notifications ordered by recency
    op.create_index("ix_inapp_user_created", "in_app_notifications", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_inapp_user_created", table_name="in_app_notifications")
    op.drop_table("in_app_notifications")
