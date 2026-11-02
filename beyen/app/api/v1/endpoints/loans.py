"""
Loans management. (spec section 10)

Manager / Admin only for create/repayment/list details.
Secretary can read the balance-only endpoint on sellers (see sellers.py).
"""
import uuid
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.permissions import require_role
from app.models.user import UserRole
from app.schemas.loan import LoanCreate, LoanOut, LoanWithRepayments, LoanRepaymentCreate, LoanRepaymentOut
from app.models.loan import Loan, LoanRepayment
from app.services.pricing import calculate_loan_balance
from app.services.audit import log_action

router = APIRouter()

MANAGER_OR_ADMIN = require_role(UserRole.produce_manager, UserRole.system_admin)


def _enrich_loan(loan: Loan) -> dict:
    """Compute and attach the running balance."""
    total_paid = sum(r.amount_paid for r in loan.repayments)
    balance = calculate_loan_balance(loan.loan_taken, total_paid)
    return {
        "id": loan.id, "seller_id": loan.seller_id, "date": loan.date,
        "loan_taken": loan.loan_taken, "due_date": loan.due_date, "status": loan.status,
        "notes": loan.notes, "created_by": loan.created_by, "approved_by": loan.approved_by,
        "created_at": loan.created_at, "balance": balance,
    }


def _update_overdue(loan: Loan) -> None:
    """Flip status to overdue if past due date and not cleared."""
    if loan.due_date and loan.status == "active" and loan.due_date < date.today():
        loan.status = "overdue"


@router.post("/", response_model=LoanOut, status_code=201)
def create_loan(
    payload: LoanCreate,
    db: Session = Depends(get_db),
    current=Depends(MANAGER_OR_ADMIN),
):
    """Create and auto-approve a loan (Manager is the authority). (spec section 10)"""
    tenant_produce_id = current.get("produce_id") or current["id"]
    loan = Loan(
        **payload.model_dump(),
        created_by=current["id"],
        approved_by=current["id"],
        produce_id=tenant_produce_id,
    )
    db.add(loan)
    db.commit()
    db.refresh(loan)
    log_action(db, current["id"], current["role"], "create_loan", "Loan", loan.id,
               new_value=payload.model_dump())
    return LoanOut(**_enrich_loan(loan))


@router.post("/repayments", response_model=dict)
def record_repayment(
    payload: LoanRepaymentCreate,
    db: Session = Depends(get_db),
    current=Depends(MANAGER_OR_ADMIN),
):
    """Record a cash loan repayment. (spec section 10)"""
    loan = db.query(Loan).filter(Loan.id == payload.loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if current["role"] != UserRole.system_admin.value:
        tenant_produce_id = current.get("produce_id") or current["id"]
        if loan.produce_id and loan.produce_id != tenant_produce_id:
            raise HTTPException(status_code=403, detail="Access denied")

    current_balance = calculate_loan_balance(loan.loan_taken, sum((r.amount_paid for r in loan.repayments), Decimal("0")))
    if payload.amount_paid > current_balance:
        raise HTTPException(
            status_code=400,
            detail=f"Repayment ({payload.amount_paid}) exceeds the outstanding balance ({current_balance}).",
        )

    repayment = LoanRepayment(
        loan_id=payload.loan_id,
        amount_paid=payload.amount_paid,
        date=payload.date,
        recorded_by=current["id"],
    )
    db.add(repayment)
    balance = current_balance - payload.amount_paid
    if balance <= 0:
        loan.status = "cleared"
    else:
        _update_overdue(loan)

    log_action(db, current["id"], current["role"], "record_repayment", "Loan", loan.id,
               new_value={"amount_paid": payload.amount_paid, "new_balance": balance}, commit=False)
    db.commit()
    return {"balance": float(balance), "status": loan.status}


@router.get("/", response_model=list[LoanOut])
def list_loans(
    seller_id: uuid.UUID | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    current=Depends(MANAGER_OR_ADMIN),
):
    query = db.query(Loan)
    if current["role"] != UserRole.system_admin.value:
        tenant_produce_id = current.get("produce_id") or current["id"]
        query = query.filter(Loan.produce_id == tenant_produce_id)
    if seller_id:
        query = query.filter(Loan.seller_id == seller_id)
    if status:
        query = query.filter(Loan.status == status)
    loans = query.order_by(Loan.date.desc()).all()

    # Update overdue statuses in bulk
    for loan in loans:
        _update_overdue(loan)
    db.commit()

    return [LoanOut(**_enrich_loan(loan)) for loan in loans]


@router.get("/{loan_id}", response_model=LoanWithRepayments)
def get_loan(
    loan_id: uuid.UUID,
    db: Session = Depends(get_db),
    current=Depends(MANAGER_OR_ADMIN),
):
    loan = db.query(Loan).filter(Loan.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if current["role"] != UserRole.system_admin.value:
        tenant_produce_id = current.get("produce_id") or current["id"]
        if loan.produce_id and loan.produce_id != tenant_produce_id:
            raise HTTPException(status_code=403, detail="Access denied")
    _update_overdue(loan)
    db.commit()
    enriched = _enrich_loan(loan)
    repayments = [LoanRepaymentOut.model_validate(r) for r in loan.repayments]
    return LoanWithRepayments(**enriched, repayments=repayments)
