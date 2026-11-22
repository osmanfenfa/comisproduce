"""Alerts: tell members when a new post matches what they need or sell.

Revision ID: 0013
Revises: 0012
Create Date: 2026-11-22
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "market_alerts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("listing_id", sa.Uuid(), sa.ForeignKey("market_listings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("side", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("seen_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("user_id", "listing_id", name="uq_market_alerts_user_listing"),
    )
    op.create_index("ix_market_alerts_user_id", "market_alerts", ["user_id"])
    op.create_index("ix_market_alerts_listing_id", "market_alerts", ["listing_id"])
    op.create_index("ix_market_alerts_created_at", "market_alerts", ["created_at"])


def downgrade() -> None:
    op.drop_table("market_alerts")
