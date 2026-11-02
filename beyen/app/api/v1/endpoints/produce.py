"""
One purchase workflow for every commodity (cocoa, coffee, cola, and future ones).

Each commodity supplies only what is different about it — its model, schemas,
receipt prefix and pricing rule — via a CommoditySpec. The routes, permissions,
station sync rules and audit logging are shared.

Transaction states:
  PENDING   — recorded; awaiting review
  APPROVED  — reviewed; receipt not yet issued
  REJECTED  — sent back with a reason; the recorder corrects and resubmits
  FINALIZED — receipt issued; corrections are Manager-only and logged

Who reviews (approve / reject / issue receipt):
  - Secretary: their station's purchases, until they sync them at the end of the day.
  - Manager / Admin: anything synced (and their own purchases, which are synced on creation).
"""
import uuid
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any, Callable
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.permissions import require_role
from app.models.user import UserRole
from app.models.seller import Seller, GenderEnum
from app.models.transaction_status import TransactionStatus
from app.schemas.receipt import ReceiptOut
from app.services.audit import log_action
from app.services.visibility import (
    tenant_id_of, is_secretary, synced_at_on_create, scope_query, ensure_visible, ensure_can_review,
)

ANY_STAFF = require_role(UserRole.produce_manager, UserRole.system_admin, UserRole.produce_secretary)

# Fields compared in audit snapshots, when the commodity has them
_SNAPSHOT_FIELDS = ("weight_kg", "bags", "water_percent", "standard_percent",
                    "price_per_kg", "net_weight_kg", "total_price")


@dataclass
class CommoditySpec:
    name: str                       # "cocoa" — also the URL prefix and receipt transaction_type
    receipt_prefix: str             # "COC"
    model: Any
    create_schema: Any
    edit_schema: Any
    out_schema: Any
    reject_schema: Any
    # (payload, db) -> model fields that depend on pricing (total_price, net_weight_kg, ...)
    price: Callable[[Any, Session], dict]


def _snapshot(txn) -> dict:
    return {f: getattr(txn, f) for f in _SNAPSHOT_FIELDS if hasattr(txn, f)}


def _walk_in_seller(db: Session, payload, current: dict) -> uuid.UUID:
    from app.api.v1.endpoints.sellers import _generate_seller_id
    seller = Seller(
        seller_id=_generate_seller_id(db),
        name=payload.random_seller_name.strip(),
        contact=payload.random_seller_contact.strip() if payload.random_seller_contact else None,
        address="Walk-in / Random",
        gender=GenderEnum.other,
        is_random=True,
        produce_id=tenant_id_of(current),
        created_by=current["id"],
    )
    db.add(seller)
    db.flush()
    return seller.id


def _apply_inputs(spec: CommoditySpec, txn, payload, db: Session) -> None:
    txn.weight_kg = payload.weight_kg
    if payload.bags is not None:
        txn.bags = payload.bags
    txn.price_per_kg = payload.price_per_kg
    for field, value in spec.price(payload, db).items():
        setattr(txn, field, value)


def build_router(spec: CommoditySpec) -> APIRouter:
    router = APIRouter()
    Model = spec.model
    entity = Model.__name__

    def _load(db: Session, txn_id: uuid.UUID, current: dict):
        txn = db.query(Model).filter(Model.id == txn_id).first()
        ensure_visible(txn, current)
        return txn

    def _load_for_review(db: Session, txn_id: uuid.UUID, current: dict):
        txn = db.query(Model).filter(Model.id == txn_id).first()
        ensure_can_review(txn, current)
        return txn

    # -------------------------------------------------------------- create
    @router.post("/", response_model=spec.out_schema, status_code=201)
    def record_purchase(payload: spec.create_schema, db: Session = Depends(get_db), current=Depends(ANY_STAFF)):
        """Any staff role records a purchase; it always starts as PENDING."""
        if payload.client_ref:
            # Offline queue retry: the purchase may already have reached us before the connection dropped
            existing = db.query(Model).filter(Model.client_ref == payload.client_ref).first()
            if existing:
                if existing.produce_id != tenant_id_of(current) or existing.created_by != current["id"]:
                    raise HTTPException(status_code=409, detail="Duplicate purchase reference.")
                return existing

        seller_id = payload.seller_id
        if not seller_id:
            if not payload.random_seller_name:
                raise HTTPException(status_code=400, detail="Either a seller_id or random_seller_name must be provided.")
            seller_id = _walk_in_seller(db, payload, current)
        else:
            seller = db.query(Seller).filter(Seller.id == seller_id).first()
            if not seller or (seller.produce_id and seller.produce_id != tenant_id_of(current)):
                raise HTTPException(status_code=404, detail="Seller not found")

        try:
            priced = spec.price(payload, db)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        txn = Model(
            seller_id=seller_id,
            date=payload.date,
            weight_kg=payload.weight_kg,
            bags=payload.bags if payload.bags is not None else 1,
            price_per_kg=payload.price_per_kg,
            **priced,
            status=TransactionStatus.pending,
            produce_id=tenant_id_of(current),
            station_name=current.get("station_name"),
            created_by=current["id"],
            synced_at=synced_at_on_create(current),
            synced_by=None if is_secretary(current) else current["id"],
            client_ref=payload.client_ref,
        )
        db.add(txn)
        db.flush()
        log_action(db, current["id"], current["role"], "create", entity, txn.id,
                   new_value=payload.model_dump(), commit=False)
        db.commit()
        db.refresh(txn)
        return txn

    # -------------------------------------------------------------- edit
    @router.put("/{txn_id}", response_model=spec.out_schema)
    def edit_purchase(txn_id: uuid.UUID, payload: spec.edit_schema,
                      db: Session = Depends(get_db), current=Depends(ANY_STAFF)):
        """
        Secretary: edit own PENDING or REJECTED purchases (resubmits them).
        Manager/Admin: edit any PENDING or REJECTED purchase; correct FINALIZED ones (logged).
        """
        txn = _load(db, txn_id, current)
        secretary = is_secretary(current)
        if secretary and txn.created_by != current["id"]:
            raise HTTPException(status_code=403, detail="You can only edit your own submissions.")
        if secretary and txn.status == TransactionStatus.finalized:
            raise HTTPException(status_code=403, detail="Secretary cannot edit a finalized transaction.")

        old = _snapshot(txn)
        if txn.status == TransactionStatus.finalized:
            action = "correct_finalized"
        elif txn.status in (TransactionStatus.pending, TransactionStatus.rejected):
            action = "resubmit"
        else:
            raise HTTPException(status_code=400, detail="Only PENDING or REJECTED transactions can be edited.")

        try:
            _apply_inputs(spec, txn, payload, db)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        if action == "resubmit":
            txn.status = TransactionStatus.pending
            txn.rejection_reason = None

        log_action(db, current["id"], current["role"], action, entity, txn.id,
                   old_value=old, new_value=payload.model_dump(), commit=False)
        db.commit()
        db.refresh(txn)
        return txn

    # -------------------------------------------------------------- review
    @router.post("/{txn_id}/approve", response_model=spec.out_schema)
    def approve_purchase(txn_id: uuid.UUID, db: Session = Depends(get_db), current=Depends(ANY_STAFF)):
        """Step 1 of 2: PENDING -> APPROVED."""
        txn = _load_for_review(db, txn_id, current)
        if txn.status != TransactionStatus.pending:
            raise HTTPException(status_code=400, detail="Only PENDING transactions can be approved.")
        txn.status = TransactionStatus.approved
        txn.reviewed_by = current["id"]
        txn.approved_at = datetime.utcnow()
        log_action(db, current["id"], current["role"], "approve", entity, txn.id, commit=False)
        db.commit()
        db.refresh(txn)
        return txn

    @router.post("/{txn_id}/reject", response_model=spec.out_schema)
    def reject_purchase(txn_id: uuid.UUID, payload: spec.reject_schema,
                        db: Session = Depends(get_db), current=Depends(ANY_STAFF)):
        """Rejected purchases are kept with the reason so they can be corrected and resubmitted."""
        txn = _load_for_review(db, txn_id, current)
        if txn.status not in (TransactionStatus.pending, TransactionStatus.approved):
            raise HTTPException(status_code=400, detail="Only PENDING or APPROVED transactions can be rejected.")
        txn.status = TransactionStatus.rejected
        txn.rejection_reason = payload.reason
        txn.reviewed_by = current["id"]
        log_action(db, current["id"], current["role"], "reject", entity, txn.id,
                   new_value={"reason": payload.reason}, commit=False)
        db.commit()
        db.refresh(txn)
        return txn

    @router.post("/{txn_id}/issue-receipt", response_model=ReceiptOut)
    def issue_receipt(txn_id: uuid.UUID,
                      loan_deduction: Decimal = Query(default=Decimal("0"), ge=0),
                      db: Session = Depends(get_db), current=Depends(ANY_STAFF)):
        """Step 2 of 2: APPROVED -> FINALIZED with a receipt (and optional loan deduction)."""
        txn = _load_for_review(db, txn_id, current)
        from app.services.receipt_helper import finalize_and_issue_receipt
        return finalize_and_issue_receipt(
            db=db, txn=txn, transaction_type=spec.name, prefix=spec.receipt_prefix,
            current=current, loan_deduction=loan_deduction,
        )

    # -------------------------------------------------------------- reads
    @router.get("/", response_model=list[spec.out_schema])
    def list_purchases(
        status: TransactionStatus | None = None,
        seller_id: uuid.UUID | None = None,
        station: str | None = None,
        unsynced_only: bool = False,
        db: Session = Depends(get_db),
        current=Depends(ANY_STAFF),
    ):
        query = scope_query(db.query(Model), Model, current)
        if station:
            query = query.filter(Model.station_name == station)
        if status:
            query = query.filter(Model.status == status)
        if seller_id:
            query = query.filter(Model.seller_id == seller_id)
        if unsynced_only:
            query = query.filter(Model.synced_at.is_(None))
        return query.order_by(Model.date.desc(), Model.created_at.desc()).all()

    @router.get("/{txn_id}", response_model=spec.out_schema)
    def get_purchase(txn_id: uuid.UUID, db: Session = Depends(get_db), current=Depends(ANY_STAFF)):
        return _load(db, txn_id, current)

    return router
