from decimal import Decimal
import uuid
from datetime import date, datetime
from pydantic import BaseModel, Field
from app.models.transaction_status import TransactionStatus


class CoffeeTransactionCreate(BaseModel):
    seller_id: uuid.UUID | None = None
    random_seller_name: str | None = None
    random_seller_contact: str | None = None
    client_ref: str | None = Field(default=None, max_length=64)   # set by the offline queue
    date: date
    weight_kg: float = Field(gt=0)
    bags: int | None = Field(default=1, ge=0)
    price_per_kg: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    water_percent: float | None = Field(default=0.0, ge=0, le=100)


class CoffeeTransactionEdit(BaseModel):
    """Used to correct a REJECTED or PENDING transaction before (re)submitting."""
    weight_kg: float = Field(gt=0)
    bags: int | None = Field(default=1, ge=0)
    price_per_kg: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    water_percent: float | None = Field(default=0.0, ge=0, le=100)


class RejectPayload(BaseModel):
    reason: str


class CoffeeTransactionOut(BaseModel):
    id: uuid.UUID
    seller_id: uuid.UUID
    date: date
    weight_kg: float
    bags: int | None = 1
    price_per_kg: float
    total_price: float
    water_percent: float | None = 0.0
    standard_percent: float | None = 0.0
    net_weight_kg: float | None = None
    status: TransactionStatus
    rejection_reason: str | None
    created_by: uuid.UUID
    reviewed_by: uuid.UUID | None
    approved_at: datetime | None
    created_at: datetime
    # Seller info
    seller_name: str | None = None
    seller_contact: str | None = None
    seller_code: str | None = None
    is_random_seller: bool = False
    produce_id: uuid.UUID | None = None
    station_name: str | None = None
    synced_at: datetime | None = None   # None = still at the station (not yet synced)

    class Config:
        from_attributes = True
