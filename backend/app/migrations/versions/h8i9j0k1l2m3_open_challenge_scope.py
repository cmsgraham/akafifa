"""Add 'open' to flash_challenges scope check constraint

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-04-07
"""
from typing import Sequence, Union

from alembic import op

revision: str = "h8i9j0k1l2m3"
down_revision: str = "g7h8i9j0k1l2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_flash_scope", "flash_challenges", type_="check")
    op.create_check_constraint(
        "ck_flash_scope",
        "flash_challenges",
        "scope IN ('match', 'stage', 'open')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_flash_scope", "flash_challenges", type_="check")
    op.create_check_constraint(
        "ck_flash_scope",
        "flash_challenges",
        "scope IN ('match', 'stage')",
    )
