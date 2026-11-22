"""
Farmer records: a farmer who signed up on COMIS Market sees what buying stations
recorded about them (receipts, loans, today's prices at those stations).

Matching is by phone number against station seller records, so it only opens
after the farmer has verified that phone number by SMS code. Otherwise anyone
could sign up with someone else's number and read their sales and debts.
Read-only: nothing here changes station data.
"""
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.permissions import require_role
from app.models.user import User, UserRole
from app.models.seller import Seller
from app.models.receipt import Receipt
from app.models.loan import Loan
from app.services.phone import phone_key
from app.services.pricing import calculate_loan_balance
from app.services.receipt_helper import format_receipt_out
from app.services.settings_service import find_settings

router = APIRouter()

FARMER_ONLY = require_role(UserRole.farmer)


def _matching_sellers(db: Session, phone: str) -> list[Seller]:
    key = phone_key(phone)
    if not key:
        return []
    candidates = db.query(Seller).filter(Seller.contact.isnot(None), Seller.contact.like(f"%{key[-2:]}%")).all()
    return [s for s in candidates if phone_key(s.contact) == key]


@router.get("/records")
def my_station_records(db: Session = Depends(get_db), current=Depends(FARMER_ONLY)):
    user = db.query(User).filter(User.id == current["id"]).first()
    if not user or not user.phone_verified_at:
        raise HTTPException(status_code=403, detail="Verify your phone number to see your station records.")

    sellers = _matching_sellers(db, user.contact)
    seller_ids = [s.id for s in sellers]
    tenant_ids = {s.produce_id for s in sellers if s.produce_id}
    businesses = {
        u.id: (u.business_name or u.station_name or "Buying station")
        for u in db.query(User).filter(User.id.in_(tenant_ids or [user.id]))
    }

    receipts = []
    if seller_ids:
        for r in (db.query(Receipt).filter(Receipt.seller_id.in_(seller_ids))
                  .order_by(Receipt.issued_at.desc()).limit(200)):
            receipts.append(format_receipt_out(r, db))

    loans = []
    total_owed = Decimal("0")
    if seller_ids:
        for loan in db.query(Loan).filter(Loan.seller_id.in_(seller_ids)).order_by(Loan.date.desc()):
            paid = sum((r.amount_paid for r in loan.repayments), Decimal("0"))
            balance = calculate_loan_balance(loan.loan_taken, paid)
            if loan.status != "cleared":
                total_owed += max(balance, Decimal("0"))
            loans.append({
                "id": str(loan.id), "date": str(loan.date),
                "due_date": str(loan.due_date) if loan.due_date else None,
                "station": businesses.get(loan.produce_id, "Buying station"),
                "loan_taken": float(loan.loan_taken), "total_paid": float(paid),
                "balance": float(balance), "status": loan.status,
            })

    prices = []
    for tid in tenant_ids:
        s = find_settings(db, tid)
        if s:
            prices.append({
                "station": businesses.get(tid, "Buying station"),
                "cocoa_price_per_kg": float(s.cocoa_price_per_kg or 0),
                "coffee_price_per_kg": float(s.coffee_price_per_kg or 0),
                "cola_price_per_kg": float(s.cola_price_per_kg or 0),
            })

    return {
        "linked_stations": sorted({businesses.get(s.produce_id, "Buying station") for s in sellers}),
        "seller_ids": [s.seller_id for s in sellers],
        "receipts": receipts,
        "loans": loans,
        "total_owed": float(total_owed),
        "total_sold": float(sum((Decimal(str(r.net_amount_paid)) for r in receipts), Decimal("0"))),
        "prices": prices,
    }
