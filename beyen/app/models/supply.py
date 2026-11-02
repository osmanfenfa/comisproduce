import uuid
from decimal import Decimal
from datetime import date, datetime
from sqlalchemy import ForeignKey, Float, Integer, Date, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base
from app.models.types import Money


class Supply(Base):
    """
    Supply transaction recorded by a Produce Manager when selling aggregated
    produce lot to a buying/export company.
    """
    __tablename__ = "supplies"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    produce_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True, index=True)
    station_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    date: Mapped[date] = mapped_column(Date, default=date.today)

    commodity: Mapped[str] = mapped_column(String(50), default="cocoa")  # cocoa | coffee | cola
    total_kg: Mapped[float] = mapped_column(Float, nullable=False)
    total_bags: Mapped[int] = mapped_column(Integer, nullable=False)
    water_percent: Mapped[float] = mapped_column(Float, nullable=False)

    # Company sold to info
    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    company_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_contact: Mapped[str | None] = mapped_column(String(100), nullable=True)
    witness_name: Mapped[str] = mapped_column(String(150), nullable=False)

    # Optional financials
    price_per_kg: Mapped[Decimal | None] = mapped_column(Money, nullable=True)
    total_value: Mapped[Decimal | None] = mapped_column(Money, nullable=True)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])

