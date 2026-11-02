"""
Cocoa purchases — moisture-deduction pricing. Receipt prefix: COC-
Workflow, permissions and sync rules live in produce.py.
"""
from sqlalchemy.orm import Session
from app.api.v1.endpoints.produce import CommoditySpec, build_router
from app.models.cocoa import CocoaTransaction
from app.schemas.cocoa import CocoaTransactionCreate, CocoaTransactionEdit, CocoaTransactionOut, RejectPayload
from app.services.pricing import calculate_moisture_deduction_price
from app.services.settings_service import get_standard_moisture_percent


def price_cocoa(payload, db: Session) -> dict:
    """Standard moisture % is always read from the DB (the admin can change it at runtime)."""
    standard_percent = get_standard_moisture_percent(db)
    result = calculate_moisture_deduction_price(
        weight_kg=payload.weight_kg,
        water_percent=payload.water_percent,
        standard_percent=standard_percent,
        price_per_kg=payload.price_per_kg,
    )
    return {
        "water_percent": payload.water_percent,
        "standard_percent": standard_percent,
        "net_weight_kg": result["net_weight_kg"],
        "total_price": result["total_price"],
    }


SPEC = CommoditySpec(
    name="cocoa",
    receipt_prefix="COC",
    model=CocoaTransaction,
    create_schema=CocoaTransactionCreate,
    edit_schema=CocoaTransactionEdit,
    out_schema=CocoaTransactionOut,
    reject_schema=RejectPayload,
    price=price_cocoa,
)

router = build_router(SPEC)
