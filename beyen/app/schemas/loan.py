from decimal import Decimal
import uuid
from datetime import date, datetime
from typing import List
from pydantic import BaseModel, Field, model_validator


class LoanCreate(BaseModel):
    seller_id: uuid.UUID
    date: date
    loan_taken: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    due_date: date | None = None
    notes: str | None = None


class LoanRepaymentCreate(BaseModel):
    loan_id: uuid.UUID
    date: date
    amount_paid: Decimal = Field(gt=0, max_digits=14, decimal_places=2)


class LoanRepaymentOut(BaseModel):
    id: uuid.UUID
    loan_id: uuid.UUID
    date: date
    amount_paid: float
    recorded_by: uuid.UUID

    class Config:
        from_attributes = True


class LoanOut(BaseModel):
    id: uuid.UUID
    seller_id: uuid.UUID
    date: date
    loan_taken: float
    due_date: date | None
    status: str
    notes: str | None
    created_by: uuid.UUID
    approved_by: uuid.UUID | None
    created_at: datetime
    balance: float = 0.0   # Computed and injected by the endpoint

    class Config:
        from_attributes = True


class LoanWithRepayments(LoanOut):
    """Detail view including full repayment history."""
    repayments: List[LoanRepaymentOut] = []
