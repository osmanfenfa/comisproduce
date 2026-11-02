"""
End-of-day station sync.

Secretary:
  GET  /sync/summary — everything recorded at the station that the Manager can't see yet
  POST /sync/        — hand it over: the Manager sees it from now on, and only the Manager can change it
Manager:
  GET  /sync/status  — per secretary: how many purchases are still waiting to be synced, and the last sync
"""
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.permissions import require_role
from app.models.user import User, UserRole
from app.models.cocoa import CocoaTransaction
from app.models.coffee import CoffeeTransaction
from app.models.cola import ColaTransaction
from app.models.receipt import Receipt
from app.services.audit import log_action
from app.services.visibility import tenant_id_of

router = APIRouter()

SECRETARY = require_role(UserRole.produce_secretary)
MANAGER_ONLY = require_role(UserRole.produce_manager)
COMMODITIES = (("cocoa", CocoaTransaction), ("coffee", CoffeeTransaction), ("cola", ColaTransaction))


class SyncItem(BaseModel):
    id: str
    commodity: str
    date: str
    seller_name: str | None
    weight_kg: float
    bags: int | None
    total_price: float
    status: str
    receipt_number: str | None = None
    net_amount_paid: float | None = None


class SyncSummary(BaseModel):
    purchases: int
    by_status: dict[str, int]
    total_weight_kg: float
    total_value: float
    receipts_issued: int
    cash_paid: float
    loan_deductions: float
    not_receipted: int          # pending / approved / rejected: will go to the Manager for review
    last_synced_at: datetime | None
    items: list[SyncItem]


class SyncResult(BaseModel):
    synced_purchases: int
    synced_receipts: int
    synced_at: datetime


class StationSyncStatus(BaseModel):
    secretary_id: str
    secretary_name: str
    station_name: str | None
    unsynced_purchases: int
    last_synced_at: datetime | None


def _unsynced(db: Session, model, current: dict):
    return db.query(model).filter(
        model.produce_id == tenant_id_of(current),
        model.created_by == current["id"],
        model.synced_at.is_(None),
    )


def _last_sync(db: Session, user_id) -> datetime | None:
    stamps = [db.query(func.max(m.synced_at)).filter(m.synced_by == user_id).scalar() for _, m in COMMODITIES]
    stamps = [s for s in stamps if s]
    return max(stamps) if stamps else None


@router.get("/summary", response_model=SyncSummary)
def sync_summary(db: Session = Depends(get_db), current=Depends(SECRETARY)):
    items, by_status = [], {}
    total_kg, total_value = 0.0, Decimal("0")
    txn_ids = []
    for name, model in COMMODITIES:
        for t in _unsynced(db, model, current).order_by(model.date, model.created_at).all():
            txn_ids.append(t.id)
            by_status[t.status.value] = by_status.get(t.status.value, 0) + 1
            total_kg += t.weight_kg or 0
            total_value += t.total_price or 0
            items.append(SyncItem(
                id=str(t.id), commodity=name, date=str(t.date), seller_name=t.seller_name,
                weight_kg=t.weight_kg, bags=t.bags, total_price=float(t.total_price),
                status=t.status.value,
            ))

    receipts = db.query(Receipt).filter(Receipt.transaction_id.in_(txn_ids)).all() if txn_ids else []
    by_txn = {str(r.transaction_id): r for r in receipts}
    for item in items:
        r = by_txn.get(item.id)
        if r:
            item.receipt_number = r.receipt_number
            item.net_amount_paid = float(r.net_amount_paid)

    return SyncSummary(
        purchases=len(items),
        by_status=by_status,
        total_weight_kg=round(total_kg, 2),
        total_value=float(total_value),
        receipts_issued=len(receipts),
        cash_paid=float(sum((r.net_amount_paid for r in receipts), Decimal("0"))),
        loan_deductions=float(sum((r.loan_deduction or 0 for r in receipts), Decimal("0"))),
        not_receipted=sum(1 for i in items if i.status != "finalized"),
        last_synced_at=_last_sync(db, current["id"]),
        items=items,
    )


@router.post("/", response_model=SyncResult)
def sync_to_manager(db: Session = Depends(get_db), current=Depends(SECRETARY)):
    now = datetime.utcnow()
    txn_ids = []
    for _, model in COMMODITIES:
        rows = _unsynced(db, model, current).with_for_update().all()
        for t in rows:
            t.synced_at = now
            t.synced_by = current["id"]
            txn_ids.append(t.id)

    synced_receipts = 0
    if txn_ids:
        synced_receipts = db.query(Receipt).filter(
            Receipt.transaction_id.in_(txn_ids), Receipt.synced_at.is_(None)
        ).update({Receipt.synced_at: now}, synchronize_session=False)

    log_action(db, current["id"], current["role"], "daily_sync", "Station", None,
               new_value={"purchases": len(txn_ids), "receipts": synced_receipts,
                          "station": current.get("station_name")}, commit=False)
    db.commit()
    return SyncResult(synced_purchases=len(txn_ids), synced_receipts=synced_receipts, synced_at=now)


@router.get("/status", response_model=list[StationSyncStatus])
def station_sync_status(db: Session = Depends(get_db), current=Depends(MANAGER_ONLY)):
    """Counts only — the Manager can't see what is in an unsynced day until it is synced."""
    tenant = tenant_id_of(current)
    secretaries = db.query(User).filter(
        User.role == UserRole.produce_secretary, User.produce_id == tenant
    ).order_by(User.name).all()
    out = []
    for s in secretaries:
        pending = sum(
            db.query(func.count(m.id)).filter(
                m.produce_id == tenant, m.created_by == s.id, m.synced_at.is_(None)
            ).scalar() or 0
            for _, m in COMMODITIES
        )
        out.append(StationSyncStatus(
            secretary_id=str(s.id), secretary_name=s.name, station_name=s.station_name,
            unsynced_purchases=pending, last_synced_at=_last_sync(db, s.id),
        ))
    return out
