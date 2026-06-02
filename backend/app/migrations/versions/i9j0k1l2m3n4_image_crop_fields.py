"""Add avatar_crop and cover_crop to user_profiles

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-04-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "i9j0k1l2m3n4"
down_revision: str = "h8i9j0k1l2m3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_profiles", sa.Column("avatar_crop", sa.Text(), nullable=True))
    op.add_column("user_profiles", sa.Column("cover_crop", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("user_profiles", "cover_crop")
    op.drop_column("user_profiles", "avatar_crop")
