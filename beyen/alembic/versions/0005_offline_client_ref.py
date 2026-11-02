"""Offline purchases: device-generated client_ref so a retried upload isn't recorded twice.

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-02
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TXN_TABLES = ("cocoa_transactions", "coffee_transactions", "cola_transactions")


def upgrade() -> None:
    for table in TXN_TABLES:
        op.add_column(table, sa.Column("client_ref", sa.String(64), nullable=True))
        op.create_unique_constraint(f"uq_{table}_client_ref", table, ["client_ref"])


def downgrade() -> None:
    for table in TXN_TABLES:
        op.drop_constraint(f"uq_{table}_client_ref", table, type_="unique")
        op.drop_column(table, "client_ref")
