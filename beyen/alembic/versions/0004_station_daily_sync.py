"""Station daily sync: secretary purchases/receipts are hidden from the Manager until synced.

Existing rows are marked as already synced so nothing disappears from managers' views.

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-02
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TXN_TABLES = ("cocoa_transactions", "coffee_transactions", "cola_transactions")


def upgrade() -> None:
    for table in TXN_TABLES:
        op.add_column(table, sa.Column("synced_at", sa.DateTime(), nullable=True))
        op.add_column(table, sa.Column("synced_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True))
        op.create_index(f"ix_{table}_synced_at", table, ["synced_at"])
        op.execute(f"UPDATE {table} SET synced_at = COALESCE(created_at, CURRENT_TIMESTAMP)")
    op.add_column("receipts", sa.Column("synced_at", sa.DateTime(), nullable=True))
    op.create_index("ix_receipts_synced_at", "receipts", ["synced_at"])
    op.execute("UPDATE receipts SET synced_at = COALESCE(issued_at, CURRENT_TIMESTAMP)")


def downgrade() -> None:
    op.drop_index("ix_receipts_synced_at", table_name="receipts")
    op.drop_column("receipts", "synced_at")
    for table in TXN_TABLES:
        op.drop_index(f"ix_{table}_synced_at", table_name=table)
        op.drop_column(table, "synced_by")
        op.drop_column(table, "synced_at")
