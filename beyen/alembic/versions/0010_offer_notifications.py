"""Market notifications: remember when an offer's sender saw the accept/decline.

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-21
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("market_offers", sa.Column("response_seen_at", sa.DateTime(), nullable=True))
    # Existing answers count as already seen, so nobody gets a burst of old notifications
    op.execute("UPDATE market_offers SET response_seen_at = responded_at WHERE responded_at IS NOT NULL")


def downgrade() -> None:
    op.drop_column("market_offers", "response_seen_at")
