"""add timezone to user_profiles

Revision ID: a1b2c3d4e5f6
Revises: 4f321176957a
Create Date: 2026-04-03 23:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "4f321176957a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_profiles",
        sa.Column("timezone", sa.Text(), nullable=False, server_default="America/Costa_Rica"),
    )


def downgrade() -> None:
    op.drop_column("user_profiles", "timezone")
