import uuid
from datetime import datetime
from pydantic import BaseModel


class ReceiptOut(BaseModel):
    """Full receipt as per spec section 11."""
    id: uuid.UUID
    receipt_number: str
    transaction_type: str          # cocoa | coffee | cola
    transaction_id: uuid.UUID
    seller_id: uuid.UUID

    # Financial breakdown
    gross_amount: float
    loan_deduction: float
    net_amount_paid: float

    # Attribution
    recorded_by: uuid.UUID | None  # Secretary who created the purchase
    issued_by: uuid.UUID           # Manager who issued the receipt
    issued_at: datetime

    is_admin_override: bool
    synced_at: datetime | None = None

    # Produce Account / Station Details
    produce_id: uuid.UUID | None = None
    station_name: str | None = None
    business_name: str | None = None
    business_address: str | None = None
    business_phone: str | None = None

    # Seller Details (for random seller, name & number saved; for registered, member info)
    seller_name: str | None = None
    seller_contact: str | None = None
    seller_code: str | None = None
    is_random_seller: bool = False
    seller_address: str | None = None
    seller_section: str | None = None
    seller_chiefdom: str | None = None
    seller_district: str | None = None

    # Detail of Item (Produce scale weight, moisture %, deductions, price, bags)
    weight_kg: float | None = None
    bags: int | None = None
    water_percent: float | None = None
    standard_percent: float | None = None
    moisture_deduction_kg: float | None = None
    net_weight_kg: float | None = None
    price_per_kg: float | None = None

    # Staff Names
    recorded_by_name: str | None = None
    issued_by_name: str | None = None

    class Config:
        from_attributes = True
