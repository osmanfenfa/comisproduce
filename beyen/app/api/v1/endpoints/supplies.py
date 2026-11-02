import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.permissions import require_role
from app.models.user import UserRole, User
from app.models.supply import Supply
from app.schemas.supply import SupplyCreate, SupplyOut
from app.services.audit import log_action
from app.services.pricing import calculate_direct_price

router = APIRouter()

MANAGER_ONLY = require_role(UserRole.produce_manager)
MANAGER_OR_STAFF = require_role(UserRole.produce_manager, UserRole.produce_secretary)


@router.post("/", response_model=SupplyOut, status_code=201)
def record_produce_supply(
    payload: SupplyCreate,
    db: Session = Depends(get_db),
    current=Depends(MANAGER_ONLY),
):
    """
    Produce Manager records when supplying/selling aggregated produce to a company.
    """
    tenant_produce_id = current.get("produce_id") or current["id"]
    user_row = db.query(User).filter(User.id == current["id"]).first()
    st_name = (
        current.get("station_name")
        or (user_row.station_name if user_row else None)
        or (user_row.business_name if user_row else None)
        or "COMIS Station"
    )

    supply = Supply(
        produce_id=tenant_produce_id,
        station_name=st_name,
        created_by=current["id"],
        date=payload.date or None,
        commodity=payload.commodity.lower(),
        total_kg=payload.total_kg,
        total_bags=payload.total_bags,
        water_percent=payload.water_percent,
        company_name=payload.company_name.strip(),
        company_address=payload.company_address.strip() if payload.company_address else None,
        company_contact=payload.company_contact.strip() if payload.company_contact else None,
        witness_name=payload.witness_name.strip(),
        price_per_kg=payload.price_per_kg,
        total_value=payload.total_value or (calculate_direct_price(payload.total_kg, payload.price_per_kg) if payload.price_per_kg else None),
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(supply)
    db.commit()
    db.refresh(supply)

    log_action(
        db,
        user_id=current["id"],
        user_role=current["role"],
        action="supply_created",
        entity_type="Supply",
        entity_id=supply.id,
        new_value={
            "commodity": supply.commodity,
            "total_kg": supply.total_kg,
            "total_bags": supply.total_bags,
            "company_name": supply.company_name,
        },
        produce_id=tenant_produce_id,
    )

    out = SupplyOut.model_validate(supply)
    out.creator_name = user_row.name if user_row else None
    return out


@router.get("/", response_model=List[SupplyOut])
def list_produce_supplies(
    commodity: str | None = None,
    db: Session = Depends(get_db),
    current=Depends(MANAGER_OR_STAFF),
):
    """
    List supplies for the current produce station (Produce Manager & Secretary only).
    """
    tenant_produce_id = current.get("produce_id") or current["id"]
    query = db.query(Supply).filter(Supply.produce_id == tenant_produce_id)
    if commodity:
        query = query.filter(Supply.commodity == commodity.lower())
    
    supplies = query.order_by(Supply.created_at.desc()).all()
    res = []
    for s in supplies:
        item = SupplyOut.model_validate(s)
        item.creator_name = s.creator.name if s.creator else None
        res.append(item)
    return res


@router.get("/{supply_id}", response_model=SupplyOut)
def get_supply(
    supply_id: uuid.UUID,
    db: Session = Depends(get_db),
    current=Depends(MANAGER_OR_STAFF),
):
    tenant_produce_id = current.get("produce_id") or current["id"]
    supply = db.query(Supply).filter(Supply.id == supply_id, Supply.produce_id == tenant_produce_id).first()
    if not supply:
        raise HTTPException(status_code=404, detail="Supply record not found")
    item = SupplyOut.model_validate(supply)
    item.creator_name = supply.creator.name if supply.creator else None
    return item
