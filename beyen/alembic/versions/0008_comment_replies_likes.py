"""Market comments: replies (one level) and comment likes.

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-21
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("market_comments", sa.Column("parent_id", sa.Uuid(), nullable=True))
    op.create_foreign_key("fk_market_comments_parent_id", "market_comments", "market_comments",
                          ["parent_id"], ["id"], ondelete="CASCADE")
    op.create_index("ix_market_comments_parent_id", "market_comments", ["parent_id"])

    op.create_table(
        "market_comment_likes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("comment_id", sa.Uuid(), sa.ForeignKey("market_comments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("comment_id", "user_id", name="uq_market_comment_likes_comment_user"),
    )
    op.create_index("ix_market_comment_likes_comment_id", "market_comment_likes", ["comment_id"])
    op.create_index("ix_market_comment_likes_user_id", "market_comment_likes", ["user_id"])


def downgrade() -> None:
    op.drop_table("market_comment_likes")
    op.drop_index("ix_market_comments_parent_id", table_name="market_comments")
    op.drop_constraint("fk_market_comments_parent_id", "market_comments", type_="foreignkey")
    op.drop_column("market_comments", "parent_id")
