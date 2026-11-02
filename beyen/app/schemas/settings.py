import uuid
from decimal import Decimal
from pydantic import BaseModel, Field


class SettingsOut(BaseModel):
    id: str
    produce_id: uuid.UUID | None = None   # None = the global (System Admin) row
    station_name: str
    standard_moisture_percent: float      # Always the platform-wide value
    cocoa_price_per_kg: float
    coffee_price_per_kg: float
    cola_price_per_kg: float

    class Config:
        from_attributes = True


class SettingsUpdate(BaseModel):
    """
    Manager: updates their own company's prices and station name.
    Admin: updates the global row — the standard moisture % for everyone, plus the
    default prices / station name that new companies start with.
    The endpoint enforces this distinction server-side.
    """
    station_name: str | None = None
    standard_moisture_percent: float | None = Field(default=None, ge=0, le=100)  # Admin only
    cocoa_price_per_kg: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    coffee_price_per_kg: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    cola_price_per_kg: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
