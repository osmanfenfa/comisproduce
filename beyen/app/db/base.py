from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models here so Alembic can detect them for migrations
from app.models import user, seller, cocoa, coffee, cola, loan, settings_model, audit_log, receipt, supply, market  # noqa
