"""Seller location for traceability: section, chiefdom, district.

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-02
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    existing = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("sellers")}
    for column in ("section", "chiefdom", "district"):
        if column not in existing:
            op.add_column("sellers", sa.Column(column, sa.String(120), nullable=True))
    op.create_index("ix_sellers_chiefdom", "sellers", ["chiefdom"])
    op.create_index("ix_sellers_district", "sellers", ["district"])


def downgrade() -> None:
    op.drop_index("ix_sellers_district", table_name="sellers")
    op.drop_index("ix_sellers_chiefdom", table_name="sellers")
    for column in ("district", "chiefdom", "section"):
        op.drop_column("sellers", column)
