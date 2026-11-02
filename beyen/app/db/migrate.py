"""
Bring the database schema up to date, then seed it.

    python -m app.db.migrate

Runs before the API starts (see Dockerfile). Databases created by older
versions of COMIS — where the app built the schema itself at startup and there
is no alembic_version table — are first stamped at revision 0001, so the
0002 migration can bring them in line without recreating existing tables.
"""
import os
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from app.db.session import engine, SessionLocal

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def _alembic_config() -> Config:
    cfg = Config(os.path.join(BACKEND_DIR, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(BACKEND_DIR, "alembic"))
    return cfg


def migrate() -> None:
    cfg = _alembic_config()
    tables = set(inspect(engine).get_table_names())
    if "users" in tables and "alembic_version" not in tables:
        print("[MIGRATE] Existing schema without migration history; stamping revision 0001.")
        command.stamp(cfg, "0001")
    command.upgrade(cfg, "head")


def main() -> None:
    migrate()
    from app.db.seed import seed_database
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
