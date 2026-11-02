import uuid
from decimal import Decimal
from datetime import date, datetime
from sqlalchemy import ForeignKey, Float, Date, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base
from app.models.types import Money


class Loan(Base):
    __tablename__ = "loans"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    seller_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sellers.id"))
    date: Mapped[date] = mapped_column(Date, default=date.today)
    loan_taken: Mapped[Decimal] = mapped_column(Money, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | cleared | overdue
    notes: Mapped[str] = mapped_column(String(255), nullable=True)

    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))       # Manager/Admin only
    produce_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True, index=True)
    approved_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    seller = relationship("Seller", back_populates="loans")
    repayments = relationship("LoanRepayment", back_populates="loan")


class LoanRepayment(Base):
    __tablename__ = "loan_repayments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    loan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("loans.id"))
    date: Mapped[date] = mapped_column(Date, default=date.today)
    amount_paid: Mapped[Decimal] = mapped_column(Money, nullable=False)
    recorded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))

    loan = relationship("Loan", back_populates="repayments")
