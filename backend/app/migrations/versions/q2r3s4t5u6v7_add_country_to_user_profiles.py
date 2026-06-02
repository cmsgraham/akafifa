"""add country to user_profiles

Revision ID: q2r3s4t5u6v7
Revises: p1e2n3a4l5t6
Create Date: 2026-05-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "q2r3s4t5u6v7"
down_revision: Union[str, None] = "p1e2n3a4l5t6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_profiles",
        sa.Column("country", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_profiles", "country")
