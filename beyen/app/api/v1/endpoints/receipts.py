"""
Receipts read endpoints. (spec section 11)

Receipts are created by the issue-receipt actions in cocoa/coffee/cola endpoints.
This router provides read-only access.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.permissions import require_role
from app.models.user import UserRole
from app.models.receipt import Receipt
from app.schemas.receipt import ReceiptOut
from app.services.visibility import scope_query

router = APIRouter()

STAFF_ROLES = require_role(UserRole.produce_manager, UserRole.produce_secretary)


@router.get("/", response_model=list[ReceiptOut])
def list_receipts(
    seller_id: uuid.UUID | None = None,
    transaction_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
    current=Depends(STAFF_ROLES),
):
    """
    Produce Store Staff (Manager/Secretary) — list issued receipts.
    System Admin is not permitted to see receipts of any produce store.
    Filterable by seller, type (cocoa|coffee|cola), date range.
    """
    from datetime import datetime
    query = scope_query(db.query(Receipt), Receipt, current)

    if seller_id:
        query = query.filter(Receipt.seller_id == seller_id)
    if transaction_type:
        query = query.filter(Receipt.transaction_type == transaction_type.lower())
    if date_from:
        try:
            df = datetime.fromisoformat(date_from)
            query = query.filter(Receipt.issued_at >= df)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_from format. Use ISO 8601.")
    if date_to:
        try:
            dt = datetime.fromisoformat(date_to)
            query = query.filter(Receipt.issued_at <= dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_to format. Use ISO 8601.")

    receipts = query.order_by(Receipt.issued_at.desc()).all()
    from app.services.receipt_helper import format_receipt_out
    return [format_receipt_out(r, db) for r in receipts]


@router.get("/{receipt_id}", response_model=ReceiptOut)
def get_receipt(
    receipt_id: uuid.UUID,
    db: Session = Depends(get_db),
    current=Depends(STAFF_ROLES),
):
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    tenant_produce_id = current.get("produce_id") or current["id"]
    if receipt.produce_id and receipt.produce_id != tenant_produce_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if not scope_query(db.query(Receipt).filter(Receipt.id == receipt.id), Receipt, current).first():
        raise HTTPException(status_code=404, detail="Receipt not found")
    from app.services.receipt_helper import format_receipt_out
    return format_receipt_out(receipt, db)
