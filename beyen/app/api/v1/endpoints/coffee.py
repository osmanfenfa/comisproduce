"""
Coffee purchases — direct weight x price, no moisture deduction. Receipt prefix: COF-
Workflow, permissions and sync rules live in produce.py.
"""
from sqlalchemy.orm import Session
from app.api.v1.endpoints.produce import CommoditySpec, build_router
from app.models.coffee import CoffeeTransaction
from app.schemas.coffee import CoffeeTransactionCreate, CoffeeTransactionEdit, CoffeeTransactionOut, RejectPayload
from app.services.pricing import calculate_direct_price


def price_coffee(payload, db: Session) -> dict:
    return {
        "water_percent": payload.water_percent or 0.0,   # recorded for information only
        "standard_percent": 0.0,
        "net_weight_kg": payload.weight_kg,
        "total_price": calculate_direct_price(payload.weight_kg, payload.price_per_kg),
    }


SPEC = CommoditySpec(
    name="coffee",
    receipt_prefix="COF",
    model=CoffeeTransaction,
    create_schema=CoffeeTransactionCreate,
    edit_schema=CoffeeTransactionEdit,
    out_schema=CoffeeTransactionOut,
    reject_schema=RejectPayload,
    price=price_coffee,
)

router = build_router(SPEC)
