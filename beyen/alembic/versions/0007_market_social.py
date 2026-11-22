"""Market feed: likes, comments and saved posts.

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-21
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _reaction_table(name: str) -> None:
    op.create_table(
        name,
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("listing_id", sa.Uuid(), sa.ForeignKey("market_listings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("listing_id", "user_id", name=f"uq_{name}_listing_user"),
    )
    op.create_index(f"ix_{name}_listing_id", name, ["listing_id"])
    op.create_index(f"ix_{name}_user_id", name, ["user_id"])


def upgrade() -> None:
    _reaction_table("market_likes")
    _reaction_table("market_saves")
    op.create_table(
        "market_comments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("listing_id", sa.Uuid(), sa.ForeignKey("market_listings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("body", sa.String(1000), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    for col in ("listing_id", "user_id", "created_at"):
        op.create_index(f"ix_market_comments_{col}", "market_comments", [col])


def downgrade() -> None:
    op.drop_table("market_comments")
    op.drop_table("market_saves")
    op.drop_table("market_likes")
