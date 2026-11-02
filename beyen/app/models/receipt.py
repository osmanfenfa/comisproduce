import uuid
from decimal import Decimal
from datetime import datetime
from sqlalchemy import String, Float, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base
from app.models.types import Money


class Receipt(Base):
    __tablename__ = "receipts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    receipt_number: Mapped[str] = mapped_column(String(30), unique=True)
    transaction_type: Mapped[str] = mapped_column(String(20))   # "cocoa" | "coffee" | "cola"
    transaction_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    seller_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sellers.id"))

    # Financial fields (spec section 11)
    gross_amount: Mapped[Decimal] = mapped_column(Money, nullable=False)
    loan_deduction: Mapped[Decimal] = mapped_column(Money, default=Decimal("0.00"), nullable=True)
    net_amount_paid: Mapped[Decimal] = mapped_column(Money, nullable=False)

    # Who did what (spec section 11: recorded_by = Secretary, issued_by = Manager)
    recorded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    issued_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    produce_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True, index=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Produce Account / Station Snapshot
    station_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    business_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    business_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    business_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Item Details Snapshot
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    bags: Mapped[int | None] = mapped_column(Integer, nullable=True, default=1)
    water_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    standard_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    net_weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_per_kg: Mapped[Decimal | None] = mapped_column(Money, nullable=True)

    # Seller Snapshot (name and number saved, especially for random sellers)
    seller_name_snapshot: Mapped[str | None] = mapped_column(String(120), nullable=True)
    seller_contact_snapshot: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Staff Attribution Names
    recorded_by_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    issued_by_name: Mapped[str | None] = mapped_column(String(120), nullable=True)

    # Admin emergency override tracking (spec section 5)
    is_admin_override: Mapped[bool] = mapped_column(Boolean, default=False)

    # Mirrors the transaction: receipts issued at a station are hidden from the Manager until synced
    synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)

    from sqlalchemy.orm import relationship
    seller = relationship("Seller")
