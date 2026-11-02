"""
Reports endpoint. (spec section 12)

Role restrictions:
  Secretary — their own submitted transactions only.
  Manager   — all transactions (own station).
  Admin     — everything across all stations.

Supports JSON response and PDF/Excel export.
"""
import uuid
from datetime import date
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.core.permissions import require_role
from app.models.user import User, UserRole
from app.models.cocoa import CocoaTransaction
from app.models.coffee import CoffeeTransaction
from app.models.cola import ColaTransaction
from app.models.loan import Loan
from app.models.receipt import Receipt
from app.models.transaction_status import TransactionStatus
from app.services.pricing import calculate_loan_balance
from app.services.visibility import scope_query
from app.services.report_export import export_produce_pdf, export_produce_excel

router = APIRouter()

ANY_STAFF = require_role(UserRole.produce_manager, UserRole.produce_secretary)
MANAGER_ONLY = require_role(UserRole.produce_manager)


def _filter_produce(model, db, current, status=None, seller_id=None,
                    date_from=None, date_to=None):
    query = db.query(model).options(joinedload(model.seller))
    query = scope_query(query, model, current)   # managers only see synced station purchases
    if seller_id:
        query = query.filter(model.seller_id == seller_id)
    if status:
        query = query.filter(model.status == status)
    if date_from:
        query = query.filter(model.date >= date_from)
    if date_to:
        query = query.filter(model.date <= date_to)
    return query.order_by(model.date.desc()).all()


def _txn_to_dict(txn, commodity: str) -> dict:
    seller = txn.seller
    d = {
        "commodity": commodity,
        "id": str(txn.id),
        "seller_id": str(txn.seller_id),
        "date": str(txn.date),
        "weight_kg": txn.weight_kg,
        "bags": getattr(txn, "bags", 1),
        "price_per_kg": txn.price_per_kg,
        "total_price": txn.total_price,
        "status": txn.status.value,
        "created_by": str(txn.created_by),
        "station_name": txn.station_name,
        "seller_name": seller.name if seller else None,
        "seller_code": seller.seller_id if seller else None,
        "seller_contact": seller.contact if seller else None,
        "seller_address": seller.address if seller else None,
        "seller_section": seller.section if seller else None,
        "seller_chiefdom": seller.chiefdom if seller else None,
        "seller_district": seller.district if seller else None,
    }
    if hasattr(txn, "water_percent"):
        d["water_percent"] = txn.water_percent
        d["net_weight_kg"] = txn.net_weight_kg
    return d


def _collect_rows(db, current, commodity, status, seller_id, date_from, date_to) -> list[dict]:
    rows = []
    for name, model in (("cocoa", CocoaTransaction), ("coffee", CoffeeTransaction), ("cola", ColaTransaction)):
        if not commodity or commodity == name:
            rows += [_txn_to_dict(t, name) for t in
                     _filter_produce(model, db, current, status, seller_id, date_from, date_to)]
    rows.sort(key=lambda r: r["date"], reverse=True)
    return rows


def _add_traceability(db, rows: list[dict]) -> None:
    """Attach receipt number / payment and staff names to each row (for exports)."""
    if not rows:
        return
    txn_ids = [uuid.UUID(r["id"]) for r in rows]
    receipts = {str(r.transaction_id): r for r in db.query(Receipt).filter(Receipt.transaction_id.in_(txn_ids))}
    user_ids = {uuid.UUID(r["created_by"]) for r in rows} | {r.issued_by for r in receipts.values() if r.issued_by}
    names = {str(u.id): u.name for u in db.query(User.id, User.name).filter(User.id.in_(user_ids))}
    for r in rows:
        rec = receipts.get(r["id"])
        r["receipt_number"] = rec.receipt_number if rec else None
        r["issued_at"] = rec.issued_at if rec else None
        r["loan_deduction"] = rec.loan_deduction if rec else None
        r["net_amount_paid"] = rec.net_amount_paid if rec else None
        r["recorded_by_name"] = names.get(r["created_by"])
        r["issued_by_name"] = names.get(str(rec.issued_by)) if rec else None
        r["moisture_deduction_kg"] = (
            round(r["weight_kg"] - r["net_weight_kg"], 2) if r.get("net_weight_kg") is not None else None
        )


# ---------------------------------------------------------------------------
# Produce report
# ---------------------------------------------------------------------------

@router.get("/produce")
def produce_report(
    commodity: str | None = None,      # cocoa | coffee | cola | None (all)
    status: TransactionStatus | None = None,
    seller_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    current=Depends(ANY_STAFF),
):
    """JSON produce report, filterable by commodity, status, seller, date range."""
    rows = _collect_rows(db, current, commodity, status, seller_id, date_from, date_to)

    total_value = round(sum(r["total_price"] for r in rows), 2)
    total_weight = round(sum(r["weight_kg"] for r in rows), 2)
    return {
        "count": len(rows),
        "total_weight_kg": total_weight,
        "total_value_nle": total_value,
        "transactions": rows,
    }


@router.get("/produce/export")
def produce_report_export(
    format: Literal["pdf", "excel"] = Query("pdf"),
    commodity: str | None = None,
    status: TransactionStatus | None = None,
    seller_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    current=Depends(MANAGER_ONLY),
):
    """Export produce report as PDF or Excel. Manager only. (spec section 12)

    Every row carries the seller's full identity and location (section, chiefdom,
    district) plus the receipt number and staff names, so each bag can be traced
    back to the farmer and the transaction that paid for it.
    """
    rows = _collect_rows(db, current, commodity, status, seller_id, date_from, date_to)
    _add_traceability(db, rows)

    manager = db.query(User).filter(User.id == current["id"]).first()
    business = (manager.business_name or manager.station_name) if manager else None
    filters = []
    if commodity:
        filters.append(f"Commodity: {commodity.title()}")
    if status:
        filters.append(f"Status: {status.value.title()}")
    if seller_id and rows:
        filters.append(f"Seller: {rows[0]['seller_name']} ({rows[0]['seller_code']})")
    period = f"{date_from or 'start'} to {date_to or 'today'}" if (date_from or date_to) else "All dates"
    meta = {
        "business": business or "Produce Buying Station",
        "period": period,
        "filters": ", ".join(filters) or "None",
        "generated_by": current.get("name") or "",
    }
    stamp = date.today().isoformat()

    if format == "pdf":
        data = export_produce_pdf(rows, meta)
        return Response(
            content=data,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=COMIS_Produce_Report_{stamp}.pdf"},
        )
    data = export_produce_excel(rows, meta)
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=COMIS_Produce_Report_{stamp}.xlsx"},
    )


# ---------------------------------------------------------------------------
# Loans report
# ---------------------------------------------------------------------------

@router.get("/loans")
def loans_report(
    status: str | None = None,
    seller_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    current=Depends(MANAGER_ONLY),
):
    """Loan status report for Produce Manager."""
    query = db.query(Loan)
    tenant_produce_id = current.get("produce_id") or current["id"]
    query = query.filter(Loan.produce_id == tenant_produce_id)
    if seller_id:
        query = query.filter(Loan.seller_id == seller_id)
    if status:
        query = query.filter(Loan.status == status)
    loans = query.all()

    rows = []
    for loan in loans:
        total_paid = sum(r.amount_paid for r in loan.repayments)
        balance = calculate_loan_balance(loan.loan_taken, total_paid)
        rows.append({
            "id": str(loan.id),
            "seller_id": str(loan.seller_id),
            "date": str(loan.date),
            "loan_taken": loan.loan_taken,
            "total_paid": round(total_paid, 2),
            "balance": balance,
            "status": loan.status,
            "due_date": str(loan.due_date) if loan.due_date else None,
        })

    return {
        "count": len(rows),
        "total_loaned": round(sum(r["loan_taken"] for r in rows), 2),
        "total_outstanding": round(sum(r["balance"] for r in rows), 2),
        "loans": rows,
    }


# ---------------------------------------------------------------------------
# Seller statement
# ---------------------------------------------------------------------------

@router.get("/seller/{seller_id}")
def seller_statement(
    seller_id: uuid.UUID,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    current=Depends(MANAGER_ONLY),
):
    """Per-seller statement: all produce transactions, all loans, receipts."""
    cocoa = _filter_produce(CocoaTransaction, db, current, seller_id=seller_id,
                            date_from=date_from, date_to=date_to)
    coffee = _filter_produce(CoffeeTransaction, db, current, seller_id=seller_id,
                             date_from=date_from, date_to=date_to)
    cola = _filter_produce(ColaTransaction, db, current, seller_id=seller_id,
                           date_from=date_from, date_to=date_to)

    loan_query = db.query(Loan).filter(Loan.seller_id == seller_id)
    receipt_query = db.query(Receipt).filter(Receipt.seller_id == seller_id)
    tenant_produce_id = current.get("produce_id") or current["id"]
    loan_query = loan_query.filter(Loan.produce_id == tenant_produce_id)
    receipt_query = receipt_query.filter(Receipt.produce_id == tenant_produce_id, Receipt.synced_at.isnot(None))

    loans = loan_query.all()
    loan_rows = []
    for loan in loans:
        total_paid = sum(r.amount_paid for r in loan.repayments)
        balance = calculate_loan_balance(loan.loan_taken, total_paid)
        loan_rows.append({
            "id": str(loan.id), "date": str(loan.date),
            "loan_taken": loan.loan_taken, "total_paid": round(total_paid, 2),
            "balance": balance, "status": loan.status,
        })

    receipts = receipt_query.all()

    return {
        "seller_id": str(seller_id),
        "cocoa_transactions": [_txn_to_dict(t, "cocoa") for t in cocoa],
        "coffee_transactions": [_txn_to_dict(t, "coffee") for t in coffee],
        "cola_transactions": [_txn_to_dict(t, "cola") for t in cola],
        "loans": loan_rows,
        "receipts": [
            {"id": str(r.id), "receipt_number": r.receipt_number,
             "type": r.transaction_type, "net_amount_paid": r.net_amount_paid,
             "issued_at": str(r.issued_at)}
            for r in receipts
        ],
        "total_produce_value": round(
            sum(t.total_price for t in cocoa + coffee + cola), 2
        ),
        "total_outstanding_loans": round(
            sum(row["balance"] for row in loan_rows if row["status"] != "cleared"), 2
        ),
    }
