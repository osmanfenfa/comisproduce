"""
User management endpoints.
Approval chain (spec section 2):
  - System Admin approves Produce Manager accounts (created as PENDING).
  - Produce Manager creates Secretary accounts (active immediately — Manager is accountable).
"""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.permissions import require_role, get_current_user
from app.core.security import hash_password, verify_password
from app.models.user import User, UserRole, UserStatus
from app.models.cocoa import CocoaTransaction
from app.models.coffee import CoffeeTransaction
from app.models.cola import ColaTransaction
from app.models.receipt import Receipt
from app.models.loan import Loan, LoanRepayment
from app.models.seller import Seller
from app.models.audit_log import AuditLog
from app.schemas.user import (
    ManagerRegister, SecretaryCreate, UserOut, UserListOut, 
    UserProfileUpdate, ChangePasswordRequest
)
from app.services.audit import log_action

router = APIRouter()

ADMIN_ONLY = require_role(UserRole.system_admin)
MANAGER_OR_ADMIN = require_role(UserRole.produce_manager, UserRole.system_admin)
ANY_STAFF = require_role(UserRole.produce_manager, UserRole.system_admin, UserRole.produce_secretary)


def validate_unique_credentials(
    db: Session,
    contact: str | None,
    email: str | None = None,
    phone_number: str | None = None,
    exclude_user_id: uuid.UUID | None = None,
):
    """
    Ensures email, contact, and phone number are strictly unique across all users
    (System Admin, Produce Manager, and Produce Secretary).
    Also prevents a contact matching an existing email or an email matching an existing contact.
    """
    identifiers = set()
    for val in [contact, email, phone_number]:
        if val and str(val).strip():
            identifiers.add(str(val).strip().lower())

    if not identifiers:
        return

    for ident in identifiers:
        query = db.query(User).filter(
            (func.lower(User.contact) == ident) |
            (func.lower(User.email) == ident) |
            (func.lower(User.phone_number) == ident)
        )
        if exclude_user_id:
            query = query.filter(User.id != exclude_user_id)
        
        existing = query.first()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Email, contact, and phone number must be unique across all users. '{ident}' is already in use by another account."
            )


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

@router.post("/managers", response_model=UserOut, status_code=201)
def register_manager(payload: ManagerRegister, db: Session = Depends(get_db)):
    """
    Public endpoint — no auth needed.
    Creates a Produce Manager account as PENDING; a System Admin must approve it
    before the manager can log in. (spec section 2.1 / 4.1)
    """
    contact_val = payload.email or payload.contact or payload.phone_number
    if not contact_val:
        raise HTTPException(status_code=400, detail="An email or phone number is required.")

    # Strict cross-user email & contact uniqueness validation
    validate_unique_credentials(
        db,
        contact=contact_val,
        email=payload.email,
        phone_number=payload.phone_number,
    )

    name_val = payload.business_name or payload.name or "Produce Manager"
    station_val = payload.business_name or payload.name or "Buying Station"
    user_id = uuid.uuid4()

    user = User(
        id=user_id,
        name=name_val,
        contact=contact_val,
        password_hash=hash_password(payload.password),
        role=UserRole.produce_manager,
        status=UserStatus.pending,
        station_name=station_val,
        business_name=payload.business_name,
        address=payload.address,
        email=payload.email,
        phone_number=payload.phone_number,
        produce_id=user_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/secretaries", response_model=UserOut, status_code=201)
def create_secretary(
    payload: SecretaryCreate,
    db: Session = Depends(get_db),
    current=Depends(MANAGER_OR_ADMIN),
):
    """
    Manager (or Admin) creates a Secretary account — active immediately.
    The Secretary is tied directly to the Manager's Produce Business (produce_id).
    """
    if current["role"] == UserRole.system_admin.value:
        raise HTTPException(
            status_code=403,
            detail="System Admin does not add secretaries. Only Produce Managers can add secretaries for their produce business."
        )

    effective_contact = payload.contact or payload.phone_number or payload.email
    if not effective_contact:
        raise HTTPException(status_code=422, detail="Contact, phone number, or email must be provided.")
    
    # Strict cross-user email & contact uniqueness validation
    validate_unique_credentials(
        db,
        contact=effective_contact,
        email=payload.email,
        phone_number=payload.phone_number,
    )

    tenant_produce_id = current.get("produce_id") or current["id"]

    user = User(
        name=payload.name,
        contact=effective_contact,
        email=payload.email,
        phone_number=payload.phone_number or payload.contact,
        address=payload.address,
        password_hash=hash_password(payload.password),
        role=UserRole.produce_secretary,
        status=UserStatus.active,
        station_name=payload.station_name or current.get("station_name"),
        business_name=current.get("business_name"),
        produce_id=tenant_produce_id,
        created_by=current["id"],
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_action(db, current["id"], current["role"], "create_secretary", "User", user.id,
               new_value={"name": payload.name, "contact": payload.contact, "station_name": user.station_name})
    return user


@router.get("/secretaries", response_model=list[UserListOut])
def list_secretaries(db: Session = Depends(get_db), current=Depends(MANAGER_OR_ADMIN)):
    """Produce Manager lists only secretaries belonging to their own Produce Business."""
    tenant_produce_id = current.get("produce_id") or current["id"]
    query = db.query(User).filter(
        User.role == UserRole.produce_secretary,
        User.produce_id == tenant_produce_id,
    )
    return query.order_by(User.name.asc()).all()


@router.get("/stations", response_model=list[str])
def list_stations(db: Session = Depends(get_db), current=Depends(ANY_STAFF)):
    """Returns unique stations configured under the user's Produce Business."""
    tenant_produce_id = current.get("produce_id") or current["id"]
    station_names = set()
    if current.get("station_name"):
        station_names.add(current["station_name"])
    sec_stations = db.query(User.station_name).filter(
        User.produce_id == tenant_produce_id,
        User.station_name != None
    ).distinct().all()
    for s in sec_stations:
        if s[0]:
            station_names.add(s[0])
    return sorted(list(station_names))


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserOut)
def get_me(db: Session = Depends(get_db), current=Depends(ANY_STAFF)):
    """Returns the profile of the currently authenticated user."""
    user = db.query(User).filter(User.id == current["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/me", response_model=UserOut)
def update_me(
    payload: UserProfileUpdate,
    db: Session = Depends(get_db),
    current=Depends(MANAGER_OR_ADMIN),
):
    """Update profile information for Produce Manager and System Admin."""
    user = db.query(User).filter(User.id == current["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_data = {
        "name": user.name,
        "contact": user.contact,
        "business_name": user.business_name,
        "station_name": user.station_name,
    }

    if payload.name is not None:
        user.name = payload.name
    if payload.business_name is not None:
        user.business_name = payload.business_name
        if user.role == UserRole.produce_manager:
            user.station_name = payload.business_name
    if payload.station_name is not None:
        user.station_name = payload.station_name
    if payload.address is not None:
        user.address = payload.address
    if payload.email is not None or payload.contact is not None or payload.phone_number is not None:
        check_contact = payload.contact if payload.contact is not None else user.contact
        check_email = payload.email if payload.email is not None else user.email
        check_phone = payload.phone_number if payload.phone_number is not None else user.phone_number
        validate_unique_credentials(
            db,
            contact=check_contact,
            email=check_email,
            phone_number=check_phone,
            exclude_user_id=user.id,
        )

    if payload.phone_number is not None:
        user.phone_number = payload.phone_number
    if payload.email is not None:
        user.email = payload.email
    if payload.gender is not None:
        user.gender = payload.gender
    if payload.contact is not None:
        user.contact = payload.contact

    db.commit()
    db.refresh(user)
    log_action(db, current["id"], current["role"], "update_profile", "User", user.id,
               old_value=old_data, new_value={"name": user.name, "business_name": user.business_name})
    return user


@router.post("/me/change-password")
def change_my_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),   # every account type, including farmers/traders
):
    """Change password for authenticated user."""
    user = db.query(User).filter(User.id == current["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password does not match.")

    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long.")

    user.password_hash = hash_password(payload.new_password)
    db.commit()
    log_action(db, current["id"], current["role"], "change_password", "User", user.id)
    return {"message": "Password updated successfully"}



@router.get("/", response_model=list[UserListOut])
def list_users(
    role: UserRole | None = None,
    status: UserStatus | None = None,
    db: Session = Depends(get_db),
    current=Depends(ADMIN_ONLY),
):
    """Admin only — list all users with optional filters."""
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    if status:
        query = query.filter(User.status == status)
    return query.order_by(User.created_at.desc()).all()


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: uuid.UUID, db: Session = Depends(get_db), current=Depends(ADMIN_ONLY)):
    """Admin only — get a single user by ID."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ---------------------------------------------------------------------------
# Admin actions
# ---------------------------------------------------------------------------

@router.post("/{user_id}/approve", response_model=UserOut)
def approve_manager(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current=Depends(ADMIN_ONLY),
):
    """Admin approves a pending Manager account. (spec section 2.1)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role != UserRole.produce_manager:
        raise HTTPException(status_code=400, detail="Only Produce Manager accounts require approval.")
    if user.status == UserStatus.active:
        raise HTTPException(status_code=400, detail="Account is already active.")

    user.status = UserStatus.active
    user.approved_by = current["id"]
    user.approved_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    log_action(db, current["id"], current["role"], "approve_manager", "User", user.id)
    return user


@router.post("/{user_id}/suspend", response_model=UserOut)
def suspend_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current=Depends(ADMIN_ONLY),
):
    """Admin suspends any user account. (spec section 2.1)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.status == UserStatus.suspended:
        raise HTTPException(status_code=400, detail="Account is already suspended.")
    if str(user.id) == str(current["id"]):
        raise HTTPException(status_code=400, detail="You cannot suspend your own account.")

    user.status = UserStatus.suspended
    db.commit()
    db.refresh(user)
    log_action(db, current["id"], current["role"], "suspend_user", "User", user.id)
    return user


@router.post("/{user_id}/reactivate", response_model=UserOut)
def reactivate_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current=Depends(ADMIN_ONLY),
):
    """Admin reactivates a suspended account."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.status == UserStatus.active:
        raise HTTPException(status_code=400, detail="Account is already active.")

    user.status = UserStatus.active
    db.commit()
    db.refresh(user)
    log_action(db, current["id"], current["role"], "reactivate_user", "User", user.id)
    return user


@router.delete("/{user_id}", status_code=200)
def delete_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current=Depends(ADMIN_ONLY),
):
    """
    System Admin permanently deletes any user account.
    Safely reassigns / detaches foreign key references so historical data is preserved.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if str(user.id) == str(current["id"]):
        raise HTTPException(status_code=400, detail="You cannot delete your own admin account.")

    admin_id = current["id"]

    # Detach / reassign foreign key references to prevent integrity errors
    db.query(User).filter(User.approved_by == user.id).update({"approved_by": None})
    db.query(User).filter(User.created_by == user.id).update({"created_by": None})

    db.query(CocoaTransaction).filter(CocoaTransaction.reviewed_by == user.id).update({"reviewed_by": None})
    db.query(CoffeeTransaction).filter(CoffeeTransaction.reviewed_by == user.id).update({"reviewed_by": None})
    db.query(ColaTransaction).filter(ColaTransaction.reviewed_by == user.id).update({"reviewed_by": None})

    db.query(Receipt).filter(Receipt.recorded_by == user.id).update({"recorded_by": None})
    db.query(Loan).filter(Loan.approved_by == user.id).update({"approved_by": None})

    # Reassign created_by / issued_by to the deleting admin
    db.query(CocoaTransaction).filter(CocoaTransaction.created_by == user.id).update({"created_by": admin_id})
    db.query(CoffeeTransaction).filter(CoffeeTransaction.created_by == user.id).update({"created_by": admin_id})
    db.query(ColaTransaction).filter(ColaTransaction.created_by == user.id).update({"created_by": admin_id})
    db.query(Receipt).filter(Receipt.issued_by == user.id).update({"issued_by": admin_id})
    db.query(Loan).filter(Loan.created_by == user.id).update({"created_by": admin_id})
    db.query(LoanRepayment).filter(LoanRepayment.recorded_by == user.id).update({"recorded_by": admin_id})
    db.query(Seller).filter(Seller.created_by == user.id).update({"created_by": None})

    # Delete audit logs of the deleted user
    db.query(AuditLog).filter(AuditLog.user_id == user.id).delete(synchronize_session=False)

    # If deleting a Produce Manager, detach any secretaries under that produce_id
    if user.role == UserRole.produce_manager:
        db.query(User).filter(User.produce_id == user.id, User.id != user.id).update({"produce_id": None})

    user_name = user.name
    user_role = user.role.value
    db.delete(user)
    db.commit()

    log_action(db, admin_id, current["role"], "delete_user", "User", user_id,
               old_value={"name": user_name, "role": user_role})
    return {"message": f"User '{user_name}' ({user_role}) deleted successfully."}
