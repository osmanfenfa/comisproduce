"""Feed phase 3: categories members tick ("What do you buy / sell?") and offer attribution.

Revision ID: 0014
Revises: 0013
Create Date: 2026-11-23
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("market_interests",
                  sa.Column("declared", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("market_offers", sa.Column("was_match", sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column("market_offers", "was_match")
    op.drop_column("market_interests", "declared")
