import uuid
from datetime import date
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.receipt import Receipt
from app.models.seller import Seller
from app.models.user import User, UserRole
from app.models.loan import Loan, LoanRepayment
from app.models.cocoa import CocoaTransaction
from app.models.coffee import CoffeeTransaction
from app.models.cola import ColaTransaction
from app.models.transaction_status import TransactionStatus
from app.schemas.receipt import ReceiptOut
from app.services.audit import log_action
from app.services.pricing import to_money, calculate_loan_balance
from app.services.settings_service import find_settings


def format_receipt_out(receipt: Receipt, db: Session) -> ReceiptOut:
    """
    Format a Receipt ORM instance into the full detailed ReceiptOut schema,
    hydrating produce account details, seller details (especially random seller name & number),
    and produce item details from snapshot columns or dynamic fallback joins.
    """
    seller = db.query(Seller).filter(Seller.id == receipt.seller_id).first()
    issuer = db.query(User).filter(User.id == receipt.issued_by).first() if receipt.issued_by else None
    recorder = db.query(User).filter(User.id == receipt.recorded_by).first() if receipt.recorded_by else None
    settings = find_settings(db, receipt.produce_id)

    # Produce Account
    st_name = (
        receipt.station_name
        or (issuer.station_name if issuer else None)
        or (settings.station_name if settings else None)
        or "COMIS Produce Station"
    )
    biz_name = (
        receipt.business_name
        or (issuer.business_name if issuer else None)
        or st_name
    )
    biz_addr = (
        receipt.business_address
        or (issuer.address if issuer else None)
        or ""
    )
    biz_phone = (
        receipt.business_phone
        or (issuer.phone_number if issuer else None)
        or (issuer.contact if issuer else "")
    )

    # Seller Info
    seller_name = receipt.seller_name_snapshot or (seller.name if seller else "Unknown Seller")
    seller_contact = receipt.seller_contact_snapshot or (seller.contact if seller else None)
    seller_code = seller.seller_id if seller else None
    is_random = getattr(seller, "is_random", False) if seller else False

    # Item Details
    weight_kg = receipt.weight_kg
    bags = getattr(receipt, "bags", None)
    water_percent = receipt.water_percent
    standard_percent = receipt.standard_percent
    net_weight_kg = receipt.net_weight_kg
    price_per_kg = receipt.price_per_kg

    # Fallback to transaction if snapshot fields weren't populated
    if weight_kg is None or net_weight_kg is None or bags is None:
        ttype = receipt.transaction_type.lower()
        txn = None
        if ttype == "cocoa":
            txn = db.query(CocoaTransaction).filter(CocoaTransaction.id == receipt.transaction_id).first()
        elif ttype == "coffee":
            txn = db.query(CoffeeTransaction).filter(CoffeeTransaction.id == receipt.transaction_id).first()
        elif ttype == "cola":
            txn = db.query(ColaTransaction).filter(ColaTransaction.id == receipt.transaction_id).first()

        if txn:
            weight_kg = weight_kg or txn.weight_kg
            bags = bags or getattr(txn, "bags", 1)
            water_percent = water_percent or getattr(txn, "water_percent", None)
            standard_percent = standard_percent or getattr(txn, "standard_percent", None)
            net_weight_kg = net_weight_kg or getattr(txn, "net_weight_kg", txn.weight_kg)
            price_per_kg = price_per_kg or txn.price_per_kg

    # Calculate deduction in kg if cocoa/coffee
    moisture_ded = 0.0
    if weight_kg is not None and net_weight_kg is not None:
        moisture_ded = round(max(0.0, weight_kg - net_weight_kg), 2)

    return ReceiptOut(
        id=receipt.id,
        receipt_number=receipt.receipt_number,
        transaction_type=receipt.transaction_type,
        transaction_id=receipt.transaction_id,
        seller_id=receipt.seller_id,
        gross_amount=receipt.gross_amount,
        loan_deduction=receipt.loan_deduction or 0.0,
        net_amount_paid=receipt.net_amount_paid,
        recorded_by=receipt.recorded_by,
        issued_by=receipt.issued_by,
        issued_at=receipt.issued_at,
        is_admin_override=receipt.is_admin_override,
        synced_at=receipt.synced_at,
        produce_id=receipt.produce_id,
        station_name=st_name,
        business_name=biz_name,
        business_address=biz_addr,
        business_phone=biz_phone,
        seller_name=seller_name,
        seller_contact=seller_contact,
        seller_code=seller_code,
        is_random_seller=is_random,
        seller_address=seller.address if seller else None,
        seller_section=getattr(seller, "section", None) if seller else None,
        seller_chiefdom=getattr(seller, "chiefdom", None) if seller else None,
        seller_district=getattr(seller, "district", None) if seller else None,
        weight_kg=weight_kg,
        bags=bags,
        water_percent=water_percent,
        standard_percent=standard_percent,
        moisture_deduction_kg=moisture_ded,
        net_weight_kg=net_weight_kg,
        price_per_kg=price_per_kg,
        recorded_by_name=receipt.recorded_by_name or (recorder.name if recorder else None),
        issued_by_name=receipt.issued_by_name or (issuer.name if issuer else None),
    )


def _apply_loan_deduction(db: Session, txn, amount: Decimal, current: dict) -> list[dict]:
    """
    Post a loan deduction as repayments against the seller's open loans, oldest first.
    Rows are locked so two receipts issued at once can't both spend the same balance.
    Returns [{loan_id, amount}] for the audit log.
    """
    query = db.query(Loan).filter(Loan.seller_id == txn.seller_id, Loan.status != "cleared")
    if getattr(txn, "produce_id", None):
        query = query.filter(Loan.produce_id == txn.produce_id)
    loans = query.order_by(Loan.date, Loan.created_at).with_for_update().all()

    balances = [
        (loan, calculate_loan_balance(loan.loan_taken, sum((r.amount_paid for r in loan.repayments), Decimal("0"))))
        for loan in loans
    ]
    outstanding = sum((bal for _, bal in balances if bal > 0), Decimal("0"))
    if amount > outstanding:
        raise HTTPException(
            status_code=400,
            detail=f"Loan deduction ({amount}) exceeds the seller's outstanding loan balance ({outstanding}).",
        )

    remaining = amount
    applied = []
    for loan, balance in balances:
        if remaining <= 0:
            break
        if balance <= 0:
            continue
        portion = min(balance, remaining)
        db.add(LoanRepayment(loan_id=loan.id, amount_paid=portion, date=date.today(), recorded_by=current["id"]))
        if portion == balance:
            loan.status = "cleared"
        remaining -= portion
        applied.append({"loan_id": str(loan.id), "amount": str(portion)})
    return applied


def finalize_and_issue_receipt(
    db: Session,
    txn,
    transaction_type: str,
    prefix: str,
    current: dict,
    loan_deduction,
) -> ReceiptOut:
    """
    Step 2 of the approval flow, as one database transaction:
      APPROVED -> FINALIZED, Receipt created, loan deduction posted as repayments,
      audit entry written. Either all of it is saved or none of it is.
    """
    deduction = to_money(loan_deduction or 0)
    try:
        # Re-read the transaction under a row lock so it can't be receipted twice concurrently
        db.refresh(txn, with_for_update=True)
        if txn.status != TransactionStatus.approved:
            raise HTTPException(
                status_code=400,
                detail="Transaction must be in APPROVED state before a receipt can be issued. "
                       "Approve the transaction first.",
            )
        gross = to_money(txn.total_price)
        if deduction < 0:
            raise HTTPException(status_code=400, detail="Loan deduction cannot be negative.")
        if deduction > gross:
            raise HTTPException(status_code=400, detail="Loan deduction cannot exceed the gross amount.")

        applied = _apply_loan_deduction(db, txn, deduction, current) if deduction > 0 else []

        is_admin_override = current["role"] == UserRole.system_admin.value
        issuer = db.query(User).filter(User.id == current["id"]).first()
        recorder = db.query(User).filter(User.id == txn.created_by).first() if txn.created_by else None
        seller = db.query(Seller).filter(Seller.id == txn.seller_id).first()
        tenant_produce_id = getattr(txn, "produce_id", None) or current.get("produce_id") or current["id"]
        settings = find_settings(db, tenant_produce_id)

        st_name = (
            (issuer.station_name if issuer else None)
            or (settings.station_name if settings else None)
            or "COMIS Produce Station"
        )
        biz_name = (issuer.business_name if issuer else None) or st_name
        biz_addr = (issuer.address if issuer else None) or ""
        biz_phone = (issuer.phone_number if issuer else None) or (issuer.contact if issuer else "")

        txn.status = TransactionStatus.finalized
        receipt = Receipt(
            receipt_number=f"{prefix}-{txn.id.hex[:12].upper()}",
            transaction_type=transaction_type,
            transaction_id=txn.id,
            seller_id=txn.seller_id,
            gross_amount=gross,
            loan_deduction=deduction,
            net_amount_paid=gross - deduction,
            recorded_by=txn.created_by,
            issued_by=current["id"],
            is_admin_override=is_admin_override,
            synced_at=txn.synced_at,
            produce_id=tenant_produce_id,
            station_name=getattr(txn, "station_name", None) or st_name,
            business_name=biz_name,
            business_address=biz_addr,
            business_phone=biz_phone,
            weight_kg=txn.weight_kg,
            bags=getattr(txn, "bags", 1),
            water_percent=getattr(txn, "water_percent", None),
            standard_percent=getattr(txn, "standard_percent", None),
            net_weight_kg=getattr(txn, "net_weight_kg", txn.weight_kg),
            price_per_kg=txn.price_per_kg,
            seller_name_snapshot=seller.name if seller else "Unknown Seller",
            seller_contact_snapshot=seller.contact if seller else None,
            recorded_by_name=recorder.name if recorder else None,
            issued_by_name=issuer.name if issuer else None,
        )
        db.add(receipt)
        db.flush()

        action = "issue_receipt_admin_override" if is_admin_override else "issue_receipt"
        log_action(db, current["id"], current["role"], action, "Receipt", receipt.id,
                   new_value={"transaction_id": str(txn.id), "net_amount_paid": str(receipt.net_amount_paid),
                              "loan_deduction": str(deduction), "loan_repayments": applied},
                   commit=False)
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(receipt)
    return format_receipt_out(receipt, db)
