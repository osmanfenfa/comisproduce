import uuid
from decimal import Decimal
from datetime import date, datetime
from sqlalchemy import ForeignKey, Float, Integer, Date, DateTime, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base
from app.models.types import Money
from app.models.transaction_status import TransactionStatus


class ColaTransaction(Base):
    """Direct weight x price pricing model - no moisture deduction."""
    __tablename__ = "cola_transactions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    seller_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sellers.id"))
    date: Mapped[date] = mapped_column(Date, default=date.today)
    weight_kg: Mapped[float] = mapped_column(Float, nullable=False)
    bags: Mapped[int | None] = mapped_column(Integer, nullable=True, default=1)
    price_per_kg: Mapped[Decimal] = mapped_column(Money, nullable=False)
    total_price: Mapped[Decimal] = mapped_column(Money, nullable=False)  # editable/manual override allowed

    status: Mapped[TransactionStatus] = mapped_column(Enum(TransactionStatus), default=TransactionStatus.pending)
    rejection_reason: Mapped[str] = mapped_column(String(255), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    produce_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True, index=True)
    station_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    reviewed_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Secretary purchases stay private to the station until the end-of-day sync.
    # NULL = not yet synced (invisible to the Manager). Manager-recorded purchases are synced on creation.
    synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    synced_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    # Device-generated id for purchases recorded offline: re-sending the same purchase is a no-op
    client_ref: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)

    seller = relationship("Seller", back_populates="cola_transactions")

    @property
    def seller_name(self) -> str | None:
        return self.seller.name if self.seller else None

    @property
    def seller_contact(self) -> str | None:
        return self.seller.contact if self.seller else None

    @property
    def seller_code(self) -> str | None:
        return self.seller.seller_id if self.seller else None

    @property
    def is_random_seller(self) -> bool:
        return getattr(self.seller, "is_random", False) if self.seller else False
