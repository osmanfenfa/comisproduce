"""
Payout methods — read-only listing plus a disabled Orange Money endpoint.
Placeholder only: see app/services/payouts.py. Receipts are unaffected.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.permissions import require_role
from app.models.user import UserRole
from app.services.payouts import PROVIDERS

router = APIRouter()

STAFF = require_role(UserRole.produce_manager, UserRole.produce_secretary)


class PayoutProviderOut(BaseModel):
    id: str
    name: str
    available: bool
    status: str
    note: str


@router.get("/providers", response_model=list[PayoutProviderOut])
def list_payout_providers(current=Depends(STAFF)):
    return [PayoutProviderOut(**vars(p.info)) for p in PROVIDERS.values()]


@router.post("/orange-money", status_code=501)
def orange_money_payout(current=Depends(STAFF)):
    """Not implemented yet — always answers 501 and never contacts Orange."""
    raise HTTPException(status_code=501, detail="Orange Money payouts are not enabled yet.")
