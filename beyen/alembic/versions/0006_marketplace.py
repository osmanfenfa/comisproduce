"""Marketplace: farmer/trader accounts, listings with photos/video, offers, reports.

Purely additive: existing station tables and roles are unchanged.

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-21
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MONEY = sa.Numeric(14, 2)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # New enum values must be committed before use, so add them outside the migration transaction
        with op.get_context().autocommit_block():
            op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'farmer'")
            op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'trader'")

    op.add_column("users", sa.Column("district", sa.String(60), nullable=True))
    op.add_column("users", sa.Column("chiefdom", sa.String(120), nullable=True))
    op.add_column("users", sa.Column("phone_verified_at", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("phone_otp_hash", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("phone_otp_expires_at", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("phone_otp_attempts", sa.Integer(), nullable=False, server_default="0"))

    op.create_table(
        "market_listings",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("owner_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("kind", sa.Enum("sell", "wanted", name="listingkind"), nullable=False),
        sa.Column("category", sa.String(40), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("quantity", sa.Float(), nullable=True),
        sa.Column("unit", sa.String(20), nullable=False),
        sa.Column("price", MONEY, nullable=True),
        sa.Column("negotiable", sa.Boolean(), nullable=False),
        sa.Column("district", sa.String(60), nullable=False),
        sa.Column("chiefdom", sa.String(120), nullable=True),
        sa.Column("available_from", sa.Date(), nullable=True),
        sa.Column("status", sa.Enum("active", "sold", "closed", "removed", name="listingstatus"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    for col in ("owner_id", "category", "district", "status", "created_at"):
        op.create_index(f"ix_market_listings_{col}", "market_listings", [col])

    op.create_table(
        "market_listing_media",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("listing_id", sa.Uuid(), sa.ForeignKey("market_listings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("path", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(60), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_market_listing_media_listing_id", "market_listing_media", ["listing_id"])

    op.create_table(
        "market_offers",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("listing_id", sa.Uuid(), sa.ForeignKey("market_listings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=True),
        sa.Column("price", MONEY, nullable=True),
        sa.Column("message", sa.String(500), nullable=True),
        sa.Column("status", sa.Enum("pending", "accepted", "declined", "cancelled", name="offerstatus"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("responded_at", sa.DateTime(), nullable=True),
    )
    for col in ("listing_id", "from_user_id", "status"):
        op.create_index(f"ix_market_offers_{col}", "market_offers", [col])

    op.create_table(
        "market_reports",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("listing_id", sa.Uuid(), sa.ForeignKey("market_listings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reporter_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reason", sa.String(500), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("resolved_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
    )
    op.create_index("ix_market_reports_listing_id", "market_reports", ["listing_id"])
    op.create_index("ix_market_reports_status", "market_reports", ["status"])


def downgrade() -> None:
    op.drop_table("market_reports")
    op.drop_table("market_offers")
    op.drop_table("market_listing_media")
    op.drop_table("market_listings")
    for name in ("offerstatus", "listingstatus", "listingkind"):
        sa.Enum(name=name).drop(op.get_bind(), checkfirst=True)
    for col in ("phone_otp_attempts", "phone_otp_expires_at", "phone_otp_hash",
                "phone_verified_at", "chiefdom", "district"):
        op.drop_column("users", col)
    # Postgres can't drop enum values; 'farmer'/'trader' stay in userrole (harmless).
