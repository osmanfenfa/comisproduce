"""Bring schema up to the current models: tenancy columns, supplies, bags,
receipt snapshots, per-company settings, exact money columns, reset-attempt counter.

Written to be safe on both kinds of existing database:
  - fresh databases created by 0001, and
  - older deployments whose schema was built by the app at startup
    (create_all + ad-hoc ALTERs) and then stamped at 0001 by app/db/migrate.py.
Every step therefore checks what already exists before changing it.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-02
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MONEY = sa.Numeric(14, 2)

# (table, column, type) — added when missing
NEW_COLUMNS = [
    ("users", "business_name", sa.String(150)),
    ("users", "address", sa.String(255)),
    ("users", "email", sa.String(120)),
    ("users", "phone_number", sa.String(50)),
    ("users", "gender", sa.String(20)),
    ("users", "reset_password_token", sa.String(255)),
    ("users", "reset_password_expires_at", sa.DateTime()),
    ("users", "google_id", sa.String(255)),
    ("users", "produce_id", sa.Uuid()),

    ("sellers", "is_random", sa.Boolean()),
    ("sellers", "produce_id", sa.Uuid()),

    ("cocoa_transactions", "produce_id", sa.Uuid()),
    ("cocoa_transactions", "station_name", sa.String(120)),
    ("cocoa_transactions", "bags", sa.Integer()),
    ("coffee_transactions", "produce_id", sa.Uuid()),
    ("coffee_transactions", "station_name", sa.String(120)),
    ("coffee_transactions", "bags", sa.Integer()),
    ("cola_transactions", "produce_id", sa.Uuid()),
    ("cola_transactions", "station_name", sa.String(120)),
    ("cola_transactions", "bags", sa.Integer()),

    ("receipts", "produce_id", sa.Uuid()),
    ("receipts", "station_name", sa.String(120)),
    ("receipts", "business_name", sa.String(120)),
    ("receipts", "business_address", sa.String(255)),
    ("receipts", "business_phone", sa.String(50)),
    ("receipts", "weight_kg", sa.Float()),
    ("receipts", "bags", sa.Integer()),
    ("receipts", "water_percent", sa.Float()),
    ("receipts", "standard_percent", sa.Float()),
    ("receipts", "net_weight_kg", sa.Float()),
    ("receipts", "price_per_kg", MONEY),
    ("receipts", "seller_name_snapshot", sa.String(120)),
    ("receipts", "seller_contact_snapshot", sa.String(50)),
    ("receipts", "recorded_by_name", sa.String(120)),
    ("receipts", "issued_by_name", sa.String(120)),

    ("loans", "produce_id", sa.Uuid()),
    ("audit_logs", "produce_id", sa.Uuid()),
    ("app_settings", "produce_id", sa.Uuid()),
]

# Float -> NUMERIC(14,2), rounded half-up to cents
MONEY_COLUMNS = [
    ("cocoa_transactions", "price_per_kg"), ("cocoa_transactions", "total_price"),
    ("coffee_transactions", "price_per_kg"), ("coffee_transactions", "total_price"),
    ("cola_transactions", "price_per_kg"), ("cola_transactions", "total_price"),
    ("receipts", "gross_amount"), ("receipts", "loan_deduction"),
    ("receipts", "net_amount_paid"), ("receipts", "price_per_kg"),
    ("loans", "loan_taken"), ("loan_repayments", "amount_paid"),
    ("supplies", "price_per_kg"), ("supplies", "total_value"),
    ("app_settings", "cocoa_price_per_kg"), ("app_settings", "coffee_price_per_kg"),
    ("app_settings", "cola_price_per_kg"),
]

PRODUCE_ID_INDEXED = ["users", "sellers", "cocoa_transactions", "coffee_transactions",
                      "cola_transactions", "receipts", "loans", "audit_logs", "supplies"]


def _columns(bind, table):
    return {c["name"]: c for c in sa.inspect(bind).get_columns(table)}


def _indexes(bind, table):
    insp = sa.inspect(bind)
    names = {i["name"] for i in insp.get_indexes(table)}
    names |= {u["name"] for u in insp.get_unique_constraints(table)}
    return names


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # --- supplies (never created by 0001) ---
    if not sa.inspect(bind).has_table("supplies"):
        op.create_table(
            "supplies",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("produce_id", sa.Uuid(), nullable=True),
            sa.Column("station_name", sa.String(120), nullable=True),
            sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("date", sa.Date()),
            sa.Column("commodity", sa.String(50)),
            sa.Column("total_kg", sa.Float(), nullable=False),
            sa.Column("total_bags", sa.Integer(), nullable=False),
            sa.Column("water_percent", sa.Float(), nullable=False),
            sa.Column("company_name", sa.String(200), nullable=False),
            sa.Column("company_address", sa.String(255), nullable=True),
            sa.Column("company_contact", sa.String(100), nullable=True),
            sa.Column("witness_name", sa.String(150), nullable=False),
            sa.Column("price_per_kg", MONEY, nullable=True),
            sa.Column("total_value", MONEY, nullable=True),
            sa.Column("notes", sa.String(255), nullable=True),
            sa.Column("created_at", sa.DateTime()),
        )

    # --- missing columns ---
    for table, column, type_ in NEW_COLUMNS:
        if column not in _columns(bind, table):
            op.add_column(table, sa.Column(column, type_, nullable=True))

    if "reset_password_attempts" not in _columns(bind, "users"):
        op.add_column("users", sa.Column("reset_password_attempts", sa.Integer(),
                                         nullable=False, server_default="0"))

    for table in ("cocoa_transactions", "coffee_transactions", "cola_transactions", "receipts"):
        op.execute(f"UPDATE {table} SET bags = 1 WHERE bags IS NULL")
    op.execute("UPDATE sellers SET is_random = FALSE WHERE is_random IS NULL")

    # Coffee has no moisture deduction any more
    cols = _columns(bind, "coffee_transactions")
    for column in ("water_percent", "standard_percent"):
        if not cols[column]["nullable"]:
            op.alter_column("coffee_transactions", column, existing_type=sa.Float(), nullable=True)

    # --- money: Float -> NUMERIC(14,2) ---
    if is_pg:
        for table, column in MONEY_COLUMNS:
            current = _columns(bind, table)[column]["type"]
            if not isinstance(current, sa.Numeric) or isinstance(current, sa.Float):
                op.execute(
                    f"ALTER TABLE {table} ALTER COLUMN {column} TYPE NUMERIC(14,2) "
                    f"USING ROUND({column}::numeric, 2)"
                )

    # --- per-company settings: widen id to hold a UUID, one row per produce_id ---
    if is_pg:
        op.alter_column("app_settings", "id", existing_type=sa.String(10), type_=sa.String(36))
    if "ix_app_settings_produce_id" not in _indexes(bind, "app_settings"):
        op.create_index("ix_app_settings_produce_id", "app_settings", ["produce_id"], unique=True)

    # --- indexes / uniqueness the models declare ---
    for table in PRODUCE_ID_INDEXED:
        name = f"ix_{table}_produce_id"
        if name not in _indexes(bind, table):
            op.create_index(name, table, ["produce_id"])

    user_indexes = _indexes(bind, "users")
    if "ix_users_reset_password_token" not in user_indexes:
        op.create_index("ix_users_reset_password_token", "users", ["reset_password_token"])
    if is_pg:
        op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users (lower(email)) WHERE email IS NOT NULL")
        op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_google_id ON users (google_id) WHERE google_id IS NOT NULL")

    # --- backfill tenant ids for rows created before multi-tenancy ---
    op.execute("UPDATE users SET produce_id = id WHERE role = 'produce_manager' AND produce_id IS NULL")
    op.execute(
        "UPDATE users SET produce_id = created_by "
        "WHERE role = 'produce_secretary' AND produce_id IS NULL AND created_by IS NOT NULL"
    )

    # Old reset tokens were stored in plain text; the new code only accepts hashes
    op.execute("UPDATE users SET reset_password_token = NULL, reset_password_expires_at = NULL")


def downgrade() -> None:
    # Data-preserving downgrade isn't meaningful for this consolidation step
    # (it absorbs schema that older app versions created at runtime).
    op.drop_column("users", "reset_password_attempts")
    op.drop_index("ix_app_settings_produce_id", table_name="app_settings")
