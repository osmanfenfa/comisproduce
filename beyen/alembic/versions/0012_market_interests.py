"""Feed personalisation: what each member buys or sells, per category.

Revision ID: 0012
Revises: 0011
Create Date: 2026-11-22

Seeds the table from existing activity so the "For you" feed works from day one.
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "market_interests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(40), nullable=False),
        sa.Column("side", sa.String(10), nullable=False),
        sa.Column("score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "category", "side", name="uq_market_interests_user_cat_side"),
    )
    op.create_index("ix_market_interests_user_id", "market_interests", ["user_id"])
    op.create_index("ix_market_interests_category", "market_interests", ["category"])

    # Backfill from what people already did (same points as services/interests.py)
    from app.services.interests import backfill
    backfill(op.get_bind())


def downgrade() -> None:
    op.drop_index("ix_market_interests_category", table_name="market_interests")
    op.drop_index("ix_market_interests_user_id", table_name="market_interests")
    op.drop_table("market_interests")
