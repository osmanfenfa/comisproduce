import uuid
from decimal import Decimal
from sqlalchemy import String, Float
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base
from app.models.types import Money

GLOBAL_SETTINGS_ID = "singleton"


class AppSettings(Base):
    """Settings rows. Access via app/services/settings_service.py — never hard-coded in config.

    - The global row (id = "singleton", produce_id NULL) is owned by the System Admin.
      It holds the platform-wide standard moisture % and the default prices and
      station name that new companies start with.
    - Each company (produce_id = the Manager's tenant id) gets its own row with its
      own prices and station name. Its standard_moisture_percent column is unused:
      the moisture standard always comes from the global row.
    """
    __tablename__ = "app_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=GLOBAL_SETTINGS_ID)
    produce_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True, unique=True, index=True)
    station_name: Mapped[str] = mapped_column(String(120), default="COMIS Buying Station")
    standard_moisture_percent: Mapped[float] = mapped_column(Float, default=7.0)
    cocoa_price_per_kg: Mapped[Decimal] = mapped_column(Money, default=Decimal("0.00"))
    coffee_price_per_kg: Mapped[Decimal] = mapped_column(Money, default=Decimal("0.00"))
    cola_price_per_kg: Mapped[Decimal] = mapped_column(Money, default=Decimal("0.00"))
