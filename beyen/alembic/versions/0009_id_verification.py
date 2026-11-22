"""Market verification: National ID / passport photo with the document number.

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-21
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("id_doc_type", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("id_doc_number", sa.String(40), nullable=True))
    op.add_column("users", sa.Column("id_doc_number_read", sa.String(40), nullable=True))
    op.add_column("users", sa.Column("id_doc_path", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("id_status", sa.String(20), nullable=False, server_default="none"))
    op.add_column("users", sa.Column("id_submitted_at", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("id_reviewed_at", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("id_reviewed_by", sa.Uuid(), nullable=True))
    op.add_column("users", sa.Column("id_reject_reason", sa.String(255), nullable=True))
    op.create_foreign_key("fk_users_id_reviewed_by", "users", "users", ["id_reviewed_by"], ["id"])
    op.create_index("ix_users_id_doc_number", "users", ["id_doc_number"])


def downgrade() -> None:
    op.drop_index("ix_users_id_doc_number", table_name="users")
    op.drop_constraint("fk_users_id_reviewed_by", "users", type_="foreignkey")
    for col in ("id_reject_reason", "id_reviewed_by", "id_reviewed_at", "id_submitted_at",
                "id_status", "id_doc_path", "id_doc_number_read", "id_doc_number", "id_doc_type"):
        op.drop_column("users", col)
