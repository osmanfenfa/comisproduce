"""
Per-company settings lookup.

Prices and station name belong to each company (tenant). The standard moisture
percentage is a platform-wide rule set by the System Admin on the global row.
"""
import uuid
from sqlalchemy.orm import Session
from app.models.settings_model import AppSettings, GLOBAL_SETTINGS_ID
from app.core.config import settings as app_config


def get_global_settings(db: Session) -> AppSettings:
    row = db.query(AppSettings).filter(AppSettings.id == GLOBAL_SETTINGS_ID).first()
    if not row:
        row = AppSettings(
            id=GLOBAL_SETTINGS_ID,
            station_name=app_config.STATION_NAME,
            standard_moisture_percent=app_config.STANDARD_MOISTURE_PERCENT,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def get_tenant_settings(db: Session, produce_id: uuid.UUID) -> AppSettings:
    """The company's own settings row, created from the global defaults on first use."""
    row = db.query(AppSettings).filter(AppSettings.produce_id == produce_id).first()
    if not row:
        defaults = get_global_settings(db)
        row = AppSettings(
            id=str(produce_id),
            produce_id=produce_id,
            station_name=defaults.station_name,
            standard_moisture_percent=defaults.standard_moisture_percent,
            cocoa_price_per_kg=defaults.cocoa_price_per_kg,
            coffee_price_per_kg=defaults.coffee_price_per_kg,
            cola_price_per_kg=defaults.cola_price_per_kg,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def get_standard_moisture_percent(db: Session) -> float:
    return get_global_settings(db).standard_moisture_percent


def tenant_id_of(current: dict) -> uuid.UUID:
    return current.get("produce_id") or current["id"]


def find_settings(db: Session, produce_id: uuid.UUID | None) -> AppSettings | None:
    """Read-only lookup (never writes): the company's row, else the global row."""
    if produce_id:
        row = db.query(AppSettings).filter(AppSettings.produce_id == produce_id).first()
        if row:
            return row
    return db.query(AppSettings).filter(AppSettings.id == GLOBAL_SETTINGS_ID).first()
