"""
Cola nut purchases — direct weight x price, with an optional manual total override.
Receipt prefix: COL-. Workflow, permissions and sync rules live in produce.py.
"""
from sqlalchemy.orm import Session
from app.api.v1.endpoints.produce import CommoditySpec, build_router
from app.models.cola import ColaTransaction
from app.schemas.cola import ColaTransactionCreate, ColaTransactionEdit, ColaTransactionOut, RejectPayload
from app.services.pricing import calculate_direct_price, to_money


def price_cola(payload, db: Session) -> dict:
    if payload.manual_total_override is not None:
        if payload.manual_total_override <= 0:
            raise ValueError("Manual total override must be positive.")
        return {"total_price": to_money(payload.manual_total_override)}
    return {"total_price": calculate_direct_price(payload.weight_kg, payload.price_per_kg)}


SPEC = CommoditySpec(
    name="cola",
    receipt_prefix="COL",
    model=ColaTransaction,
    create_schema=ColaTransactionCreate,
    edit_schema=ColaTransactionEdit,
    out_schema=ColaTransactionOut,
    reject_schema=RejectPayload,
    price=price_cola,
)

router = build_router(SPEC)
