"""
Dashboard summary endpoint. (spec section 6)

Role-aware aggregation:
  Manager  — today's station totals, pending transactions, overdue loans, receipts today
  Secretary — today's own submissions with status breakdown
  Admin    — system-wide totals, pending approvals, all-station overview
"""
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.permissions import require_role
from app.models.user import User, UserRole, UserStatus
from app.models.seller import Seller
from app.models.cocoa import CocoaTransaction
from app.models.coffee import CoffeeTransaction
from app.models.cola import ColaTransaction
from app.models.loan import Loan
from app.models.receipt import Receipt
from app.models.transaction_status import TransactionStatus

router = APIRouter()

ANY_STAFF = require_role(UserRole.produce_manager, UserRole.system_admin, UserRole.produce_secretary)


def _txn_today_stats(model, db: Session, created_by_filter=None, produce_id_filter=None, station_filter=None,
                     synced_only=False):
    """Count and sum today's transactions for a commodity model with commodity-specific metrics."""
    today = date.today()
    query = db.query(model).filter(func.date(model.created_at) == today)
    if produce_id_filter:
        query = query.filter(model.produce_id == produce_id_filter)
    if station_filter:
        query = query.filter(model.station_name == station_filter)
    if created_by_filter:
        query = query.filter(model.created_by == created_by_filter)
    if synced_only:
        query = query.filter(model.synced_at.isnot(None))
    txns = query.all()

    total_weight = round(sum(t.weight_kg for t in txns), 2)
    total_val = round(sum(t.total_price for t in txns), 2)
    total_bags = int(round(total_weight / 70.0)) if total_weight > 0 else 0

    has_water = hasattr(model, "water_percent")
    if has_water and txns:
        highest_water = round(max(t.water_percent for t in txns), 2)
        lowest_water = round(min(t.water_percent for t in txns), 2)
    else:
        highest_water = 0.0
        lowest_water = 0.0

    seller_totals = {}
    for t in txns:
        s_name = t.seller_name or "Walk-in Seller"
        seller_totals[s_name] = seller_totals.get(s_name, 0.0) + t.weight_kg

    highest_seller = max(seller_totals, key=seller_totals.get) if seller_totals else "None yet"

    return {
        "count": len(txns),
        "total_weight_kg": total_weight,
        "total_bags": total_bags,
        "highest_water_percent": highest_water,
        "lowest_water_percent": lowest_water,
        "highest_seller": highest_seller,
        "total_value": total_val,
        "pending": sum(1 for t in txns if t.status == TransactionStatus.pending),
        "approved": sum(1 for t in txns if t.status == TransactionStatus.approved),
        "rejected": sum(1 for t in txns if t.status == TransactionStatus.rejected),
        "finalized": sum(1 for t in txns if t.status == TransactionStatus.finalized),
    }


@router.get("/summary")
def dashboard_summary(db: Session = Depends(get_db), current=Depends(ANY_STAFF)):
    today = date.today()
    role = current["role"]
    tenant_produce_id = current.get("produce_id") or current["id"]

    if role == UserRole.produce_secretary.value:
        # Secretary sees their station's or own today's submissions
        uid = current["id"]
        sec_station = current.get("station_name")
        cocoa = _txn_today_stats(CocoaTransaction, db, created_by_filter=None if sec_station else uid, produce_id_filter=tenant_produce_id, station_filter=sec_station)
        coffee = _txn_today_stats(CoffeeTransaction, db, created_by_filter=None if sec_station else uid, produce_id_filter=tenant_produce_id, station_filter=sec_station)
        cola = _txn_today_stats(ColaTransaction, db, created_by_filter=None if sec_station else uid, produce_id_filter=tenant_produce_id, station_filter=sec_station)
        
        pending_total = cocoa["pending"] + coffee["pending"] + cola["pending"]
        total_gross_kg = round(cocoa["total_weight_kg"] + coffee["total_weight_kg"] + cola["total_weight_kg"], 2)
        total_gross_nle = round(cocoa["total_value"] + coffee["total_value"] + cola["total_value"], 2)

        return {
            "role": role,
            "date": str(today),
            "cocoa": cocoa,
            "coffee": coffee,
            "cola": cola,
            "pending_transactions_total": pending_total,
            "today_purchases_recorded": cocoa["count"] + coffee["count"] + cola["count"],
            "today_gross_kg": total_gross_kg,
            "today_gross_nle": total_gross_nle,
        }

    if role == UserRole.produce_manager.value:
        # The Manager sees station activity only once the secretary has synced it
        cocoa = _txn_today_stats(CocoaTransaction, db, produce_id_filter=tenant_produce_id, synced_only=True)
        coffee = _txn_today_stats(CoffeeTransaction, db, produce_id_filter=tenant_produce_id, synced_only=True)
        cola = _txn_today_stats(ColaTransaction, db, produce_id_filter=tenant_produce_id, synced_only=True)
        unsynced_station_purchases = sum(
            db.query(func.count(m.id)).filter(m.produce_id == tenant_produce_id, m.synced_at.is_(None)).scalar() or 0
            for m in (CocoaTransaction, CoffeeTransaction, ColaTransaction)
        )

        pending_total = (cocoa["pending"] + coffee["pending"] + cola["pending"])
        receipts_today = (
            db.query(Receipt)
            .filter(Receipt.produce_id == tenant_produce_id, func.date(Receipt.issued_at) == today,
                    Receipt.synced_at.isnot(None))
            .count()
        )
        cash_out_today = round(
            db.query(func.sum(Receipt.net_amount_paid))
            .filter(Receipt.produce_id == tenant_produce_id, func.date(Receipt.issued_at) == today,
                    Receipt.synced_at.isnot(None))
            .scalar() or 0.0, 2
        )
        outstanding_loans = (
            db.query(Loan)
            .filter(Loan.produce_id == tenant_produce_id, Loan.status.in_(["active", "overdue"]))
            .count()
        )
        overdue_loans = db.query(Loan).filter(Loan.produce_id == tenant_produce_id, Loan.status == "overdue").count()

        return {
            "role": role,
            "date": str(today),
            "cocoa": cocoa,
            "coffee": coffee,
            "cola": cola,
            "pending_transactions_total": pending_total,
            "receipts_issued_today": receipts_today,
            "unsynced_station_purchases": unsynced_station_purchases,
            "cash_paid_out_today": cash_out_today,
            "outstanding_loans": outstanding_loans,
            "overdue_loans": overdue_loans,
        }

    # System Admin — system-wide
    total_managers = db.query(User).filter(User.role == UserRole.produce_manager).count()
    total_secretaries = db.query(User).filter(User.role == UserRole.produce_secretary).count()
    pending_account_approvals = (
        db.query(User)
        .filter(User.role == UserRole.produce_manager, User.status == UserStatus.pending)
        .count()
    )
    total_sellers = db.query(Seller).filter(Seller.is_active == True).count()

    cocoa = _txn_today_stats(CocoaTransaction, db)
    coffee = _txn_today_stats(CoffeeTransaction, db)
    cola = _txn_today_stats(ColaTransaction, db)
    pending_txns = cocoa["pending"] + coffee["pending"] + cola["pending"]

    total_outstanding_loans = db.query(Loan).filter(Loan.status.in_(["active", "overdue"])).count()

    return {
        "role": role,
        "date": str(today),
        "total_managers": total_managers,
        "total_secretaries": total_secretaries,
        "pending_account_approvals": pending_account_approvals,
        "total_active_sellers": total_sellers,
        "today_cocoa": cocoa,
        "today_coffee": coffee,
        "today_cola": cola,
        "pending_transactions_all_stations": pending_txns,
        "outstanding_loans": total_outstanding_loans,
    }
