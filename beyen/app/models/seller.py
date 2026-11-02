import uuid
from datetime import date
from sqlalchemy import String, Date, Enum, ForeignKey, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base
import enum


class GenderEnum(str, enum.Enum):
    male = "male"
    female = "female"
    other = "other"


class Seller(Base):
    __tablename__ = "sellers"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    seller_id: Mapped[str] = mapped_column(String(20), unique=True, nullable=True)  # human-readable e.g. SL-000001
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    gender: Mapped[GenderEnum] = mapped_column(Enum(GenderEnum), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    contact: Mapped[str] = mapped_column(String(30), nullable=True)
    # Location, for traceability (Sierra Leone: District > Chiefdom > Section)
    section: Mapped[str | None] = mapped_column(String(120), nullable=True)
    chiefdom: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    district: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    photo_path: Mapped[str] = mapped_column(String(255), nullable=True)
    date_registered: Mapped[date] = mapped_column(Date, default=date.today)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_random: Mapped[bool] = mapped_column(Boolean, default=False, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    produce_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True, index=True)

    cocoa_transactions = relationship("CocoaTransaction", back_populates="seller")
    coffee_transactions = relationship("CoffeeTransaction", back_populates="seller")
    cola_transactions = relationship("ColaTransaction", back_populates="seller")
    loans = relationship("Loan", back_populates="seller")
